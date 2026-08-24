from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen
from datetime import datetime, timezone, timedelta
import bz2
import json
import math
import tempfile

from eccodes import (
    codes_get,
    codes_grib_find_nearest,
    codes_grib_new_from_file,
    codes_release,
)

USER_AGENT = "VelvetPassportNOW/1.0"
TIMEOUT = 9


def _json(handler, status, payload):
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600")
    handler.end_headers()
    handler.wfile.write(body)


def _download(url, headers=None):
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*", **(headers or {})})
    with urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def _nearest_from_bytes(data, lat, lon, wanted=None):
    values = {}
    with tempfile.NamedTemporaryFile(suffix=".grib2") as tmp:
        tmp.write(data)
        tmp.flush()
        with open(tmp.name, "rb") as stream:
            while True:
                gid = codes_grib_new_from_file(stream)
                if gid is None:
                    break
                try:
                    short_name = str(codes_get(gid, "shortName"))
                    if wanted is not None and short_name not in wanted:
                        continue
                    nearest = codes_grib_find_nearest(gid, lat, lon)
                    if isinstance(nearest, list) and nearest:
                        item = nearest[0]
                        value = float(item["value"] if isinstance(item, dict) else item[2])
                    elif isinstance(nearest, tuple) and len(nearest) >= 3:
                        value = float(nearest[2])
                    else:
                        continue
                    values[short_name] = value
                finally:
                    codes_release(gid)
    return values


def _single_value(data, lat, lon):
    values = _nearest_from_bytes(data, lat, lon)
    return next(iter(values.values()), None)


def _temperature_c(value):
    if value is None:
        return None
    return value - 273.15 if value > 170 else value


def _payload(model, source, run_time, temperature=None, u=None, v=None, precipitation=None):
    wind = math.hypot(u, v) if u is not None and v is not None else None
    if precipitation is not None:
        precipitation = max(0.0, precipitation)
    return {
        "model": model,
        "source": source,
        "current": {
            "temperature_2m": round(temperature, 2) if temperature is not None else None,
            "wind_speed_10m": round(wind, 2) if wind is not None else None,
            "precipitation": round(precipitation, 3) if precipitation is not None else None,
            "symbol": "model",
            "time": run_time.isoformat().replace("+00:00", "Z"),
        },
    }


def _candidate_runs(hours_back, cycle_hours, attempts=4):
    now = datetime.now(timezone.utc) - timedelta(hours=hours_back)
    base_hour = (now.hour // cycle_hours) * cycle_hours
    base = now.replace(hour=base_hour, minute=0, second=0, microsecond=0)
    return [base - timedelta(hours=cycle_hours * i) for i in range(attempts)]


def _dwd_field(model, run, field, step):
    hh = run.strftime("%H")
    stamp = run.strftime("%Y%m%d%H")
    if model == "icon_eu":
        folder = "icon-eu"
        prefix = "icon-eu_europe_regular-lat-lon_single-level"
    else:
        folder = "icon"
        prefix = "icon_global_icosahedral_single-level"
    filename = f"{prefix}_{stamp}_{step:03d}_{field}.grib2.bz2"
    url = f"https://opendata.dwd.de/weather/nwp/{folder}/grib/{hh}/{field.lower()}/{filename}"
    return bz2.decompress(_download(url))


def _icon(model, lat, lon):
    source = "DWD ICON-EU" if model == "icon_eu" else "DWD ICON Global"
    last_error = None
    for run in _candidate_runs(4, 3):
        try:
            temp = _single_value(_dwd_field(model, run, "T_2M", 0), lat, lon)
            u = _single_value(_dwd_field(model, run, "U_10M", 0), lat, lon)
            v = _single_value(_dwd_field(model, run, "V_10M", 0), lat, lon)
            prec = _single_value(_dwd_field(model, run, "TOT_PREC", 1), lat, lon)
            return _payload(model, source, run, _temperature_c(temp), u, v, prec)
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"{source} unavailable: {last_error}")


def _gfs(lat, lon):
    last_error = None
    for run in _candidate_runs(4, 6):
        try:
            pad = 0.35
            params = {
                "file": f"gfs.t{run:%H}z.pgrb2.0p25.f001",
                "var_TMP": "on", "var_UGRD": "on", "var_VGRD": "on", "var_APCP": "on",
                "lev_2_m_above_ground": "on", "lev_10_m_above_ground": "on", "lev_surface": "on",
                "subregion": "",
                "leftlon": f"{lon-pad:.3f}", "rightlon": f"{lon+pad:.3f}",
                "toplat": f"{lat+pad:.3f}", "bottomlat": f"{lat-pad:.3f}",
                "dir": f"/gfs.{run:%Y%m%d}/{run:%H}/atmos",
            }
            data = _download("https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?" + urlencode(params))
            decoded = _nearest_from_bytes(data, lat, lon, {"2t", "10u", "10v", "tp"})
            temp = _temperature_c(decoded.get("2t"))
            if temp is None:
                raise RuntimeError("GFS 2m temperature missing")
            return _payload("gfs_global", "NOAA GFS", run, temp, decoded.get("10u"), decoded.get("10v"), decoded.get("tp"))
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"NOAA GFS unavailable: {last_error}")


def _ecmwf(lat, lon):
    last_error = None
    for run in _candidate_runs(8, 6):
        try:
            root = f"https://data.ecmwf.int/forecasts/{run:%Y%m%d}/{run:%H}z/ifs/0p25/oper/{run:%Y%m%d%H}0000-3h-oper-fc"
            index_text = _download(root + ".index").decode("utf-8")
            entries = [json.loads(line) for line in index_text.splitlines() if line.strip()]
            wanted = {"2t", "10u", "10v", "tp"}
            selected = {entry.get("param"): entry for entry in entries if entry.get("param") in wanted}
            decoded = {}
            for param in wanted:
                entry = selected.get(param)
                if not entry:
                    continue
                start = int(entry["_offset"])
                length = int(entry["_length"])
                chunk = _download(root + ".grib2", {"Range": f"bytes={start}-{start+length-1}"})
                decoded[param] = _single_value(chunk, lat, lon)
            temp = _temperature_c(decoded.get("2t"))
            if temp is None:
                raise RuntimeError("ECMWF 2t missing")
            precipitation = decoded.get("tp")
            if precipitation is not None:
                precipitation *= 1000.0
            return _payload("ecmwf_ifs", "ECMWF IFS Open Data", run, temp, decoded.get("10u"), decoded.get("10v"), precipitation)
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"ECMWF IFS unavailable: {last_error}")


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        model = query.get("model", [""])[0]
        try:
            lat = float(query.get("latitude", [""])[0])
            lon = float(query.get("longitude", [""])[0])
        except ValueError:
            return _json(self, 400, {"available": False, "error": "Valid latitude and longitude are required"})
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return _json(self, 400, {"available": False, "error": "Coordinates out of range"})
        try:
            if model in ("icon_eu", "icon_global"):
                result = _icon(model, lat, lon)
            elif model == "gfs_global":
                result = _gfs(lat, lon)
            elif model == "ecmwf_ifs":
                result = _ecmwf(lat, lon)
            else:
                return _json(self, 400, {"available": False, "error": "Unsupported weather model"})
            result["available"] = result.get("current", {}).get("temperature_2m") is not None
            return _json(self, 200, result)
        except Exception as exc:
            return _json(self, 503, {"available": False, "model": model, "error": str(exc)[:240]})

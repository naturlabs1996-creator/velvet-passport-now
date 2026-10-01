import { normalizeRadarObservation, type NormalizedRadarObservation, type RawRadarObservation } from "./radar-pipeline";

export type BooksBuyCollectorResult = {
  source: "google-play-books";
  ok: boolean;
  observations: RawRadarObservation[];
  normalized: NormalizedRadarObservation[];
  note?: string;
};

const QUERIES = [
  "Paris hidden gems travel guide",
  "Paris off the beaten path guide",
  "Paris secret places guide",
  "Paris unusual travel guide",
];

const uniqueBy = <T>(items: T[], key: (item: T) => string) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

export async function collectGooglePlayBooksBuy(): Promise<BooksBuyCollectorResult> {
  const observations: RawRadarObservation[] = [];
  let failures = 0;

  for (const query of QUERIES) {
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&printType=books&maxResults=20&orderBy=relevance`;
      const response = await fetch(url, { next: { revalidate: 3600 } });
      if (!response.ok) { failures += 1; continue; }
      const payload = await response.json() as {
        items?: Array<{
          id?: string;
          volumeInfo?: { title?: string; subtitle?: string; description?: string; authors?: string[]; publishedDate?: string; infoLink?: string };
          saleInfo?: { saleability?: string; isEbook?: boolean; buyLink?: string; listPrice?: { amount?: number; currencyCode?: string } };
        }>;
      };

      for (const item of payload.items ?? []) {
        const title = item.volumeInfo?.title ?? "";
        const subtitle = item.volumeInfo?.subtitle ?? "";
        const description = item.volumeInfo?.description ?? "";
        const saleability = item.saleInfo?.saleability ?? "";
        const isForSale = /FOR_SALE|FREE/i.test(saleability) || Boolean(item.saleInfo?.buyLink);
        if (!isForSale) continue;
        const price = item.saleInfo?.listPrice?.amount;
        const currency = item.saleInfo?.listPrice?.currencyCode;
        const text = `${title}. ${subtitle}. ${description} ${price ? `Price ${price} ${currency ?? ""}.` : ""}`.replace(/\s+/g, " ").trim();
        if (!/\bparis\b/i.test(`${text} ${query}`)) continue;

        observations.push({
          source: "google-play-books",
          sourceType: "BUY",
          text: `${query}. ${text}`.slice(0, 1200),
          query,
          observedAt: new Date().toISOString(),
          volumeScore: 52,
          velocityScore: 38,
          sourceConfidence: 86,
          commercialIntent: item.saleInfo?.buyLink ? 88 : 76,
          competitionPressure: 68,
          sourceUrl: item.saleInfo?.buyLink ?? item.volumeInfo?.infoLink ?? (item.id ? `https://books.google.com/books?id=${item.id}` : undefined),
        });
      }
    } catch {
      failures += 1;
    }
  }

  const deduped = uniqueBy(observations, (item) => item.sourceUrl ?? item.text.slice(0, 160).toLowerCase()).slice(0, 50);
  return {
    source: "google-play-books",
    ok: deduped.length > 0,
    observations: deduped,
    normalized: deduped.flatMap(normalizeRadarObservation),
    note: deduped.length ? undefined : failures === QUERIES.length ? "books_api_unavailable" : "no_sellable_relevant_books",
  };
}

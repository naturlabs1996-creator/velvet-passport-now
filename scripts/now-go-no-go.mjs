#!/usr/bin/env node

const origin = (process.env.NOW_TEST_ORIGIN || "").replace(/\/$/, "");
const healthKey = process.env.NOW_HEALTH_KEY || "";
const passCookie = process.env.NOW_TEST_PASS_COOKIE || "";

if (!origin) {
  console.error("NO-GO: NOW_TEST_ORIGIN is required.");
  process.exit(2);
}

const results = [];

async function probe(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, status: "PASS", ms: Date.now() - started, detail });
  } catch (error) {
    results.push({ name, status: "FAIL", ms: Date.now() - started, detail: error instanceof Error ? error.message : String(error) });
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(origin + path, { redirect: "manual", ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

await probe("Landing responds", async () => {
  const response = await request("/");
  expect(response.status >= 200 && response.status < 400, `unexpected status ${response.status}`);
  return `HTTP ${response.status}`;
});

await probe("Health endpoint is private", async () => {
  const response = await request("/api/now/health");
  expect(response.status === 404, `expected 404, received ${response.status}`);
  return "unauthorized health probe hidden";
});

await probe("Context requires a valid pass", async () => {
  const response = await request("/api/now/context", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lat: 48.8566, lon: 2.3522, radiusMeters: 800 }),
  });
  expect(response.status === 401, `expected 401, received ${response.status}`);
  return "pass gate enforced";
});

await probe("Tickets require a valid pass", async () => {
  const response = await request("/api/now/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ availableMinutes: 120, protectedMarginMinutes: 15 }),
  });
  expect(response.status === 401, `expected 401, received ${response.status}`);
  return "ticket gate enforced";
});

await probe("Transport requires a valid pass", async () => {
  const response = await request("/api/now/transport", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ origin: "Louvre", destination: "Opera Garnier" }),
  });
  expect(response.status === 401, `expected 401, received ${response.status}`);
  return "transport gate enforced";
});

if (healthKey) {
  await probe("Deep Health returns a valid system state", async () => {
    const response = await request("/api/now/health", { headers: { "x-now-health-key": healthKey } });
    expect(response.status === 200 || response.status === 503, `unexpected status ${response.status}`);
    const payload = await response.json();
    expect(["green", "amber", "red"].includes(payload.status), "invalid global health status");
    expect(["continue", "continue_with_fallbacks", "protect_traveler"].includes(payload.action), "invalid health action");
    expect(Array.isArray(payload.signals) && payload.signals.length > 0, "health signals missing");
    if (payload.status === "red") expect(payload.travelerSafe === false, "red state must not claim travelerSafe=true");
    return `${payload.status} · ${payload.action} · ${payload.signals.length} signals`;
  });
}

if (passCookie) {
  const authHeaders = { cookie: passCookie, "content-type": "application/json" };

  await probe("Live context never fabricates Paris GPS", async () => {
    const response = await request("/api/now/context", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ lat: 0, lon: 0, radiusMeters: 800 }),
    });
    expect(response.status === 422, `expected 422 for non-Paris coordinates, received ${response.status}`);
    return "invalid location rejected";
  });

  await probe("Ticket Intelligence is three-or-none", async () => {
    const response = await request("/api/now/tickets", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ availableMinutes: 120, elapsedMinutes: 15, protectedMarginMinutes: 15 }),
    });
    expect(response.status === 200, `unexpected status ${response.status}`);
    const payload = await response.json();
    const count = Array.isArray(payload.recommendations) ? payload.recommendations.length : -1;
    expect(count === 0 || count === 3, `partial recommendation set exposed: ${count}`);
    expect(payload.bookingReady ? count === 3 : count === 0, "bookingReady does not match recommendation count");
    return payload.bookingReady ? "3 verified offers" : "safe degraded no-ticket fallback";
  });

  await probe("Transport rejects out-of-area journey", async () => {
    const response = await request("/api/now/transport", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ origin: "48.8566, 2.3522", destination: "Versailles" }),
    });
    expect(response.status === 422, `expected 422, received ${response.status}`);
    return "local Paris operating boundary enforced";
  });
}

console.log("\nVELVET PASSPORT NOW · GO / NO-GO\n");
for (const result of results) {
  console.log(`${result.status.padEnd(4)}  ${result.name}  (${result.ms} ms)  ${result.detail}`);
}

const failed = results.filter((result) => result.status === "FAIL");
const decision = failed.length ? "NO-GO" : "GO-FOR-TESTED-SCOPE";
console.log(`\nDECISION: ${decision}`);
console.log(`PASS ${results.length - failed.length} / ${results.length} · FAIL ${failed.length}`);

process.exit(failed.length ? 1 : 0);

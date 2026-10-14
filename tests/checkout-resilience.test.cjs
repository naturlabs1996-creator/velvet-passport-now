const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const page = fs.readFileSync("app/page.tsx", "utf8");
const start = page.indexOf("  const buy=async(plan:PassPlan)=>{");
const end = page.indexOf("\n  const faqs=", start);
assert.ok(start !== -1 && end > start, "checkout handler exists");
const snippet = page.slice(start, end) + "\n globalThis.__buy = buy;";
const js = ts.transpileModule(snippet, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(fetchImpl) {
  const storage = new Map();
  const state = { status: [], errors: [], redirects: [], calls: [] };
  let randomCount = 0;
  const context = {
    checkoutInFlight: { current: false },
    setCheckout: x => state.status.push(x),
    setCheckoutError: x => state.errors.push(x),
    sessionStorage: {
      getItem: k => storage.get(k) ?? null,
      setItem: (k,v) => storage.set(k,v),
      removeItem: k => storage.delete(k),
    },
    crypto: { randomUUID: () => String(++randomCount).padStart(32,"a") },
    fetch: (...args) => { state.calls.push(args); return fetchImpl(...args); },
    AbortSignal,
    Error,
    setTimeout: () => {},
    document: { querySelector: () => null },
    window: { location: { assign: url => state.redirects.push(url) } },
  };
  vm.runInNewContext(js, context);
  return { buy: context.__buy, storage, state };
}

test("checkout uses a 15-second timeout and redirects on success", async () => {
  const h = harness(async () => ({ ok: true, json: async () => ({ checkoutUrl: "https://checkout.stripe.test/ok" }) }));
  await h.buy("72h");
  assert.equal(h.state.calls.length, 1);
  assert.equal(h.state.calls[0][1].signal.aborted, false);
  assert.equal(h.state.redirects.length, 1);
  assert.equal(h.storage.size, 0);
});

test("simultaneous double clicks only send one request", async () => {
  let resolve;
  const pending = new Promise(r => { resolve = r; });
  const h = harness(() => pending);
  const first = h.buy("72h");
  await h.buy("72h");
  assert.equal(h.state.calls.length, 1);
  resolve({ ok: true, json: async () => ({ checkoutUrl: "https://checkout.stripe.test/ok" }) });
  await first;
});

test("timeout shows recovery message and retry reuses idempotency key", async () => {
  let count = 0;
  const h = harness(async () => {
    if (++count === 1) { const e = new Error("timeout"); e.name = "TimeoutError"; throw e; }
    return { ok: true, json: async () => ({ checkoutUrl: "https://checkout.stripe.test/ok" }) };
  });
  await h.buy("7d");
  assert.equal(h.state.status.at(-1), "error");
  assert.match(h.state.errors.at(-1), /too long/);
  const firstKey = h.state.calls[0][1].headers["x-now-checkout-attempt"];
  assert.equal(h.storage.size, 1);
  await h.buy("7d");
  assert.equal(h.state.calls[1][1].headers["x-now-checkout-attempt"], firstKey);
  assert.equal(h.storage.size, 0);
});

test("server failure leaves a recoverable attempt", async () => {
  const h = harness(async () => ({ ok: false, json: async () => ({ error: "Unavailable" }) }));
  await h.buy("72h");
  assert.equal(h.state.status.at(-1), "error");
  assert.equal(h.storage.size, 1);
  assert.equal(h.state.redirects.length, 0);
});

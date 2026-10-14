const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("lib/now-route-progress.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function createHarness(options = {}) {
  const data = new Map();
  const storage = {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => { if (options.writeFails) throw Error("quota"); data.set(k, v); },
    removeItem: k => data.delete(k),
  };
  const exports = {};
  const context = { exports, window: options.noWindow ? undefined : { localStorage: storage }, Date, JSON, Number };
  vm.runInNewContext(compiled, context);
  return { api: exports, data, storage };
}

test("save and resume a route at the last reached stop", () => {
  const { api } = createHarness();
  assert.equal(api.saveRouteProgress("quebec", "qc-01", 2, 5).ok, true);
  const restored = api.loadRouteProgress("quebec", "qc-01", 5);
  assert.equal(restored.ok, true);
  assert.equal(restored.progress.stopIndex, 2);
});

test("different routes cannot overwrite each other", () => {
  const { api } = createHarness();
  api.saveRouteProgress("quebec", "qc-01", 1, 5);
  api.saveRouteProgress("quebec", "qc-02", 3, 4);
  assert.equal(api.loadRouteProgress("quebec", "qc-01", 5).progress.stopIndex, 1);
  assert.equal(api.loadRouteProgress("quebec", "qc-02", 4).progress.stopIndex, 3);
});

test("stop count changes invalidate old progress", () => {
  const { api } = createHarness();
  api.saveRouteProgress("quebec", "qc-01", 2, 5);
  assert.equal(api.loadRouteProgress("quebec", "qc-01", 6).ok, false);
});

test("corrupted and expired records are rejected", () => {
  const { api, data } = createHarness();
  api.saveRouteProgress("quebec", "qc-01", 1, 5);
  const key = [...data.keys()][0];
  data.set(key, "{invalid json");
  assert.equal(api.loadRouteProgress("quebec", "qc-01", 5).ok, false);
  data.set(key, JSON.stringify({version:1,city:"quebec",routeId:"qc-01",stopIndex:1,stopCount:5,updatedAt:Date.now()-31*86400000}));
  assert.equal(api.loadRouteProgress("quebec", "qc-01", 5).ok, false);
});

test("storage errors do not crash navigation", () => {
  const { api } = createHarness({ writeFails: true });
  assert.equal(api.saveRouteProgress("quebec", "qc-01", 1, 5).ok, false);
});

test("SSR without window is safe", () => {
  const { api } = createHarness({ noWindow: true });
  assert.equal(api.loadRouteProgress("quebec", "qc-01", 5).ok, false);
});

test("invalid stop indexes are rejected", () => {
  const { api } = createHarness();
  assert.equal(api.saveRouteProgress("quebec", "qc-01", 5, 5).ok, false);
  assert.equal(api.saveRouteProgress("quebec", "qc-01", -1, 5).ok, false);
  assert.equal(api.saveRouteProgress("quebec", "qc-01", 0.5, 5).ok, false);
});

test("completion clears the saved position", () => {
  const { api } = createHarness();
  api.saveRouteProgress("quebec", "qc-01", 4, 5);
  assert.equal(api.clearRouteProgress("quebec", "qc-01"), true);
  assert.equal(api.loadRouteProgress("quebec", "qc-01", 5).ok, false);
});

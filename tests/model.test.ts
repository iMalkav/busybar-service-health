import assert from "node:assert/strict";
import test from "node:test";
import schema from "../src/appmeta/settings.json" with { type: "json" };
import { AppModel } from "../src/model.ts";
import { schemaDefaults, type Settings } from "../src/lib.ts";
const NOW = 1700000000000;
const make = (values: Settings = {}, saved: Settings = {}, now = NOW) =>
  new AppModel({ ...schemaDefaults(schema.fields), ...values }, saved, now);

test("HTTP errors remain distinct from transport failures", () => {
  const a = make({ services: "API=https://service.example/health" });
  a.request(NOW);
  a.receive({ status: 503, elapsed_ms: 32 }, NOW);
  assert.equal(a.view(NOW).value, "HTTP 503");
  a.fail("Connection timed out");
  assert.equal(a.view(NOW).value, "UNREACHABLE");
});
test("checks rotate independently and preserve each response", () => {
  const a = make({ services: "A=https://a.example;B=https://b.example" });
  assert.equal(a.request(NOW)?.url, "https://a.example");
  a.receive({ status: 200, elapsed_ms: 10 }, NOW);
  assert.equal(a.request(NOW)?.url, "https://b.example");
  a.fail("Offline");
  assert.equal(a.services[0].status, 200);
});

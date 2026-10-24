"use strict";

var assert = require("assert");
var call = require("../public/assets/call.js");

var now = Date.parse("2026-10-23T00:00:00.000Z");
var cfg = call.configOf({});

assert.strictEqual(cfg.durationSec, 60);
assert.strictEqual(cfg.cooldownSec, 300);
assert.strictEqual(call.configOf({ durationSec: 5, cooldownSec: 999999 }).durationSec, 15);
assert.strictEqual(call.configOf({ durationSec: 90, cooldownSec: 10 }).cooldownSec, 10);
assert.deepStrictEqual(call.LINES, ["hi", "here", "hear"]);

assert.strictEqual(call.phase(null, cfg, now).name, "idle");
assert.strictEqual(call.isLive(null, now), false);

var live = {
  startedAt: new Date(now - 10000).toISOString(),
  endsAt: new Date(now + 50000).toISOString()
};
assert.strictEqual(call.phase(live, cfg, now).name, "live");
assert.strictEqual(call.isLive(live, now), true);
assert.strictEqual(call.phase(live, cfg, now).remainMs, 50000);

var cooling = {
  startedAt: new Date(now - 61000).toISOString(),
  endsAt: new Date(now - 1000).toISOString()
};
assert.strictEqual(call.phase(cooling, cfg, now).name, "cool");
assert.strictEqual(call.isLive(cooling, now), false);

var ready = {
  startedAt: new Date(now - 400000).toISOString(),
  endsAt: new Date(now - 301000).toISOString()
};
assert.strictEqual(call.phase(ready, cfg, now).name, "idle");
assert.strictEqual(call.formatRemain(65000), "1:05");
assert.strictEqual(call.formatRemain(0), "0:00");

console.log("call.test.js passed");

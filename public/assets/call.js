(function (root) {
  "use strict";

  var LINES = ["hi", "here", "hear"];
  var DEFAULTS = { durationSec: 60, cooldownSec: 300 };

  function number(value, fallback, min, max) {
    var n = Number(value);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function configOf(raw) {
    raw = raw || {};
    return {
      durationSec: number(raw.durationSec, DEFAULTS.durationSec, 15, 600),
      cooldownSec: number(raw.cooldownSec, DEFAULTS.cooldownSec, 0, 86400)
    };
  }

  function endsAt(call) {
    if (!call || !call.endsAt) return NaN;
    return Date.parse(call.endsAt);
  }

  function isLive(call, now) {
    var ends = endsAt(call);
    return isFinite(ends) && now < ends;
  }

  // idle: Yayın yap. live: the broadcast is on. cool: wait out the gap.
  function phase(call, config, now) {
    var ends = endsAt(call);
    if (!isFinite(ends)) return { name: "idle", remainMs: 0 };
    if (now < ends) return { name: "live", remainMs: ends - now };
    var gap = configOf(config).cooldownSec * 1000;
    var coolEnd = ends + gap;
    if (now < coolEnd) return { name: "cool", remainMs: coolEnd - now };
    return { name: "idle", remainMs: 0 };
  }

  function formatRemain(ms) {
    var total = Math.max(0, Math.ceil(Number(ms) / 1000));
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }

  var api = {
    LINES: LINES,
    DEFAULTS: DEFAULTS,
    configOf: configOf,
    isLive: isLive,
    phase: phase,
    formatRemain: formatRemain
  };

  root.MindsetCall = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

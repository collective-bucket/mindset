"use strict";

var assert = require("assert");
var sim = require("../public/assets/sim.js");

var NOW = Date.parse("2026-10-16T12:00:00.000Z");
var LIVE = new Date(NOW + 3 * 86400000).toISOString();
var DEAD = new Date(NOW - 86400000).toISOString();

function fish(uid, number, base, extra) {
  return Object.assign(
    {
      uid: uid,
      number: number,
      sim: /^sim/.test(uid),
      root: uid === "rootuid",
      scores: { agency: base, communion: base, codeClarity: base, redemption: base },
      deep: { codeGap: base, authorityLean: base, desireSplit: base, shadowDistance: base },
      closed: /^sim/.test(uid) ? { desireScript: "Text of " + uid } : {}
    },
    extra || {}
  );
}

function world(extra) {
  return Object.assign(
    {
      now: NOW,
      fish: [fish("rootuid", 1, 50), fish("sim2", 2, 52), fish("sim3", 3, 55), fish("sim4", 4, 95)],
      tails: [],
      glints: [],
      requests: [],
      members: []
    },
    extra || {}
  );
}

function kinds(plan) {
  return plan.actions.map(function (action) {
    return action.type;
  });
}

// Nearby fish only: sim4 is far away from everyone.
assert.ok(sim.distance(fish("a", 5, 50), fish("b", 6, 55)) === 5);
assert.strictEqual(sim.distance(fish("a", 5, 50), { scores: { agency: 50 } }), Infinity, "needs two shared axes");
assert.strictEqual(sim.matchScore(fish("a", 5, 50), fish("b", 6, 60)), 90);
assert.strictEqual(sim.matchScore({ scores: {}, deep: {} }, fish("b", 6, 60)), 0);

// Stage 1: tails only. Nothing else can happen in the first cycle.
var first = sim.planTick(world(), { tailsPerTick: 2, radius: 35, seed: 7 }, 1);
assert.deepStrictEqual(Object.keys(first.summary).map(function (key) { return first.summary[key]; }).slice(1), [0, 0, 0, 0]);
assert.ok(first.summary.tails > 0);
first.actions.forEach(function (action) {
  assert.strictEqual(action.type, "tail");
  assert.notStrictEqual(action.to, "sim4", "far fish are not nearby");
});
assert.ok(
  first.actions.every(function (action) { return /^sim/.test(action.from); }),
  "only test fish act"
);
assert.ok(
  first.actions.every(function (action) { return action.from !== action.to; }),
  "no self tails"
);

// Determinism: the same world, config and tick give the same plan.
var again = sim.planTick(world(), { tailsPerTick: 2, radius: 35, seed: 7 }, 1);
assert.deepStrictEqual(again, first);

// The per-cycle and total tail limits hold.
var limited = sim.planTick(world(), { tailsPerTick: 1, radius: 100, seed: 3 }, 1);
var perFish = {};
limited.actions.forEach(function (action) {
  perFish[action.from] = (perFish[action.from] || 0) + 1;
});
Object.keys(perFish).forEach(function (uid) {
  assert.strictEqual(perFish[uid], 1);
});
var capped = sim.planTick(
  world({ tails: [{ from: "sim2", to: "rootuid" }, { from: "sim2", to: "sim3" }] }),
  { tailsPerTick: 5, maxTails: 2, radius: 100 },
  1
);
assert.ok(!capped.actions.some(function (action) { return action.from === "sim2"; }), "maxTails reached");

// Existing tails are not repeated; root can be left out.
var repeat = sim.planTick(world({ tails: [{ from: "sim2", to: "sim3" }] }), { tailsPerTick: 5, radius: 100 }, 1);
assert.ok(!repeat.actions.some(function (action) { return action.from === "sim2" && action.to === "sim3"; }));
var noRoot = sim.planTick(world(), { tailsPerTick: 5, radius: 100, includeRoot: false }, 1);
assert.ok(!noRoot.actions.some(function (action) { return action.to === "rootuid"; }));
var withRoot = sim.planTick(world(), { tailsPerTick: 5, radius: 100, includeRoot: true }, 1);
assert.ok(withRoot.actions.some(function (action) { return action.to === "rootuid"; }));

// Real fish other than root are never approached.
var strangers = world({ fish: world().fish.concat([fish("realbob", 9, 52)]) });
var approach = sim.planTick(strangers, { tailsPerTick: 10, radius: 100 }, 1);
assert.ok(!approach.actions.some(function (action) { return action.to === "realbob"; }));

// Stage 2: a tailed sim shines one of its own closed fields, once.
var tailed = world({ tails: [{ from: "rootuid", to: "sim2" }, { from: "sim3", to: "sim2" }] });
var shine = sim.planTick(tailed, { tailsPerTick: 0, shineChance: 1 }, 2);
assert.deepStrictEqual(kinds(shine), ["shine", "shine"]);
shine.actions.forEach(function (action) {
  assert.strictEqual(action.from, "sim2");
  assert.strictEqual(action.field, "desireScript");
});
var none = sim.planTick(tailed, { tailsPerTick: 0, shineChance: 0 }, 2);
assert.deepStrictEqual(none.actions, []);
var alreadyShown = sim.planTick(
  world({
    tails: [{ from: "sim3", to: "sim2" }],
    glints: [{ from: "sim2", to: "sim3", field: "desireScript", text: "x", expiresAt: LIVE }]
  }),
  { tailsPerTick: 0, shineChance: 1, threshold: 99 },
  2
);
assert.deepStrictEqual(alreadyShown.actions, [], "a live glint is not repeated");
var expired = sim.planTick(
  world({
    tails: [{ from: "sim3", to: "sim2" }],
    glints: [{ from: "sim2", to: "sim3", field: "desireScript", text: "x", expiresAt: DEAD }]
  }),
  { tailsPerTick: 0, shineChance: 1 },
  2
);
assert.deepStrictEqual(kinds(expired), ["shine"], "an expired glint is shone again");

// Stage 3: a match asks, a non-match does not.
var shown = world({ glints: [{ from: "sim2", to: "sim3", field: "desireScript", text: "x", expiresAt: LIVE }] });
var asks = sim.planTick(shown, { tailsPerTick: 0, shineChance: 0, threshold: 70 }, 3);
assert.deepStrictEqual(asks.actions, [{ type: "request", from: "sim3", to: "sim2", field: "desireScript" }]);
var strict = sim.planTick(shown, { tailsPerTick: 0, shineChance: 0, threshold: 99 }, 3);
assert.deepStrictEqual(strict.actions, [], "below the threshold nobody asks");
var farAway = world({ glints: [{ from: "sim4", to: "sim3", field: "desireScript", text: "x", expiresAt: LIVE }] });
assert.deepStrictEqual(sim.planTick(farAway, { tailsPerTick: 0, shineChance: 0 }, 3).actions, []);

// Two sims who both showed a scale: only the lower number asks.
var mutual = world({
  glints: [
    { from: "sim2", to: "sim3", field: "desireScript", text: "x", expiresAt: LIVE },
    { from: "sim3", to: "sim2", field: "desireScript", text: "x", expiresAt: LIVE }
  ]
});
var oneAsks = sim.planTick(mutual, { tailsPerTick: 0, shineChance: 0 }, 3);
assert.deepStrictEqual(oneAsks.actions, [{ type: "request", from: "sim2", to: "sim3", field: "desireScript" }]);

// A real fish (root) that showed a scale is asked too.
var rootShown = world({ glints: [{ from: "rootuid", to: "sim2", field: "desireScript", text: "x", expiresAt: LIVE }] });
assert.deepStrictEqual(sim.planTick(rootShown, { tailsPerTick: 0, shineChance: 0 }, 3).actions, [
  { type: "request", from: "sim2", to: "rootuid", field: "desireScript" }
]);

// Stage 4: requests are answered, and the pair is not touched twice in one cycle.
var asked = world({
  requests: [{ from: "sim3", to: "sim2", fromNumber: 3, toNumber: 2 }],
  glints: [{ from: "sim2", to: "sim3", field: "desireScript", text: "x", expiresAt: LIVE }],
  tails: [{ from: "sim3", to: "sim2" }]
});
var accept = sim.planTick(asked, { tailsPerTick: 0, shineChance: 1 }, 4);
assert.deepStrictEqual(accept.actions, [{ type: "accept", uid: "sim2", other: "sim3" }]);
var decline = sim.planTick(asked, { tailsPerTick: 0, shineChance: 1, threshold: 99 }, 4);
assert.deepStrictEqual(decline.actions, [{ type: "decline", uid: "sim2", other: "sim3" }]);
var rootAsked = world({ requests: [{ from: "rootuid", to: "sim2", fromNumber: 1, toNumber: 2 }] });
assert.deepStrictEqual(sim.planTick(rootAsked, { tailsPerTick: 0 }, 4).actions, [
  { type: "accept", uid: "sim2", other: "rootuid" }
]);
var inSchool = world({
  members: [{ uid: "sim2", other: "sim3" }, { uid: "sim3", other: "sim2" }],
  tails: [{ from: "sim3", to: "sim2" }]
});
assert.deepStrictEqual(sim.planTick(inSchool, { tailsPerTick: 0, shineChance: 1 }, 5).actions, []);
var noRetail = sim.planTick(inSchool, { tailsPerTick: 5, radius: 100 }, 5);
assert.ok(!noRetail.actions.some(function (action) {
  return (action.from === "sim2" && action.to === "sim3") || (action.from === "sim3" && action.to === "sim2");
}));

// One handshake needs four separate cycles.
var live = world({ fish: [fish("sim2", 2, 50), fish("sim3", 3, 55)] });
var log = [];
function apply(plan, state) {
  plan.actions.forEach(function (action) {
    if (action.type === "tail") state.tails.push({ from: action.from, to: action.to });
    if (action.type === "shine") {
      state.glints.push({ from: action.from, to: action.to, field: action.field, text: "x", expiresAt: LIVE });
    }
    if (action.type === "request") state.requests.push({ from: action.from, to: action.to });
    if (action.type === "accept") {
      state.requests = state.requests.filter(function (row) {
        return !(row.from === action.other && row.to === action.uid);
      });
      state.members.push({ uid: action.uid, other: action.other }, { uid: action.other, other: action.uid });
    }
  });
}
for (var tick = 1; tick <= 6; tick += 1) {
  var plan = sim.planTick(live, { tailsPerTick: 1, radius: 100, shineChance: 1, threshold: 60, seed: 1 }, tick);
  log.push(kinds(plan).join("+") || "-");
  apply(plan, live);
}
assert.strictEqual(log[0], "tail+tail");
assert.ok(/shine/.test(log[1]), "cycle 2 shines: " + log[1]);
assert.ok(log[2].indexOf("request") >= 0, "cycle 3 asks: " + log[2]);
assert.ok(log[3].indexOf("accept") >= 0, "cycle 4 accepts: " + log[3]);
assert.strictEqual(sim.computeStats(live).schools, 1);

// Writes follow the rules' shapes.
var writes = {
  create: function (path, data) { return { op: "create", path: path, data: data }; },
  set: function (path, data) { return { op: "set", path: path, data: data }; },
  remove: function (path) { return { op: "remove", path: path }; }
};
var w = world();
var tailWrites = sim.toWrites({ type: "tail", from: "sim2", to: "rootuid" }, w, writes, NOW);
assert.strictEqual(tailWrites[0].path, "tails/sim2_rootuid");
assert.strictEqual(tailWrites[0].data.toNumber, 1);
var shineWrites = sim.toWrites({ type: "shine", from: "sim2", to: "rootuid", field: "desireScript" }, w, writes, NOW);
assert.strictEqual(shineWrites[0].path, "glints/sim2_rootuid");
assert.strictEqual(shineWrites[0].data.text, "Text of sim2");
assert.ok(shineWrites[0].data.expiresAt instanceof Date);
assert.ok(shineWrites[0].data.expiresAt.getTime() - NOW <= 7 * 86400000);
var requestWrites = sim.toWrites({ type: "request", from: "sim2", to: "rootuid", field: "desireScript" }, w, writes, NOW);
assert.deepStrictEqual(requestWrites.map(function (row) { return row.path; }), ["seals/sim2_rootuid", "schoolRequests/sim2_rootuid"]);
var acceptWrites = sim.toWrites({ type: "accept", uid: "sim2", other: "rootuid" }, w, writes, NOW);
assert.deepStrictEqual(acceptWrites.map(function (row) { return row.path; }), [
  "schools/sim2/members/rootuid",
  "schools/rootuid/members/sim2",
  "schoolRequests/rootuid_sim2",
  "schoolRequests/sim2_rootuid",
  "seals/sim2_rootuid"
]);
assert.strictEqual(acceptWrites[0].data.number, 1);
assert.strictEqual(acceptWrites[1].data.number, 2);

// Stats.
var stats = sim.computeStats({
  now: NOW,
  fish: [fish("rootuid", 1, 50), fish("sim2", 2, 52), fish("sim3", 3, 55)],
  tails: [{ from: "sim2", to: "sim3" }, { from: "sim3", to: "sim2" }, { from: "rootuid", to: "sim3" }],
  glints: [
    { from: "sim3", to: "sim2", expiresAt: LIVE },
    { from: "sim2", to: "sim3", expiresAt: DEAD }
  ],
  requests: [{ from: "sim2", to: "sim3" }],
  members: []
});
assert.strictEqual(stats.fish, 3);
assert.strictEqual(stats.sims, 2);
assert.strictEqual(stats.real, 1);
assert.strictEqual(stats.tails, 3);
assert.strictEqual(stats.glintsLive, 1);
assert.strictEqual(stats.glintsExpired, 1);
assert.deepStrictEqual(
  [stats.funnel.tails, stats.funnel.shown, stats.funnel.asked, stats.funnel.joined],
  [3, 2, 1, 0]
);
assert.strictEqual(stats.schools, 0);

assert.strictEqual(sim.isSim("sim12"), true);
assert.strictEqual(sim.isSim("simulate"), false);
assert.strictEqual(sim.configOf({ tailsPerTick: 999 }).tailsPerTick, 10);

console.log("sim.test.js passed");

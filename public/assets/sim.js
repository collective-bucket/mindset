(function (root) {
  "use strict";

  // Pure simulation engine for the root screen. No DOM, no network.
  //
  // One cycle moves every handshake by one stage. Stages are evaluated against
  // the world as it was when the cycle began, so a pair can never skip ahead:
  //   tail -> glint (shine a scale) -> school request + seal -> accept.

  var OPEN_KEYS = ["agency", "communion", "codeClarity", "redemption"];
  var DEEP_KEYS = ["codeGap", "authorityLean", "desireSplit", "shadowDistance"];
  var CLOSED_FIELDS = ["unsayableAttitude", "desireScript", "disownedSelf"];
  // Six days leaves room for clock drift against the rules' seven-day cap.
  var GLINT_MS = 6 * 24 * 3600 * 1000;

  var DEFAULTS = {
    seed: 1,
    tailsPerTick: 2,
    maxTails: 8,
    shineChance: 0.7,
    threshold: 70,
    radius: 35,
    includeRoot: true
  };

  function number(value, fallback, min, max) {
    var n = Number(value);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function configOf(raw) {
    raw = raw || {};
    return {
      seed: Math.round(number(raw.seed, DEFAULTS.seed, 0, 1000000)),
      tailsPerTick: Math.round(number(raw.tailsPerTick, DEFAULTS.tailsPerTick, 0, 10)),
      maxTails: Math.round(number(raw.maxTails, DEFAULTS.maxTails, 1, 50)),
      shineChance: number(raw.shineChance, DEFAULTS.shineChance, 0, 1),
      threshold: number(raw.threshold, DEFAULTS.threshold, 0, 100),
      radius: number(raw.radius, DEFAULTS.radius, 0, 100),
      includeRoot: raw.includeRoot === undefined ? DEFAULTS.includeRoot : raw.includeRoot !== false
    };
  }

  function isSim(uid) {
    return /^sim[0-9]+$/.test(String(uid || ""));
  }

  // mulberry32: small, fast and reproducible.
  function makeRandom(seed, tick) {
    var state = (Math.imul(seed + 1, 2654435761) ^ Math.imul(tick + 1, 40503)) >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pair(a, b) {
    return a + "_" + b;
  }

  function unordered(a, b) {
    return a < b ? a + "|" + b : b + "|" + a;
  }

  function gapOver(a, b, keys) {
    var sum = 0;
    var n = 0;
    keys.forEach(function (key) {
      var x = a[key];
      var y = b[key];
      if (typeof x === "number" && typeof y === "number" && x >= 0 && y >= 0) {
        sum += Math.abs(x - y);
        n += 1;
      }
    });
    return { n: n, gap: n ? sum / n : Infinity };
  }

  // Nearby = the open scores sit close together (at least two shared axes).
  function distance(a, b) {
    var result = gapOver(a.scores || {}, b.scores || {}, OPEN_KEYS);
    return result.n >= 2 ? result.gap : Infinity;
  }

  // Match = 100 minus the mean gap over every shared score, open and closed.
  function matchScore(a, b) {
    var open = gapOver(a.scores || {}, b.scores || {}, OPEN_KEYS);
    var deep = gapOver(a.deep || {}, b.deep || {}, DEEP_KEYS);
    var n = open.n + deep.n;
    if (!n) return 0;
    var sum = (open.n ? open.gap * open.n : 0) + (deep.n ? deep.gap * deep.n : 0);
    return Math.round(100 - sum / n);
  }

  function closedKeys(fish) {
    var closed = fish.closed || {};
    return CLOSED_FIELDS.filter(function (key) {
      return typeof closed[key] === "string" && closed[key].trim().length > 0;
    });
  }

  function pickOne(list, random) {
    return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  }

  function shuffled(list, random) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i -= 1) {
      var j = Math.floor(random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function indexWorld(world) {
    var index = {
      byUid: {},
      tails: {},
      outTails: {},
      requests: {},
      glints: {},
      members: {},
      now: world.now || Date.now()
    };
    (world.fish || []).forEach(function (fish) {
      index.byUid[fish.uid] = fish;
    });
    (world.tails || []).forEach(function (row) {
      index.tails[pair(row.from, row.to)] = row;
      index.outTails[row.from] = (index.outTails[row.from] || 0) + 1;
    });
    (world.requests || []).forEach(function (row) {
      index.requests[pair(row.from, row.to)] = row;
    });
    (world.glints || []).forEach(function (row) {
      index.glints[pair(row.from, row.to)] = row;
    });
    (world.members || []).forEach(function (row) {
      index.members[pair(row.uid, row.other)] = true;
    });
    return index;
  }

  function liveGlint(index, from, to) {
    var glint = index.glints[pair(from, to)];
    return Boolean(glint && Date.parse(glint.expiresAt) > index.now);
  }

  function byNumber(a, b) {
    return a.number - b.number;
  }

  function planTick(world, rawConfig, tick) {
    var cfg = configOf(rawConfig);
    var random = makeRandom(cfg.seed, tick);
    var index = indexWorld(world);
    var sims = (world.fish || []).filter(function (fish) { return fish.sim; }).sort(byNumber);
    var touched = {};
    var actions = [];
    var summary = { tails: 0, shines: 0, requests: 0, accepts: 0, declines: 0 };

    function member(a, b) {
      return Boolean(index.members[pair(a, b)] || index.members[pair(b, a)]);
    }

    function claim(a, b) {
      touched[unordered(a, b)] = true;
    }

    function isTouched(a, b) {
      return Boolean(touched[unordered(a, b)]);
    }

    // 1. Answer requests: accept a match, decline the rest.
    sims.forEach(function (self) {
      (world.requests || [])
        .filter(function (row) { return row.to === self.uid; })
        .map(function (row) { return { row: row, from: index.byUid[row.from] }; })
        .filter(function (entry) { return entry.from; })
        .sort(function (a, b) { return byNumber(a.from, b.from); })
        .forEach(function (entry) {
          var other = entry.from;
          if (isTouched(self.uid, other.uid) || member(self.uid, other.uid)) return;
          claim(self.uid, other.uid);
          if (matchScore(self, other) >= cfg.threshold) {
            actions.push({ type: "accept", uid: self.uid, other: other.uid });
            summary.accepts += 1;
          } else {
            actions.push({ type: "decline", uid: self.uid, other: other.uid });
            summary.declines += 1;
          }
        });
    });

    // 2. Ask to join the school of whoever showed a scale and matches.
    function wantsToAsk(self, other) {
      return (
        liveGlint(index, other.uid, self.uid) &&
        !member(self.uid, other.uid) &&
        !index.requests[pair(self.uid, other.uid)] &&
        !index.requests[pair(other.uid, self.uid)] &&
        closedKeys(self).length > 0 &&
        matchScore(self, other) >= cfg.threshold
      );
    }

    sims.forEach(function (self) {
      (world.glints || [])
        .filter(function (row) { return row.to === self.uid; })
        .map(function (row) { return index.byUid[row.from]; })
        .filter(Boolean)
        .sort(byNumber)
        .forEach(function (other) {
          if (isTouched(self.uid, other.uid) || !wantsToAsk(self, other)) return;
          // Two sims asking each other at once: the lower number goes first.
          if (other.sim && other.number < self.number && wantsToAsk(other, self)) return;
          claim(self.uid, other.uid);
          actions.push({
            type: "request",
            from: self.uid,
            to: other.uid,
            field: pickOne(closedKeys(self), random)
          });
          summary.requests += 1;
        });
    });

    // 3. Shine one closed field for everyone who swims after me.
    sims.forEach(function (self) {
      var fields = closedKeys(self);
      if (!fields.length) return;
      (world.tails || [])
        .filter(function (row) { return row.to === self.uid; })
        .map(function (row) { return index.byUid[row.from]; })
        .filter(Boolean)
        .sort(byNumber)
        .forEach(function (other) {
          if (isTouched(self.uid, other.uid) || member(self.uid, other.uid)) return;
          if (liveGlint(index, self.uid, other.uid)) return;
          if (random() >= cfg.shineChance) return;
          claim(self.uid, other.uid);
          actions.push({
            type: "shine",
            from: self.uid,
            to: other.uid,
            field: pickOne(fields, random)
          });
          summary.shines += 1;
        });
    });

    // 4. Swim after the nearest fish that are not on my tail yet.
    sims.forEach(function (self) {
      var room = cfg.maxTails - (index.outTails[self.uid] || 0);
      var budget = Math.min(cfg.tailsPerTick, room);
      if (budget <= 0) return;
      var candidates = shuffled(world.fish || [], random)
        .filter(function (other) {
          if (other.uid === self.uid) return false;
          // Real fish are never approached, except root when allowed.
          if (!other.sim && !(cfg.includeRoot && other.root)) return false;
          if (index.tails[pair(self.uid, other.uid)] || member(self.uid, other.uid)) return false;
          return distance(self, other) <= cfg.radius;
        })
        .map(function (other) { return { other: other, d: distance(self, other) }; })
        .sort(function (a, b) { return a.d - b.d; });
      candidates.slice(0, budget).forEach(function (entry) {
        actions.push({ type: "tail", from: self.uid, to: entry.other.uid });
        summary.tails += 1;
      });
    });

    return { actions: actions, summary: summary };
  }

  // Which closed texts and deep readings this tick can actually use.
  // Tails only need the open scores already on the public mindset.
  function readsForTick(world) {
    var index = indexWorld(world);
    var closed = {};
    var deep = {};

    function fishOf(uid) {
      return index.byUid[uid];
    }

    function member(a, b) {
      return Boolean(index.members[pair(a, b)] || index.members[pair(b, a)]);
    }

    function openRequest(a, b) {
      return Boolean(index.requests[pair(a, b)] || index.requests[pair(b, a)]);
    }

    function markDeep(fish) {
      if (fish && (fish.sim || fish.root || fish.number === 1)) deep[fish.uid] = fish;
    }

    function markClosed(fish) {
      if (fish && fish.sim) closed[fish.uid] = fish;
    }

    (world.requests || []).forEach(function (row) {
      var self = fishOf(row.to);
      if (!self || !self.sim) return;
      markDeep(self);
      markDeep(fishOf(row.from));
    });

    (world.glints || []).forEach(function (row) {
      if (!liveGlint(index, row.from, row.to)) return;
      var self = fishOf(row.to);
      if (!self || !self.sim) return;
      if (member(self.uid, row.from) || openRequest(self.uid, row.from)) return;
      markClosed(self);
      markDeep(self);
      markDeep(fishOf(row.from));
    });

    (world.tails || []).forEach(function (row) {
      var self = fishOf(row.to);
      if (!self || !self.sim) return;
      if (member(self.uid, row.from) || openRequest(self.uid, row.from)) return;
      if (liveGlint(index, self.uid, row.from)) return;
      markClosed(self);
    });

    return {
      closed: Object.keys(closed).map(function (uid) { return closed[uid]; }),
      deep: Object.keys(deep).map(function (uid) { return deep[uid]; })
    };
  }

  // Turns one action into Firestore writes. Callers batch these into commits.
  function toWrites(action, world, writes, nowMs) {
    var byUid = {};
    (world.fish || []).forEach(function (fish) {
      byUid[fish.uid] = fish;
    });
    var nowIso = new Date(nowMs).toISOString();

    if (action.type === "tail") {
      var tailFrom = byUid[action.from];
      var tailTo = byUid[action.to];
      return [
        writes.create("tails/" + pair(action.from, action.to), {
          from: action.from,
          to: action.to,
          fromNumber: tailFrom.number,
          toNumber: tailTo.number,
          createdAt: nowIso
        })
      ];
    }

    if (action.type === "shine") {
      var shiner = byUid[action.from];
      var shown = byUid[action.to];
      return [
        writes.set("glints/" + pair(action.from, action.to), {
          from: action.from,
          to: action.to,
          fromNumber: shiner.number,
          toNumber: shown.number,
          field: action.field,
          text: shiner.closed[action.field],
          createdAt: nowIso,
          expiresAt: new Date(nowMs + GLINT_MS)
        })
      ];
    }

    if (action.type === "request") {
      var asker = byUid[action.from];
      var asked = byUid[action.to];
      var id = pair(action.from, action.to);
      return [
        writes.set("seals/" + id, {
          from: action.from,
          to: action.to,
          fromNumber: asker.number,
          toNumber: asked.number,
          field: action.field,
          text: asker.closed[action.field],
          createdAt: nowIso
        }),
        writes.create("schoolRequests/" + id, {
          from: action.from,
          to: action.to,
          fromNumber: asker.number,
          toNumber: asked.number,
          field: action.field,
          createdAt: nowIso
        })
      ];
    }

    if (action.type === "accept") {
      var self = byUid[action.uid];
      var other = byUid[action.other];
      return [
        writes.create("schools/" + self.uid + "/members/" + other.uid, {
          uid: other.uid,
          number: other.number,
          since: nowIso
        }),
        writes.create("schools/" + other.uid + "/members/" + self.uid, {
          uid: self.uid,
          number: self.number,
          since: nowIso
        }),
        writes.remove("schoolRequests/" + pair(other.uid, self.uid)),
        writes.remove("schoolRequests/" + pair(self.uid, other.uid)),
        writes.remove("seals/" + pair(self.uid, other.uid))
      ];
    }

    if (action.type === "decline") {
      return [
        writes.remove("schoolRequests/" + pair(action.other, action.uid)),
        writes.remove("seals/" + pair(action.other, action.uid))
      ];
    }

    return [];
  }

  function percent(part, whole) {
    return whole ? Math.round((part / whole) * 100) : 0;
  }

  function computeStats(world) {
    var index = indexWorld(world);
    var fish = world.fish || [];
    var sims = fish.filter(function (row) { return row.sim; }).length;

    var glintsLive = 0;
    var glintsExpired = 0;
    (world.glints || []).forEach(function (row) {
      if (Date.parse(row.expiresAt) > index.now) glintsLive += 1;
      else glintsExpired += 1;
    });

    var schoolPairs = {};
    var inSchool = {};
    (world.members || []).forEach(function (row) {
      schoolPairs[unordered(row.uid, row.other)] = true;
      inSchool[row.uid] = (inSchool[row.uid] || 0) + 1;
    });
    var schoolFish = Object.keys(inSchool).length;
    var memberLinks = (world.members || []).length;

    var shown = 0;
    var asked = 0;
    var joined = 0;
    (world.tails || []).forEach(function (row) {
      if (!index.glints[pair(row.to, row.from)]) return;
      shown += 1;
      var isMember = index.members[pair(row.from, row.to)];
      if (isMember || index.requests[pair(row.from, row.to)]) asked += 1;
      if (isMember) joined += 1;
    });
    var tails = (world.tails || []).length;

    return {
      fish: fish.length,
      sims: sims,
      real: fish.length - sims,
      tails: tails,
      glintsLive: glintsLive,
      glintsExpired: glintsExpired,
      requests: (world.requests || []).length,
      schools: Object.keys(schoolPairs).length,
      schoolFish: schoolFish,
      avgSchool: schoolFish ? Math.round((memberLinks / schoolFish) * 10) / 10 : 0,
      funnel: {
        tails: tails,
        shown: shown,
        asked: asked,
        joined: joined,
        shownRate: percent(shown, tails),
        askedRate: percent(asked, shown),
        joinedRate: percent(joined, asked)
      }
    };
  }

  var api = {
    DEFAULTS: DEFAULTS,
    OPEN_KEYS: OPEN_KEYS,
    DEEP_KEYS: DEEP_KEYS,
    CLOSED_FIELDS: CLOSED_FIELDS,
    configOf: configOf,
    isSim: isSim,
    distance: distance,
    matchScore: matchScore,
    planTick: planTick,
    readsForTick: readsForTick,
    toWrites: toWrites,
    computeStats: computeStats
  };

  root.MindsetSim = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

(function () {
  "use strict";

  var social = window.MindsetSocial;
  var i18n = window.MindsetI18n;
  var t = i18n.t;

  var CHANNELS = [
    "onTail",
    "trailGlint",
    "schoolRequest",
    "schoolMember",
    "requestDeclined",
    "requestWithdrawn",
    "distanced"
  ];
  var CURRENT_CHANNELS = ["onTail", "trailGlint", "requestWithdrawn", "distanced"];
  var SCHOOL_CHANNELS = ["schoolRequest", "schoolMember", "requestDeclined"];
  var SIGNAL_CHANNELS = ["requestDeclined", "requestWithdrawn", "distanced"];

  var state = {
    uid: "",
    events: {
      onTail: [],
      trailGlint: [],
      schoolRequest: [],
      schoolMember: [],
      requestDeclined: [],
      requestWithdrawn: [],
      distanced: []
    },
    counts: {
      onTail: 0,
      trailGlint: 0,
      schoolRequest: 0,
      schoolMember: 0,
      requestDeclined: 0,
      requestWithdrawn: 0,
      distanced: 0
    }
  };

  function storageKey(uid) {
    return "mindset.notices." + uid;
  }

  function passedKey(uid) {
    return "mindset.passedGlints." + uid;
  }

  function emptySeen() {
    var out = {};
    CHANNELS.forEach(function (channel) {
      out[channel] = {};
    });
    return out;
  }

  function loadSeen(uid) {
    try {
      var raw = localStorage.getItem(storageKey(uid));
      if (!raw) return emptySeen();
      var parsed = JSON.parse(raw);
      var out = emptySeen();
      CHANNELS.forEach(function (channel) {
        if (parsed && parsed[channel] && typeof parsed[channel] === "object") {
          out[channel] = parsed[channel];
        }
      });
      return out;
    } catch (error) {
      return emptySeen();
    }
  }

  function saveSeen(uid, seen) {
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify(seen));
    } catch (error) {
      /* ignore quota */
    }
  }

  function loadPassed(uid) {
    try {
      var raw = localStorage.getItem(passedKey(uid));
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function savePassed(uid, map) {
    try {
      localStorage.setItem(passedKey(uid), JSON.stringify(map));
    } catch (error) {
      /* ignore */
    }
  }

  function markPassedGlint(uid, shinerUid, stamp) {
    if (!uid || !shinerUid) return;
    var map = loadPassed(uid);
    map[String(shinerUid)] = String(stamp || "1");
    savePassed(uid, map);
  }

  function isPassedGlint(uid, shinerUid, stamp) {
    var map = loadPassed(uid);
    return map[String(shinerUid)] === String(stamp || "1");
  }

  function quiet(promise) {
    return promise.catch(function () {
      return [];
    });
  }

  function countUnseen(events, seenMap) {
    var n = 0;
    events.forEach(function (event) {
      if (!seenMap || seenMap[event.id] !== event.stamp) n += 1;
    });
    return n;
  }

  function recount(uid) {
    var seen = loadSeen(uid);
    CHANNELS.forEach(function (channel) {
      state.counts[channel] = countUnseen(state.events[channel], seen[channel]);
    });
  }

  function sum(channels) {
    var total = 0;
    channels.forEach(function (channel) {
      total += state.counts[channel] || 0;
    });
    return total;
  }

  function ensureBadge(host) {
    if (!host) return null;
    var badge = host.querySelector(":scope > .notice-badge");
    if (!badge) {
      badge = document.createElement("small");
      badge.className = "notice-badge";
      badge.hidden = true;
      host.appendChild(badge);
    }
    return badge;
  }

  function paintBadge(host, count) {
    var badge = ensureBadge(host);
    if (!badge) return;
    if (!count) {
      badge.hidden = true;
      badge.textContent = "";
      badge.removeAttribute("aria-label");
      return;
    }
    badge.hidden = false;
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.setAttribute("aria-label", t("notices.count", { n: count }));
  }

  function paintGamebar() {
    paintBadge(document.querySelector(".gamebar-current"), sum(CURRENT_CHANNELS));
    paintBadge(document.querySelector(".gamebar-school"), sum(SCHOOL_CHANNELS));
  }

  function paintTabs() {
    paintBadge(
      document.querySelector("#tab-current-ontail"),
      state.counts.onTail + state.counts.requestWithdrawn + state.counts.distanced
    );
    paintBadge(document.querySelector("#tab-current-trail"), state.counts.trailGlint);
    paintBadge(document.querySelector("#tab-school-incoming"), state.counts.schoolRequest);
    paintBadge(document.querySelector("#tab-school-members"), state.counts.schoolMember);
    paintBadge(document.querySelector("#tab-school-outgoing"), state.counts.requestDeclined);
  }

  function paint() {
    paintGamebar();
    paintTabs();
  }

  function markSeen(channel) {
    if (!state.uid || CHANNELS.indexOf(channel) < 0) return;
    var seen = loadSeen(state.uid);
    var next = {};
    var toClear = [];
    state.events[channel].forEach(function (event) {
      next[event.id] = event.stamp;
      if (event.signalId) toClear.push(event.signalId);
    });
    seen[channel] = next;
    saveSeen(state.uid, seen);
    state.counts[channel] = 0;
    paint();
    if (SIGNAL_CHANNELS.indexOf(channel) >= 0 && social.clearSignal && state.session) {
      toClear.forEach(function (id) {
        social.clearSignal(state.session, id).catch(function () {});
      });
    }
  }

  async function refresh(session) {
    if (!session || !session.uid || !social) {
      state.uid = "";
      state.session = null;
      CHANNELS.forEach(function (channel) {
        state.events[channel] = [];
        state.counts[channel] = 0;
      });
      paint();
      return state.counts;
    }

    state.uid = session.uid;
    state.session = session;
    var lists = await Promise.all([
      quiet(social.tailersOf(session)),
      quiet(social.trailOf(session)),
      quiet(social.glintsToward(session)),
      quiet(social.members(session)),
      quiet(social.incoming(session)),
      quiet(social.signalsToward(session))
    ]);

    var memberUids = {};
    lists[3].forEach(function (row) {
      memberUids[row.uid || row.id] = true;
    });

    var trailUids = {};
    lists[1].forEach(function (row) {
      if (!memberUids[row.to]) trailUids[row.to] = true;
    });

    state.events.onTail = lists[0]
      .filter(function (row) {
        return row.from && !memberUids[row.from];
      })
      .map(function (row) {
        return { id: String(row.from), stamp: String(row.createdAt || row.id || row.from) };
      });

    state.events.trailGlint = lists[2]
      .filter(function (row) {
        if (!social.glintLive(row) || !row.from || !trailUids[row.from]) return false;
        var stamp = String(row.createdAt || row.expiresAt || row.from);
        return !isPassedGlint(session.uid, row.from, stamp);
      })
      .map(function (row) {
        return { id: String(row.from), stamp: String(row.createdAt || row.expiresAt || row.from) };
      });

    state.events.schoolRequest = lists[4]
      .filter(function (row) {
        return row.from;
      })
      .map(function (row) {
        return { id: String(row.from), stamp: String(row.createdAt || row.from) };
      });

    state.events.schoolMember = lists[3]
      .filter(function (row) {
        return row.uid || row.id;
      })
      .map(function (row) {
        var id = String(row.uid || row.id);
        return { id: id, stamp: String(row.since || id) };
      });

    state.events.requestDeclined = [];
    state.events.requestWithdrawn = [];
    state.events.distanced = [];
    lists[5].forEach(function (row) {
      var id = String(row.id || row.from + "_" + row.kind + "_" + row.createdAt);
      var event = {
        id: id,
        stamp: String(row.createdAt || id),
        signalId: row.id
      };
      if (row.kind === "requestDeclined") state.events.requestDeclined.push(event);
      else if (row.kind === "requestWithdrawn" || row.kind === "joinPassed") {
        state.events.requestWithdrawn.push(event);
      } else if (row.kind === "distanced") state.events.distanced.push(event);
    });

    recount(session.uid);
    paint();
    return state.counts;
  }

  function counts() {
    return {
      onTail: state.counts.onTail,
      trailGlint: state.counts.trailGlint,
      schoolRequest: state.counts.schoolRequest,
      schoolMember: state.counts.schoolMember,
      requestDeclined: state.counts.requestDeclined,
      requestWithdrawn: state.counts.requestWithdrawn,
      distanced: state.counts.distanced,
      current: sum(CURRENT_CHANNELS),
      school: sum(SCHOOL_CHANNELS)
    };
  }

  window.MindsetNotices = {
    refresh: refresh,
    markSeen: markSeen,
    paint: paint,
    paintGamebar: paintGamebar,
    paintTabs: paintTabs,
    counts: counts,
    markPassedGlint: markPassedGlint,
    isPassedGlint: isPassedGlint
  };
})();

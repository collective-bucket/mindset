(function () {
  "use strict";

  var ui = window.MindsetUi;
  var fs = window.MindsetFirestore;
  var store = window.MindsetStore;
  var sim = window.MindsetSim;
  var call = window.MindsetCall;
  var t = window.MindsetI18n.t;

  var PARALLEL = 6;
  var RESET_BATCH = 10;
  var LOG_LIMIT = 8;
  var WRITE_LIMIT = 400;
  var GLINT_MS = 6 * 24 * 3600 * 1000;

  // Closed texts and deep readings of test fish never change during a visit.
  var cache = { texts: {}, deep: {} };

  function escapeHtml(value) {
    return ui.escapeHtml(value);
  }

  async function pool(items, size, worker) {
    var next = 0;
    var runners = [];
    async function run() {
      while (next < items.length) {
        var index = next;
        next += 1;
        await worker(items[index], index);
      }
    }
    for (var i = 0; i < Math.min(size, items.length); i += 1) runners.push(run());
    await Promise.all(runners);
  }

  // Missing documents answer 403 under the rules (nothing to evaluate), so any
  // refusal reads as "not there".
  async function softGet(path, token) {
    try {
      return await fs.get(path, token);
    } catch (error) {
      if (fs.isPermission(error)) return null;
      throw error;
    }
  }

  function queryAll(collection, token, options) {
    return fs.runQuery({ from: [{ collectionId: collection }], limit: 5000 }, token, null, options);
  }

  function rootNotice(error) {
    if (fs.isPermission(error)) return t("common.permission");
    if (error && (error.status === 429 || /quota exceeded/i.test(String(error.message || "")))) {
      return t("common.quota");
    }
    if (error && error.message) return error.message;
    return ui.errorText(error);
  }

  function closedTexts(priv) {
    var texts = {};
    sim.CLOSED_FIELDS.forEach(function (key) {
      if (priv && typeof priv[key] === "string" && priv[key].trim()) texts[key] = priv[key];
    });
    return texts;
  }

  function deepScores(deep) {
    if (!deep) return null;
    return {
      codeGap: deep.codeGap,
      authorityLean: deep.authorityLean,
      desireSplit: deep.desireSplit,
      shadowDistance: deep.shadowDistance
    };
  }

  // The dashboard only needs public scores, tails, requests, schools and glints.
  // Closed texts and deep readings are loaded later, and only for a tick.
  async function loadWorld(session) {
    var token = session.idToken;
    var mindsets = await fs.runQuery(
      { from: [{ collectionId: "mindsets" }], where: fs.equals("published", true), limit: 2000 },
      token
    );
    var rootDoc = mindsets.filter(function (row) { return row.number === 1; })[0];
    if (!rootDoc) {
      rootDoc = await softGet("mindsets/1", token);
      if (rootDoc) mindsets.push(rootDoc);
    }

    var fish = mindsets.map(function (row) {
      return {
        uid: row.ownerUid,
        number: row.number,
        headline: row.headline || "",
        blurb: row.blurb || "",
        sim: sim.isSim(row.ownerUid),
        root: row.number === 1,
        scores: {
          agency: row.agency,
          communion: row.communion,
          codeClarity: row.codeClarity,
          redemption: row.redemption
        },
        deep: null,
        closed: {}
      };
    });

    var rows = await Promise.all([
      queryAll("tails", token),
      queryAll("schoolRequests", token),
      fs.runQuery(
        { from: [{ collectionId: "members", allDescendants: true }], limit: 5000 },
        token,
        null,
        { paths: true }
      )
    ]);
    var tails = rows[0];
    var requests = rows[1];
    var members = rows[2].map(function (row) {
      var parts = String(row._path).split("/");
      return { uid: parts[1], other: parts[3], number: row.number };
    });

    var glints = await queryAll("glints", token);

    return {
      now: Date.now(),
      fish: fish,
      tails: tails,
      glints: glints,
      requests: requests,
      members: members
    };
  }

  async function hydrateForTick(world, token) {
    var need = sim.readsForTick(world);
    await pool(need.closed, 8, async function (row) {
      if (!(row.number in cache.texts)) {
        cache.texts[row.number] = closedTexts(await softGet("privateMindsets/" + row.number, token));
      }
      row.closed = cache.texts[row.number];
    });
    await pool(need.deep, 8, async function (row) {
      if (!(row.number in cache.deep)) {
        cache.deep[row.number] = deepScores(await softGet("deepReadings/" + row.number, token));
      }
      row.deep = cache.deep[row.number];
    });
  }

  function applyPlanned(world, actions, nowMs) {
    var byUid = {};
    (world.fish || []).forEach(function (row) {
      byUid[row.uid] = row;
    });
    var nowIso = new Date(nowMs).toISOString();
    actions.forEach(function (action) {
      if (action.type === "tail") {
        world.tails.push({
          from: action.from,
          to: action.to,
          fromNumber: byUid[action.from].number,
          toNumber: byUid[action.to].number,
          createdAt: nowIso
        });
      } else if (action.type === "shine") {
        var shiner = byUid[action.from];
        world.glints.push({
          from: action.from,
          to: action.to,
          fromNumber: shiner.number,
          toNumber: byUid[action.to].number,
          field: action.field,
          text: shiner.closed[action.field],
          createdAt: nowIso,
          expiresAt: new Date(nowMs + GLINT_MS).toISOString()
        });
      } else if (action.type === "request") {
        world.requests.push({
          from: action.from,
          to: action.to,
          field: action.field,
          createdAt: nowIso
        });
      } else if (action.type === "accept") {
        var self = byUid[action.uid];
        var other = byUid[action.other];
        world.members.push({ uid: self.uid, other: other.uid, number: other.number });
        world.members.push({ uid: other.uid, other: self.uid, number: self.number });
        world.requests = world.requests.filter(function (row) {
          var pair = (row.from === self.uid && row.to === other.uid) || (row.from === other.uid && row.to === self.uid);
          return !pair;
        });
      } else if (action.type === "decline") {
        world.requests = world.requests.filter(function (row) {
          return !(row.from === action.other && row.to === action.uid);
        });
      }
    });
    world.now = nowMs;
  }

  async function commitPlanned(actions, world, nowMs, token) {
    var done = 0;
    var skipped = 0;
    var failed = 0;
    var firstError = null;
    var applied = [];
    var batch = [];
    var writes = [];

    async function settleOne(action, actionWrites) {
      try {
        await fs.commit(actionWrites, token);
        done += 1;
        applied.push(action);
      } catch (error) {
        if (fs.isConflict(error)) skipped += 1;
        else {
          failed += 1;
          firstError = firstError || error;
        }
      }
    }

    async function flush() {
      if (!batch.length) return;
      var actionsInBatch = batch;
      var writesInBatch = writes;
      batch = [];
      writes = [];
      try {
        await fs.commit(writesInBatch, token);
        done += actionsInBatch.length;
        applied = applied.concat(actionsInBatch);
      } catch (error) {
        if (actionsInBatch.length === 1) {
          if (fs.isConflict(error)) skipped += 1;
          else {
            failed += 1;
            firstError = firstError || error;
          }
          return;
        }
        var offset = 0;
        for (var i = 0; i < actionsInBatch.length; i += 1) {
          var count = sim.toWrites(actionsInBatch[i], world, fs.writes, nowMs).length;
          await settleOne(actionsInBatch[i], writesInBatch.slice(offset, offset + count));
          offset += count;
        }
      }
    }

    for (var i = 0; i < actions.length; i += 1) {
      var actionWrites = sim.toWrites(actions[i], world, fs.writes, nowMs);
      if (!actionWrites.length) continue;
      if (writes.length && writes.length + actionWrites.length > WRITE_LIMIT) await flush();
      batch.push(actions[i]);
      writes = writes.concat(actionWrites);
    }
    await flush();
    return { done: done, skipped: skipped, failed: failed, firstError: firstError, applied: applied };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var simStatus = document.querySelector("#sim-status");
    var runButton = document.querySelector("#sim-run");
    var session = null;
    var rootOwnerUid = "";
    var state = { tick: 0, config: sim.configOf({}) };
    var broadcast = call.configOf({});
    var busy = false;
    var simQuery = "";

    function selectRootSection(name) {
      var panes = {
        lake: document.querySelector("#pane-root-lake"),
        sim: document.querySelector("#pane-root-sim"),
        fish: document.querySelector("#pane-root-fish")
      };
      var tabs = {
        lake: document.querySelector("#tab-root-lake"),
        sim: document.querySelector("#tab-root-sim"),
        fish: document.querySelector("#tab-root-fish")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        panes[key].hidden = !on;
        tabs[key].setAttribute("aria-selected", String(on));
      });
    }

    document.querySelector(".root-stick .depth-tabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-root-section]");
      if (!tab) return;
      selectRootSection(tab.getAttribute("data-root-section"));
    });

    function paintHeader() {
      var title = document.querySelector("#title");
      if (title) title.innerHTML = ui.mindsetIdTitle(1, t("root.title"), rootOwnerUid);
    }

    function renderMeta(stats) {
      if (stats) {
        document.querySelector("#meta-real").textContent = t("root.metaReal", { n: stats.real });
        document.querySelector("#meta-sim").textContent = t("root.metaSim", { n: stats.sims });
        document.querySelector("#meta-school").textContent = t("root.metaSchool", { n: stats.schools });
      }
      document.querySelector("#meta-tick").textContent = t("root.metaTick", { n: state.tick });
    }

    function number(value) {
      return String(value);
    }

    function renderStats(stats) {
      var cells = [
        ["fish", stats.fish],
        ["fishReal", stats.real],
        ["fishSim", stats.sims],
        ["tails", stats.tails],
        ["glintsLive", stats.glintsLive],
        ["glintsExpired", stats.glintsExpired],
        ["requests", stats.requests],
        ["schools", stats.schools],
        ["schoolFish", stats.schoolFish],
        ["avgSchool", stats.avgSchool]
      ];
      document.querySelector("#stats").innerHTML = cells
        .map(function (cell) {
          return (
            '<div class="stat"><dd>' +
            escapeHtml(number(cell[1])) +
            "</dd><dt>" +
            escapeHtml(t("root.stat." + cell[0])) +
            "</dt></div>"
          );
        })
        .join("");

      var f = stats.funnel;
      var steps = [
        ["tails", f.tails, 100],
        ["shown", f.shown, f.shownRate],
        ["asked", f.asked, f.askedRate],
        ["joined", f.joined, f.joinedRate]
      ];
      document.querySelector("#funnel").innerHTML = steps
        .map(function (step, index) {
          var width = f.tails ? Math.round((step[1] / f.tails) * 100) : 0;
          var perFish = stats.fish ? Math.round((f.tails / stats.fish) * 10) / 10 : 0;
          var rate =
            '<div class="bar-poles"><span></span><span>' +
            escapeHtml(index ? t("root.funnelRate", { n: step[2] }) : t("root.funnelBase", { n: perFish })) +
            "</span></div>";
          return (
            '<div class="bar-row"><div class="bar-label"><span>' +
            escapeHtml(t("root.funnel." + step[0])) +
            "</span><span>" +
            escapeHtml(number(step[1])) +
            '</span></div><div class="bar-track"><div class="bar-fill" style="width:' +
            width +
            '%"></div></div>' +
            rate +
            "</div>"
          );
        })
        .join("");
      renderMeta(stats);
    }

    function fillConfig(config) {
      Object.keys(config).forEach(function (key) {
        var input = document.querySelector("#cfg-" + key);
        if (!input) return;
        if (input.type === "checkbox") input.checked = Boolean(config[key]);
        else input.value = config[key];
      });
    }

    function fillBroadcast(config) {
      document.querySelector("#cfg-durationSec").value = config.durationSec;
      document.querySelector("#cfg-cooldownSec").value = config.cooldownSec;
    }

    function readBroadcast() {
      return call.configOf({
        durationSec: document.querySelector("#cfg-durationSec").value,
        cooldownSec: document.querySelector("#cfg-cooldownSec").value
      });
    }

    function readConfig() {
      var raw = {};
      Object.keys(sim.DEFAULTS).forEach(function (key) {
        var input = document.querySelector("#cfg-" + key);
        if (!input) return;
        raw[key] = input.type === "checkbox" ? input.checked : input.value;
      });
      return sim.configOf(raw);
    }

    function renderTick() {
      document.querySelector("#sim-tick").textContent = t("root.simTick", { n: state.tick });
      renderMeta(null);
    }

    async function renderLog() {
      var rows = [];
      try {
        rows = await fs.runQuery(
          {
            from: [{ collectionId: "simTicks" }],
            orderBy: [{ field: { fieldPath: "tick" }, direction: "DESCENDING" }],
            limit: LOG_LIMIT
          },
          session.idToken
        );
      } catch (error) {
        rows = [];
      }
      var list = document.querySelector("#sim-log");
      if (!rows.length) {
        list.textContent = t("root.simLogEmpty");
        return;
      }
      list.textContent = rows
        .map(function (row) {
          var line = t("root.logLine", {
            n: row.tick,
            tails: row.tails || 0,
            shines: row.shines || 0,
            requests: row.requests || 0,
            accepts: row.accepts || 0,
            declines: row.declines || 0
          });
          var extra = [];
          if (row.skipped) extra.push(t("root.skipped", { n: row.skipped }));
          if (row.failed) extra.push(t("root.failed", { n: row.failed }));
          return line + (extra.length ? " · " + extra.join(" · ") : "");
        })
        .join("\n");
    }

    async function loadState() {
      var doc = await softGet("sim/state", session.idToken);
      state = {
        tick: doc && typeof doc.tick === "number" ? doc.tick : 0,
        config: sim.configOf(doc && doc.config)
      };
      fillConfig(state.config);
      broadcast = call.configOf(await softGet("lakeConfig/broadcast", session.idToken));
      fillBroadcast(broadcast);
      renderTick();
    }

    async function refresh() {
      var world = await loadWorld(session);
      renderStats(sim.computeStats(world));
      renderSimFish(world);
      await renderLog();
      return world;
    }

    function setBusy(next) {
      busy = next;
      ["#sim-run", "#sim-save", "#sim-reset"].forEach(function (selector) {
        document.querySelector(selector).disabled = next;
      });
      runButton.textContent = t(next ? "root.simRunning" : "root.simRun");
    }

    function stateDoc(tick, config) {
      return { tick: tick, seed: config.seed, config: config, updatedAt: new Date().toISOString() };
    }

    async function runCycle() {
      setBusy(true);
      ui.setStatus(simStatus, "");
      try {
        var world = await loadWorld(session);
        if (!world.fish.some(function (row) { return row.sim; })) {
          ui.setStatus(simStatus, t("root.simNone"));
          return;
        }
        await hydrateForTick(world, session.idToken);
        var config = readConfig();
        var tick = state.tick + 1;
        var plan = sim.planTick(world, config, tick);
        var now = Date.now();
        var result = await commitPlanned(plan.actions, world, now, session.idToken);
        var skipped = result.skipped;
        var failed = result.failed;

        var summary = plan.summary;
        await fs.commit(
          [
            fs.writes.set("simTicks/" + tick, {
              tick: tick,
              at: new Date(now).toISOString(),
              tails: summary.tails,
              shines: summary.shines,
              requests: summary.requests,
              accepts: summary.accepts,
              declines: summary.declines,
              skipped: skipped,
              failed: failed
            }),
            fs.writes.set("sim/state", stateDoc(tick, config))
          ],
          session.idToken
        );
        state = { tick: tick, config: config };
        renderTick();

        var message = t("root.simDone", {
          n: tick,
          tails: summary.tails,
          shines: summary.shines,
          requests: summary.requests,
          accepts: summary.accepts,
          declines: summary.declines
        });
        if (failed) message += " " + t("root.failed", { n: failed }) + " " + rootNotice(result.firstError);
        ui.setStatus(simStatus, message, failed ? "error" : "");
        applyPlanned(world, result.applied, now);
        renderStats(sim.computeStats(world));
        await renderLog();
      } catch (error) {
        ui.setStatus(simStatus, rootNotice(error), "error");
      } finally {
        setBusy(false);
      }
    }

    async function saveConfig() {
      setBusy(true);
      try {
        var config = readConfig();
        var nextBroadcast = readBroadcast();
        await fs.commit(
          [
            fs.writes.set("sim/state", stateDoc(state.tick, config)),
            fs.writes.set("lakeConfig/broadcast", nextBroadcast)
          ],
          session.idToken
        );
        state.config = config;
        broadcast = nextBroadcast;
        fillConfig(config);
        fillBroadcast(broadcast);
        ui.setStatus(simStatus, t("root.cfgSaved"));
      } catch (error) {
        ui.setStatus(simStatus, rootNotice(error), "error");
      } finally {
        setBusy(false);
      }
    }

    // Removes every tail, scale, pledge, request and membership that touches a test fish.
    async function resetSimulation() {
      if (!window.confirm(t("root.resetConfirm"))) return;
      setBusy(true);
      try {
        var world = await loadWorld(session);
        var pairs = {};
        function touch(a, b) {
          if (!sim.isSim(a) && !sim.isSim(b)) return;
          pairs[a < b ? a + "|" + b : b + "|" + a] = [a, b];
        }
        world.tails.forEach(function (row) { touch(row.from, row.to); });
        world.requests.forEach(function (row) { touch(row.from, row.to); });
        world.glints.forEach(function (row) { touch(row.from, row.to); });
        world.members.forEach(function (row) { touch(row.uid, row.other); });

        var removed = 0;
        await pool(Object.keys(pairs), PARALLEL, async function (key) {
          var a = pairs[key][0];
          var b = pairs[key][1];
          var ab = a + "_" + b;
          var ba = b + "_" + a;
          var list = [
            fs.writes.remove("glints/" + ab),
            fs.writes.remove("glints/" + ba),
            fs.writes.remove("seals/" + ab),
            fs.writes.remove("seals/" + ba),
            fs.writes.remove("schoolRequests/" + ab),
            fs.writes.remove("schoolRequests/" + ba),
            fs.writes.remove("schools/" + a + "/members/" + b),
            fs.writes.remove("schools/" + b + "/members/" + a),
            fs.writes.remove("tails/" + ab),
            fs.writes.remove("tails/" + ba)
          ];
          await fs.commit(list, session.idToken);
          removed += 1;
        });

        var logs = await fs.runQuery(
          { from: [{ collectionId: "simTicks" }], limit: 1000 },
          session.idToken
        );
        var batches = [];
        for (var i = 0; i < logs.length; i += RESET_BATCH) {
          batches.push(
            logs.slice(i, i + RESET_BATCH).map(function (row) {
              return fs.writes.remove("simTicks/" + row.id);
            })
          );
        }
        await pool(batches, PARALLEL, function (batch) {
          return fs.commit(batch, session.idToken);
        });

        var config = readConfig();
        await fs.commit([fs.writes.set("sim/state", stateDoc(0, config))], session.idToken);
        state = { tick: 0, config: config };
        renderTick();
        ui.setStatus(simStatus, t("root.resetDone", { n: removed }));
        await refresh();
      } catch (error) {
        ui.setStatus(simStatus, rootNotice(error), "error");
      } finally {
        setBusy(false);
      }
    }

    runButton.addEventListener("click", function () {
      if (!busy) runCycle();
    });
    document.querySelector("#sim-save").addEventListener("click", function () {
      if (!busy) saveConfig();
    });
    document.querySelector("#sim-reset").addEventListener("click", function () {
      if (!busy) resetSimulation();
    });
    document.querySelector("#sim-filter").addEventListener("input", function (event) {
      simQuery = event.target.value;
      applySimFilter();
    });
    document.querySelector("#sim-fish").addEventListener("click", function (event) {
      var button = event.target.closest("[data-enter-mind]");
      if (!button) return;
      var row = button.closest("[data-uid]");
      if (!row) return;
      button.disabled = true;
      store
        .setActingAs(row.getAttribute("data-uid"), row.getAttribute("data-number"))
        .then(function () {
          window.location.assign("/me");
        })
        .catch(function (error) {
          button.disabled = false;
          ui.setStatus(simStatus, rootNotice(error), "error");
        });
    });

    function authUid() {
      return (session && (session.authUid || session.uid)) || "";
    }

    async function isRoot() {
      var doc;
      try {
        doc = await fs.get("mindsets/1", session.idToken);
      } catch (error) {
        if (fs.isPermission(error)) return false;
        throw error;
      }
      if (!(doc && doc.ownerUid === authUid())) return false;
      rootOwnerUid = doc.ownerUid;
      return true;
    }

    function simSummaryDoc(row) {
      return {
        id: row.number,
        headline: row.headline,
        blurb: row.blurb,
        agency: row.scores.agency,
        communion: row.scores.communion,
        codeClarity: row.scores.codeClarity,
        redemption: row.scores.redemption
      };
    }

    function applySimFilter() {
      var query = simQuery.trim().toLocaleLowerCase();
      document.querySelectorAll("#sim-fish .person").forEach(function (row) {
        var hay = (row.getAttribute("data-filter") || "").toLocaleLowerCase();
        row.hidden = Boolean(query) && hay.indexOf(query) === -1;
      });
    }

    function renderSimFish(world) {
      var host = document.querySelector("#sim-fish");
      if (!host) return;
      var rows = (world.fish || []).filter(function (row) {
        return row.sim;
      });
      if (!rows.length) {
        host.innerHTML = '<p class="empty">' + ui.escapeHtml(t("root.simNone")) + "</p>";
        return;
      }
      host.innerHTML = rows
        .slice()
        .sort(function (a, b) {
          return a.number - b.number;
        })
        .map(function (row) {
          var title = row.headline ? String(row.headline).replace(/\.$/, "") : "#" + row.number;
          var blurb = ui.plainSummary(simSummaryDoc(row));
          if (blurb === title) blurb = "";
          var filter = [row.number, title, blurb].join(" ");
          return (
            '<div class="person" data-uid="' +
            ui.escapeHtml(row.uid) +
            '" data-number="' +
            ui.escapeHtml(row.number) +
            '" data-filter="' +
            ui.escapeHtml(filter) +
            '"><span class="mindset-id mindset-id-static is-sim" aria-hidden="true">' +
            ui.escapeHtml(row.number) +
            '</span><div class="person-body"><strong class="person-title">' +
            ui.escapeHtml(title) +
            "</strong>" +
            (blurb ? '<small class="person-blurb">' + ui.escapeHtml(blurb) + "</small>" : "") +
            '</div><div class="person-tools"><button type="button" class="btn-icon" data-enter-mind aria-label="' +
            ui.escapeHtml(t("root.enterMind")) +
            '">' +
            ui.icon("enter") +
            "</button></div></div>"
          );
        })
        .join("");
      applySimFilter();
    }

    ui.beginPageLoad();
    document.querySelector("#root-body").hidden = false;
    ui.requireAuth().then(async function (next) {
      session = next;
      if (!session) {
        document.querySelector("#root-body").hidden = true;
        return;
      }
      try {
        if (!(await isRoot())) {
          document.querySelector("#root-body").hidden = true;
          document.querySelector("#denied").hidden = false;
          return;
        }
        paintHeader();
        var alias = await softGet("aliasOf/1", session.idToken);
        var aliasLine = document.querySelector("#alias-line");
        aliasLine.textContent = alias && alias.alias ? "@" + alias.alias : "";
        await loadState();
        await refresh();
      } catch (error) {
        ui.setStatus(status, rootNotice(error), "error");
      }
    }).finally(function () {
      return ui.endPageLoad();
    });
  });
})();

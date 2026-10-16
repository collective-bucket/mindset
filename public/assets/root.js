(function () {
  "use strict";

  var ui = window.MindsetUi;
  var fs = window.MindsetFirestore;
  var sim = window.MindsetSim;
  var t = window.MindsetI18n.t;

  var PARALLEL = 6;
  var RESET_BATCH = 10;
  var LOG_LIMIT = 8;

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

    var simFish = fish.filter(function (row) { return row.sim; });
    var deepFish = fish.filter(function (row) { return row.sim || row.number === 1; });

    await pool(simFish, 8, async function (row) {
      if (!(row.number in cache.texts)) {
        var priv = await softGet("privateMindsets/" + row.number, token);
        var texts = {};
        sim.CLOSED_FIELDS.forEach(function (key) {
          if (priv && typeof priv[key] === "string" && priv[key].trim()) texts[key] = priv[key];
        });
        cache.texts[row.number] = texts;
      }
      row.closed = cache.texts[row.number];
    });

    await pool(deepFish, 8, async function (row) {
      if (!(row.number in cache.deep)) {
        var deep = await softGet("deepReadings/" + row.number, token);
        cache.deep[row.number] = deep
          ? {
              codeGap: deep.codeGap,
              authorityLean: deep.authorityLean,
              desireSplit: deep.desireSplit,
              shadowDistance: deep.shadowDistance
            }
          : null;
      }
      row.deep = cache.deep[row.number];
    });

    // Scales and pledges are found through the tails and requests they belong to.
    var simUids = {};
    simFish.forEach(function (row) {
      simUids[row.uid] = true;
    });
    var glintIds = {};
    function wantGlint(from, to) {
      if (simUids[from] || simUids[to]) glintIds[to + "_" + from] = true;
    }
    tails.forEach(function (row) {
      wantGlint(row.from, row.to);
    });
    requests.forEach(function (row) {
      wantGlint(row.from, row.to);
    });
    var glints = [];
    await pool(Object.keys(glintIds), 8, async function (id) {
      var glint = await softGet("glints/" + id, token);
      if (glint) glints.push(glint);
    });

    return {
      now: Date.now(),
      fish: fish,
      tails: tails,
      glints: glints,
      requests: requests,
      members: members
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var simStatus = document.querySelector("#sim-status");
    var runButton = document.querySelector("#sim-run");
    var session = null;
    var state = { tick: 0, config: sim.configOf({}) };
    var busy = false;

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
          return (
            '<div class="funnel-row"><div class="line"><span>' +
            escapeHtml(t("root.funnel." + step[0])) +
            "</span><span><strong>" +
            escapeHtml(number(step[1])) +
            "</strong>" +
            (index ? " · " + escapeHtml(t("root.funnelRate", { n: step[2] })) : "") +
            '</span></div><div class="funnel-bar"><span style="width:' +
            width +
            '%"></span></div></div>'
          );
        })
        .join("");
    }

    function fillConfig(config) {
      Object.keys(config).forEach(function (key) {
        var input = document.querySelector("#cfg-" + key);
        if (!input) return;
        if (input.type === "checkbox") input.checked = Boolean(config[key]);
        else input.value = config[key];
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
        list.innerHTML = "<li>" + escapeHtml(t("root.simLogEmpty")) + "</li>";
        return;
      }
      list.innerHTML = rows
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
          return "<li>" + escapeHtml(line + (extra.length ? " · " + extra.join(" · ") : "")) + "</li>";
        })
        .join("");
    }

    async function loadState() {
      var doc = await softGet("sim/state", session.idToken);
      state = {
        tick: doc && typeof doc.tick === "number" ? doc.tick : 0,
        config: sim.configOf(doc && doc.config)
      };
      fillConfig(state.config);
      renderTick();
    }

    async function refresh() {
      var world = await loadWorld(session);
      renderStats(sim.computeStats(world));
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
        var config = readConfig();
        var tick = state.tick + 1;
        var plan = sim.planTick(world, config, tick);
        var now = Date.now();
        var done = 0;
        var skipped = 0;
        var failed = 0;
        var firstError = null;

        await pool(plan.actions, PARALLEL, async function (action) {
          try {
            await fs.commit(sim.toWrites(action, world, fs.writes, now), session.idToken);
            done += 1;
          } catch (error) {
            if (fs.isConflict(error)) {
              skipped += 1;
            } else {
              failed += 1;
              firstError = firstError || error;
            }
          }
        });

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
        if (failed) message += " " + t("root.failed", { n: failed }) + " " + ui.errorText(firstError);
        ui.setStatus(simStatus, message, failed ? "error" : "");
        await refresh();
      } catch (error) {
        ui.setStatus(simStatus, ui.errorText(error), "error");
      } finally {
        setBusy(false);
      }
    }

    async function saveConfig() {
      setBusy(true);
      try {
        var config = readConfig();
        await fs.commit([fs.writes.set("sim/state", stateDoc(state.tick, config))], session.idToken);
        state.config = config;
        fillConfig(config);
        ui.setStatus(simStatus, t("root.cfgSaved"));
      } catch (error) {
        ui.setStatus(simStatus, ui.errorText(error), "error");
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
        ui.setStatus(simStatus, ui.errorText(error), "error");
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

    async function isRoot() {
      try {
        var doc = await fs.get("mindsets/1", session.idToken);
        return Boolean(doc && doc.ownerUid === session.uid);
      } catch (error) {
        return false;
      }
    }

    ui.requireAuth().then(async function (next) {
      session = next;
      if (!session) return;
      ui.setStatus(status, t("common.loading"));
      try {
        if (!(await isRoot())) {
          ui.setStatus(status, "");
          document.querySelector("#denied").hidden = false;
          return;
        }
        document.querySelector("#root-body").hidden = false;
        await loadState();
        await refresh();
        ui.setStatus(status, "");
      } catch (error) {
        ui.setStatus(status, ui.errorText(error), "error");
      }
    });
  });
})();

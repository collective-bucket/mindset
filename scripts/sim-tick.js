"use strict";

/**
 * Run one simulation cycle as root (same semantics as /root Run one cycle).
 * Env: ROOT_EMAIL, ROOT_PASSWORD, optional FIREBASE_API_KEY.
 *
 * Usage: node scripts/sim-tick.js
 */

var sim = require("../public/assets/sim.js");

var API_KEY =
  process.env.FIREBASE_API_KEY || "AIzaSyDJsuk_SaPUJkzP9gnlpB6qet0TUQJ5uZA";
var PROJECT = "collective-bucket";
var AUTH = "https://identitytoolkit.googleapis.com/v1";
var DB = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";
var DOC_PREFIX = "projects/" + PROJECT + "/databases/(default)/documents/";
var PARALLEL = 6;
var WRITE_LIMIT = 400;

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  var fields = {};
  Object.keys(value).forEach(function (key) {
    if (key === "id" || key === "_path") return;
    fields[key] = encodeValue(value[key]);
  });
  return { mapValue: { fields: fields } };
}

function encodeFields(data) {
  var fields = {};
  Object.keys(data).forEach(function (key) {
    if (key === "id" || key === "_path") return;
    fields[key] = encodeValue(data[key]);
  });
  return fields;
}

function decodeValue(node) {
  if (!node) return null;
  if ("nullValue" in node) return null;
  if ("booleanValue" in node) return node.booleanValue;
  if ("integerValue" in node) return Number(node.integerValue);
  if ("doubleValue" in node) return node.doubleValue;
  if ("stringValue" in node) return node.stringValue;
  if ("arrayValue" in node) return (node.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in node) {
    var out = {};
    Object.keys((node.mapValue && node.mapValue.fields) || {}).forEach(function (key) {
      out[key] = decodeValue(node.mapValue.fields[key]);
    });
    return out;
  }
  return null;
}

function decodeDocument(doc) {
  if (!doc || !doc.name) return null;
  var data = {};
  Object.keys(doc.fields || {}).forEach(function (key) {
    data[key] = decodeValue(doc.fields[key]);
  });
  data.id = doc.name.split("/").pop();
  data._path = doc.name.replace(DOC_PREFIX, "");
  return data;
}

async function http(url, options) {
  options = options || {};
  var response = await fetch(url, {
    method: options.method || "GET",
    headers: Object.assign({ "Content-Type": "application/json" }, options.headers || {}),
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  var text = await response.text();
  var json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (error) {
    json = { raw: text.slice(0, 200) };
  }
  if (!response.ok) {
    var err = new Error((json && json.error && json.error.message) || text.slice(0, 200) || response.status);
    err.status = response.status;
    throw err;
  }
  return json;
}

function withKey(url) {
  return url + (url.indexOf("?") >= 0 ? "&" : "?") + "key=" + encodeURIComponent(API_KEY);
}

async function signIn(email, password) {
  return http(withKey(AUTH + "/accounts:signInWithPassword"), {
    method: "POST",
    body: { email: email, password: password, returnSecureToken: true }
  });
}

async function getDoc(docPath, token) {
  try {
    return decodeDocument(
      await http(withKey(DB + "/" + docPath), {
        headers: { Authorization: "Bearer " + token }
      })
    );
  } catch (error) {
    if (error.status === 404 || error.status === 403) return null;
    throw error;
  }
}

async function runQuery(body, token) {
  var page = await http(withKey(DB + ":runQuery"), {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: body
  });
  var docs = [];
  (page || []).forEach(function (row) {
    if (row.error) {
      var error = new Error(row.error.message || "Firestore query failed");
      error.status = typeof row.error.code === "number" ? row.error.code : 0;
      throw error;
    }
    if (row.document) docs.push(decodeDocument(row.document));
  });
  return docs;
}

function isConflict(error) {
  return Boolean(
    error && (error.status === 409 || /already exists/i.test(String(error.message || "")))
  );
}

function encodeWrite(row) {
  if (row.delete) return { delete: DOC_PREFIX + row.delete };
  var write = {
    update: {
      name: DOC_PREFIX + row.path,
      fields: encodeFields(row.data)
    }
  };
  if (row.create) write.currentDocument = { exists: false };
  return write;
}

function writesFor(action, world, now) {
  return sim
    .toWrites(
      action,
      world,
      {
        set: function (path, data) {
          return { path: path, data: data };
        },
        create: function (path, data) {
          return { path: path, data: data, create: true };
        },
        remove: function (path) {
          return { delete: path };
        }
      },
      now
    )
    .map(encodeWrite);
}

async function listCollection(collectionId, token, limit) {
  return runQuery(
    {
      structuredQuery: {
        from: [{ collectionId: collectionId }],
        limit: limit || 2000
      }
    },
    token
  );
}

async function commit(writes, token) {
  return http(withKey(DB + ":commit"), {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: { writes: writes }
  });
}

async function pool(items, size, worker) {
  var index = 0;
  var workers = [];
  for (var i = 0; i < size; i += 1) {
    workers.push(
      (async function () {
        while (index < items.length) {
          var current = items[index];
          index += 1;
          await worker(current);
        }
      })()
    );
  }
  await Promise.all(workers);
}

async function loadWorld(token) {
  var mindsets = await runQuery(
    {
      structuredQuery: {
        from: [{ collectionId: "mindsets" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "published" },
            op: "EQUAL",
            value: { booleanValue: true }
          }
        },
        limit: 2000
      }
    },
    token
  );
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

  var tails = await listCollection("tails", token, 5000);
  var requests = await listCollection("schoolRequests", token, 5000);
  var glints = await listCollection("glints", token, 5000);
  var membersRaw = await runQuery(
    {
      structuredQuery: {
        from: [{ collectionId: "members", allDescendants: true }],
        limit: 5000
      }
    },
    token
  );
  var members = membersRaw.map(function (row) {
    var parts = String(row._path || "").split("/");
    return { uid: parts[1], other: parts[3], number: row.number };
  });

  var world = {
    now: Date.now(),
    fish: fish,
    tails: tails,
    glints: glints,
    requests: requests,
    members: members
  };
  var need = sim.readsForTick(world);
  await pool(need.closed, PARALLEL, async function (row) {
    var priv = await getDoc("privateMindsets/" + row.number, token);
    var texts = {};
    sim.CLOSED_FIELDS.forEach(function (key) {
      if (priv && typeof priv[key] === "string" && priv[key].trim()) texts[key] = priv[key];
    });
    row.closed = texts;
  });
  await pool(need.deep, PARALLEL, async function (row) {
    var deep = await getDoc("deepReadings/" + row.number, token);
    row.deep = deep
      ? {
          codeGap: deep.codeGap,
          authorityLean: deep.authorityLean,
          desireSplit: deep.desireSplit,
          shadowDistance: deep.shadowDistance
        }
      : null;
  });
  return world;
}

async function commitActions(actions, world, now, token) {
  var done = 0;
  var skipped = 0;
  var failed = 0;
  var batch = [];
  var writes = [];

  async function settleOne(actionWrites) {
    try {
      await commit(actionWrites, token);
      done += 1;
    } catch (error) {
      if (isConflict(error)) skipped += 1;
      else {
        failed += 1;
        console.log("action fail", error.message);
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
      await commit(writesInBatch, token);
      done += actionsInBatch.length;
    } catch (error) {
      if (actionsInBatch.length === 1) {
        if (isConflict(error)) skipped += 1;
        else {
          failed += 1;
          console.log("action fail", error.message);
        }
        return;
      }
      var offset = 0;
      for (var i = 0; i < actionsInBatch.length; i += 1) {
        var count = writesFor(actionsInBatch[i], world, now).length;
        await settleOne(writesInBatch.slice(offset, offset + count));
        offset += count;
      }
    }
  }

  for (var i = 0; i < actions.length; i += 1) {
    var actionWrites = writesFor(actions[i], world, now);
    if (!actionWrites.length) continue;
    if (writes.length && writes.length + actionWrites.length > WRITE_LIMIT) await flush();
    batch.push(actions[i]);
    writes = writes.concat(actionWrites);
  }
  await flush();
  return { done: done, skipped: skipped, failed: failed };
}

async function main() {
  var email = process.env.ROOT_EMAIL;
  var password = process.env.ROOT_PASSWORD;
  if (!email || !password) {
    throw new Error("ROOT_EMAIL and ROOT_PASSWORD are required");
  }
  var auth = await signIn(email, password);
  var token = auth.idToken;
  var rootDoc = await getDoc("mindsets/1", token);
  if (!rootDoc || rootDoc.ownerUid !== auth.localId) {
    throw new Error("Signed-in user is not root");
  }

  var state = (await getDoc("sim/state", token)) || { tick: 0, config: {} };
  var config = sim.configOf(state.config);
  var world = await loadWorld(token);
  if (!world.fish.some(function (row) {
    return row.sim;
  })) {
    console.log(JSON.stringify({ ok: true, skipped: "no sim fish" }));
    return;
  }

  var tick = (state.tick || 0) + 1;
  var plan = sim.planTick(world, config, tick);
  var now = world.now || Date.now();
  var result = await commitActions(plan.actions, world, now, token);
  var summary = plan.summary;
  await commit(
    [
      {
        update: {
          name: DOC_PREFIX + "simTicks/" + tick,
          fields: encodeFields({
            tick: tick,
            at: new Date(now).toISOString(),
            tails: summary.tails,
            shines: summary.shines,
            requests: summary.requests,
            accepts: summary.accepts,
            declines: summary.declines,
            skipped: result.skipped,
            failed: result.failed
          })
        }
      },
      {
        update: {
          name: DOC_PREFIX + "sim/state",
          fields: encodeFields({
            tick: tick,
            seed: config.seed,
            config: config,
            updatedAt: new Date(now).toISOString()
          })
        }
      }
    ],
    token
  );

  console.log(
    JSON.stringify({
      ok: true,
      tick: tick,
      done: result.done,
      skipped: result.skipped,
      failed: result.failed,
      summary: summary
    })
  );
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});

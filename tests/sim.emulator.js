"use strict";

// Runs the simulation engine against the Firestore emulator with the real
// rules: npm run test:rules. Root (alice) writes for the test fish.
var assert = require("assert");
var sim = require("../public/assets/sim.js");

var HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085";
var PROJECT = process.env.GCLOUD_PROJECT || "demo-mindset";
var DB = "projects/" + PROJECT + "/databases/(default)";
var ROOT = "http://" + HOST + "/v1/" + DB + "/documents";
var NOW = "2026-10-15T00:00:00.000Z";

function token(uid) {
  var header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  var payload = Buffer.from(
    JSON.stringify({
      iss: "https://securetoken.google.com/" + PROJECT,
      aud: PROJECT,
      sub: uid,
      user_id: uid,
      iat: 1,
      exp: 9999999999,
      auth_time: 1,
      firebase: { sign_in_provider: "password" }
    })
  ).toString("base64url");
  return header + "." + payload + ".";
}

function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  var fields = {};
  Object.keys(value).forEach(function (key) {
    fields[key] = encode(value[key]);
  });
  return { mapValue: { fields: fields } };
}

function decode(node) {
  if ("integerValue" in node) return Number(node.integerValue);
  if ("doubleValue" in node) return node.doubleValue;
  if ("stringValue" in node) return node.stringValue;
  if ("timestampValue" in node) return node.timestampValue;
  if ("booleanValue" in node) return node.booleanValue;
  if ("arrayValue" in node) return (node.arrayValue.values || []).map(decode);
  if ("mapValue" in node) {
    var out = {};
    Object.keys(node.mapValue.fields || {}).forEach(function (key) {
      out[key] = decode(node.mapValue.fields[key]);
    });
    return out;
  }
  return null;
}

function name(path) {
  return DB + "/documents/" + path;
}

var w = {
  set: function (path, data) {
    return { update: { name: name(path), fields: encode(data).mapValue.fields } };
  },
  create: function (path, data) {
    return { update: { name: name(path), fields: encode(data).mapValue.fields }, currentDocument: { exists: false } };
  },
  remove: function (path) {
    return { delete: name(path) };
  }
};

async function call(method, url, bearer, body) {
  var response = await fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + bearer },
    body: body ? JSON.stringify(body) : undefined
  });
  var text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

async function listAll(collectionId, allDescendants) {
  var result = await call("POST", ROOT + ":runQuery", "owner", {
    structuredQuery: { from: [{ collectionId: collectionId, allDescendants: Boolean(allDescendants) }] }
  });
  return (result.json || [])
    .filter(function (row) {
      return row.document;
    })
    .map(function (row) {
      var data = decode({ mapValue: { fields: row.document.fields || {} } });
      data._path = row.document.name.split("/documents/")[1];
      return data;
    });
}

function mindset(uid, number, base) {
  return {
    ownerUid: uid,
    number: number,
    numberKey: String(number),
    published: true,
    createdAt: NOW,
    updatedAt: NOW,
    lens: "v2",
    agency: base,
    communion: base,
    codeClarity: base,
    redemption: base,
    known: ["agency", "communion", "codeClarity", "redemption"],
    bucket: "2222",
    ageBand: "25-34",
    gender: "",
    country: "TR",
    currentPosition: "",
    personalCode: "Keep your word.",
    selfNarrative: ""
  };
}

async function world() {
  var mindsets = await listAll("mindsets");
  var privates = {};
  (await listAll("privateMindsets")).forEach(function (row) {
    privates[row.number] = row;
  });
  var deeps = {};
  (await listAll("deepReadings")).forEach(function (row) {
    deeps[row.number] = row;
  });
  return {
    now: Date.now(),
    fish: mindsets.map(function (row) {
      var priv = privates[row.number] || {};
      var closed = {};
      sim.CLOSED_FIELDS.forEach(function (key) {
        if (priv[key]) closed[key] = priv[key];
      });
      return {
        uid: row.ownerUid,
        number: row.number,
        sim: sim.isSim(row.ownerUid),
        root: row.number === 1,
        scores: { agency: row.agency, communion: row.communion, codeClarity: row.codeClarity, redemption: row.redemption },
        deep: deeps[row.number] || null,
        closed: closed
      };
    }),
    tails: await listAll("tails"),
    requests: await listAll("schoolRequests"),
    glints: await listAll("glints"),
    members: (await listAll("members", true)).map(function (row) {
      var parts = row._path.split("/");
      return { uid: parts[1], other: parts[3], number: row.number };
    })
  };
}

(async function main() {
  await call("DELETE", "http://" + HOST + "/emulator/v1/" + DB + "/documents", "owner");

  var seed = [w.set("mindsets/1", mindset("alice", 1, 50))];
  for (var n = 10; n < 16; n += 1) {
    var base = 45 + (n - 10) * 3;
    seed.push(w.set("mindsets/" + n, mindset("sim" + n, n, base)));
    seed.push(
      w.set("privateMindsets/" + n, {
        ownerUid: "sim" + n,
        number: n,
        numberKey: String(n),
        lens: "v2",
        updatedAt: NOW,
        city: "",
        unsayableAttitude: "Quiet envy " + n,
        desireScript: "Wanting " + n,
        disownedSelf: "",
        codeGap: base,
        authorityLean: base,
        desireSplit: base,
        shadowDistance: base
      })
    );
    seed.push(
      w.set("deepReadings/" + n, {
        ownerUid: "sim" + n,
        number: n,
        updatedAt: NOW,
        codeGap: base,
        authorityLean: base,
        desireSplit: base,
        shadowDistance: base
      })
    );
  }
  var seeded = await call("POST", ROOT + ":commit", "owner", { writes: seed });
  assert.strictEqual(seeded.status, 200, "seed failed");

  var config = { tailsPerTick: 2, maxTails: 6, shineChance: 1, threshold: 70, radius: 40, seed: 5, includeRoot: true };
  var totals = { tails: 0, shines: 0, requests: 0, accepts: 0, declines: 0 };
  var failures = [];
  for (var tick = 1; tick <= 8; tick += 1) {
    var current = await world();
    var plan = sim.planTick(current, config, tick);
    var now = Date.now();
    for (var i = 0; i < plan.actions.length; i += 1) {
      var writes = sim.toWrites(plan.actions[i], current, w, now);
      var result = await call("POST", ROOT + ":commit", token("alice"), { writes: writes });
      if (result.status !== 200) {
        failures.push("tick " + tick + " " + JSON.stringify(plan.actions[i]) + " -> " + result.status);
      }
    }
    Object.keys(totals).forEach(function (key) {
      totals[key] += plan.summary[key];
    });
    console.log("cycle " + tick + ": " + JSON.stringify(plan.summary));
  }

  assert.deepStrictEqual(failures, [], "rules refused engine writes:\n" + failures.join("\n"));
  assert.ok(totals.tails > 0 && totals.shines > 0 && totals.requests > 0 && totals.accepts > 0, "the handshake never completed: " + JSON.stringify(totals));
  var final = sim.computeStats(await world());
  assert.ok(final.schools > 0, "no school formed");
  console.log("final stats " + JSON.stringify(final));

  // A non-root user cannot drive the same writes.
  var tailAction = { type: "tail", from: "sim10", to: "sim15" };
  var denied = await call("POST", ROOT + ":commit", token("bob"), {
    writes: sim.toWrites(tailAction, await world(), w, Date.now())
  });
  assert.strictEqual(denied.status, 403, "non-root must not write for test fish");

  console.log("sim.emulator.js passed");
})().catch(function (error) {
  console.error(error.message);
  process.exit(1);
});

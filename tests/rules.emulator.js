"use strict";

// Runs against the Firestore emulator: npm run test:rules
var assert = require("assert");

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
  if (typeof value === "number") return { integerValue: String(value) };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  var fields = {};
  Object.keys(value).forEach(function (key) {
    fields[key] = encode(value[key]);
  });
  return { mapValue: { fields: fields } };
}

function fields(data) {
  return encode(data).mapValue.fields;
}

async function call(method, url, uid, body) {
  var headers = { "Content-Type": "application/json" };
  if (uid) headers.Authorization = "Bearer " + (uid === "owner" ? "owner" : token(uid));
  var response = await fetch(url, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
  return response.status;
}

function get(path, uid) {
  return call("GET", ROOT + "/" + path, uid);
}

function commit(uid, writes) {
  return call("POST", ROOT + ":commit", uid, { writes: writes });
}

function name(path) {
  return DB + "/documents/" + path;
}

var w = {
  set: function (path, data) {
    return { update: { name: name(path), fields: fields(data) } };
  },
  create: function (path, data) {
    return { update: { name: name(path), fields: fields(data) }, currentDocument: { exists: false } };
  },
  patch: function (path, data) {
    return {
      update: { name: name(path), fields: fields(data) },
      updateMask: { fieldPaths: Object.keys(data) },
      currentDocument: { exists: true }
    };
  },
  remove: function (path) {
    return { delete: name(path) };
  },
  increment: function (path, field) {
    return {
      transform: { document: name(path), fieldTransforms: [{ fieldPath: field, increment: { integerValue: "1" } }] }
    };
  }
};

function mindset(uid, number, extra) {
  return Object.assign(
    {
      ownerUid: uid,
      number: number,
      numberKey: String(number),
      published: true,
      createdAt: NOW,
      updatedAt: NOW,
      lens: "v2",
      agency: 70,
      communion: -1,
      codeClarity: 80,
      redemption: -1,
      known: ["agency", "codeClarity"],
      bucket: "3u4u",
      ageBand: "25-34",
      gender: "",
      country: "TR",
      currentPosition: "",
      personalCode: "Keep your word.",
      selfNarrative: ""
    },
    extra || {}
  );
}

function privateDoc(uid, number, extra) {
  return Object.assign(
    {
      ownerUid: uid,
      number: number,
      numberKey: String(number),
      lens: "v2",
      updatedAt: NOW,
      city: "Izmir",
      unsayableAttitude: "",
      desireScript: "",
      disownedSelf: "",
      codeGap: -1,
      authorityLean: -1,
      desireSplit: -1,
      shadowDistance: -1
    },
    extra || {}
  );
}

var results = [];
async function expect(label, status, wanted) {
  var ok = wanted === "ok" ? status === 200 : status === wanted;
  results.push((ok ? "ok   " : "FAIL ") + label + " -> " + status);
  assert.ok(ok, label + " expected " + wanted + " got " + status);
}

(async function main() {
  await call("DELETE", "http://" + HOST + "/emulator/v1/" + DB + "/documents", "owner");

  await expect("alice creates mindset 1", await commit("alice", [w.create("mindsets/1", mindset("alice", 1))]), "ok");
  await expect("bob creates mindset 2", await commit("bob", [w.create("mindsets/2", mindset("bob", 2))]), "ok");
  await expect("carol creates mindset 3", await commit("carol", [w.create("mindsets/3", mindset("carol", 3))]), "ok");
  await expect("city on public doc denied", await commit("dave", [w.create("mindsets/4", mindset("dave", 4, { city: "Izmir" }))]), 403);
  await expect("closed text on public doc denied", await commit("dave", [w.create("mindsets/4", mindset("dave", 4, { unsayableAttitude: "x" }))]), 403);
  await expect("bad country denied", await commit("dave", [w.create("mindsets/4", mindset("dave", 4, { country: "Turkey" }))]), 403);
  await expect("bad age band denied", await commit("dave", [w.create("mindsets/4", mindset("dave", 4, { ageBand: "12-17" }))]), 403);
  await expect("v1 doc without demographics still valid", await commit("dave", [w.create("mindsets/4", (function () {
    var doc = mindset("dave", 4, { lens: "v1" });
    delete doc.ageBand;
    delete doc.gender;
    delete doc.country;
    return doc;
  })())]), "ok");
  await expect("private doc with city", await commit("alice", [w.create("privateMindsets/1", privateDoc("alice", 1))]), "ok");
  await expect("others cannot read private", await get("privateMindsets/1", "bob"), 403);

  await expect("bob follows 1", await commit("bob", [w.set("follows/bob/items/1", { number: 1, createdAt: NOW })]), "ok");
  await expect("alice cannot read bob's follows", await get("follows/bob/items/1", "alice"), 403);
  await expect("follow id must match number", await commit("bob", [w.set("follows/bob/items/3", { number: 1, createdAt: NOW })]), 403);

  await expect(
    "alice sets tribe-only alias",
    await commit("alice", [
      w.set("aliases/alice", { ownerUid: "alice", number: 1, visibility: "tribe" }),
      w.set("aliasOf/1", { ownerUid: "alice", alias: "alice", visibility: "tribe" }),
      w.patch("mindsets/1", { alias: "" })
    ]),
    "ok"
  );
  await expect("tribe-only alias hidden from bob", await get("aliases/alice", "bob"), 403);
  await expect("tribe-only aliasOf hidden from anonymous", await get("aliasOf/1"), 403);
  await expect("missing alias reads as 404", await get("aliases/nobody"), 404);
  await expect("tribe-only alias cannot go on public doc", await commit("alice", [w.patch("mindsets/1", { alias: "alice" })]), 403);
  await expect(
    "bob cannot take alice's alias",
    await commit("bob", [
      w.set("aliases/alice", { ownerUid: "bob", number: 2, visibility: "public" }),
      w.set("aliasOf/2", { ownerUid: "bob", alias: "alice", visibility: "public" })
    ]),
    403
  );
  await expect(
    "alias needs matching aliasOf in the same batch",
    await commit("bob", [w.set("aliases/bobby", { ownerUid: "bob", number: 2, visibility: "public" })]),
    403
  );
  await expect(
    "carol sets public alias",
    await commit("carol", [
      w.set("aliases/carol", { ownerUid: "carol", number: 3, visibility: "public" }),
      w.set("aliasOf/3", { ownerUid: "carol", alias: "carol", visibility: "public" }),
      w.patch("mindsets/3", { alias: "carol" })
    ]),
    "ok"
  );
  await expect("public alias readable by anyone", await get("aliases/carol"), "ok");

  var request = { from: "bob", to: "alice", fromNumber: 2, toNumber: 1, createdAt: NOW };
  await expect("bob invites alice", await commit("bob", [w.create("tribeRequests/bob_alice", request)]), "ok");
  await expect("forged request denied", await commit("carol", [w.create("tribeRequests/bob_carol", Object.assign({}, request, { to: "carol", toNumber: 3 }))]), 403);
  await expect("request with someone else's number denied", await commit("bob", [w.create("tribeRequests/bob_carol", { from: "bob", to: "carol", fromNumber: 1, toNumber: 3, createdAt: NOW })]), 403);
  await expect("carol cannot read bob->alice request", await get("tribeRequests/bob_alice", "carol"), 403);
  await expect("alice reads incoming request", await get("tribeRequests/bob_alice", "alice"), "ok");
  await expect("bob cannot self-join alice's tribe", await commit("bob", [w.create("tribes/alice/members/bob", { uid: "bob", number: 2, since: NOW })]), 403);
  await expect("bob cannot add alice to his tribe", await commit("bob", [w.create("tribes/bob/members/alice", { uid: "alice", number: 1, since: NOW })]), 403);
  await expect(
    "alice accepts",
    await commit("alice", [
      w.create("tribes/alice/members/bob", { uid: "bob", number: 2, since: NOW }),
      w.create("tribes/bob/members/alice", { uid: "alice", number: 1, since: NOW }),
      w.remove("tribeRequests/bob_alice")
    ]),
    "ok"
  );
  await expect("request gone after accept", await get("tribeRequests/bob_alice", "alice"), 404);
  await expect("tribe member sees tribe-only alias", await get("aliases/alice", "bob"), "ok");
  await expect("tribe member sees aliasOf", await get("aliasOf/1", "bob"), "ok");
  await expect("outsider still blocked", await get("aliases/alice", "carol"), 403);
  await expect("member reads tribe list", await call("POST", ROOT + "/tribes/alice:runQuery", "bob", { structuredQuery: { from: [{ collectionId: "members" }] } }), "ok");
  await expect("outsider cannot read tribe list", await call("POST", ROOT + "/tribes/alice:runQuery", "carol", { structuredQuery: { from: [{ collectionId: "members" }] } }), 403);
  await expect("no duplicate request once in tribe", await commit("bob", [w.create("tribeRequests/bob_alice", request)]), 403);

  await expect("stats create", await commit("alice", [w.create("stats/public", { lens: "v2", count: 0, axes: {} })]), "ok");
  await expect("stats increment slice", await commit("alice", [w.increment("stats/public", "byAge.a25_34.n")]), "ok");
  await expect("stats increment city", await commit("alice", [w.increment("stats/public", "cities.TR_izmir")]), "ok");
  await expect("stats unknown age key denied", await commit("alice", [w.increment("stats/public", "byAge.bogus.n")]), 403);
  await expect("stats unknown top-level denied", await commit("alice", [w.increment("stats/public", "junk")]), 403);

  await expect(
    "bob leaves the tribe",
    await commit("bob", [w.remove("tribes/bob/members/alice"), w.remove("tribes/alice/members/bob")]),
    "ok"
  );
  await expect("alias hidden again after leaving", await get("aliases/alice", "bob"), 403);

  console.log(results.join("\n"));
  console.log("rules.emulator.js passed (" + results.length + " checks)");
})().catch(function (error) {
  console.log(results.join("\n"));
  console.error(error.message);
  process.exit(1);
});

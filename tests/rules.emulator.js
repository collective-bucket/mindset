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

  function setAlias(uid, number, alias) {
    return commit(uid, [
      w.set("aliases/" + alias, { ownerUid: uid, number: number }),
      w.set("aliasOf/" + number, { ownerUid: uid, alias: alias })
    ]);
  }

  await expect("alice sets alias", await setAlias("alice", 1, "alicefish"), "ok");
  await expect("bob sets alias", await setAlias("bob", 2, "bobfish"), "ok");
  await expect("carol sets alias", await setAlias("carol", 3, "carolfish"), "ok");
  await expect("alias hidden from outsiders", await get("aliases/alicefish", "bob"), 403);
  await expect("aliasOf hidden from anonymous", await get("aliasOf/1"), 403);
  await expect("owner reads own alias", await get("aliases/alicefish", "alice"), "ok");
  await expect("missing alias reads as 404", await get("aliases/nobody"), 404);
  await expect("alias never on the public doc", await commit("alice", [w.patch("mindsets/1", { alias: "alicefish" })]), 403);
  await expect("public visibility field rejected", await commit("carol", [
    w.set("aliases/carolfish", { ownerUid: "carol", number: 3, visibility: "public" }),
    w.set("aliasOf/3", { ownerUid: "carol", alias: "carolfish" })
  ]), 403);
  await expect("bob cannot take alice's alias", await setAlias("bob", 2, "alicefish"), 403);
  await expect(
    "alias needs matching aliasOf in the same batch",
    await commit("bob", [w.set("aliases/bobby", { ownerUid: "bob", number: 2 })]),
    403
  );
  await expect("mindhunter reserved for mindset 1", await setAlias("bob", 2, "mindhunter"), 403);
  await expect("bob back to his alias", await setAlias("bob", 2, "bobfish"), "ok");

  var request = { from: "bob", to: "alice", fromNumber: 2, toNumber: 1, alias: "alicefish", createdAt: NOW };
  await expect("invite without alias denied", await commit("bob", [w.create("tribeRequests/bob_alice", (function () {
    var copy = Object.assign({}, request);
    delete copy.alias;
    return copy;
  })())]), 403);
  await expect("invite with wrong alias denied", await commit("bob", [w.create("tribeRequests/bob_alice", Object.assign({}, request, { alias: "carolfish" }))]), 403);
  await expect("invite with unknown alias denied", await commit("bob", [w.create("tribeRequests/bob_alice", Object.assign({}, request, { alias: "ghostfish" }))]), 403);
  await expect("bob invites alice with her alias", await commit("bob", [w.create("tribeRequests/bob_alice", request)]), "ok");
  await expect("forged request denied", await commit("carol", [w.create("tribeRequests/bob_carol", Object.assign({}, request, { to: "carol", toNumber: 3, alias: "carolfish" }))]), 403);
  await expect("request with someone else's number denied", await commit("bob", [w.create("tribeRequests/bob_carol", { from: "bob", to: "carol", fromNumber: 1, toNumber: 3, alias: "carolfish", createdAt: NOW })]), 403);
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
  await expect("tribe member sees alias", await get("aliases/alicefish", "bob"), "ok");
  await expect("tribe member sees aliasOf", await get("aliasOf/1", "bob"), "ok");
  await expect("outsider still blocked", await get("aliases/alicefish", "carol"), 403);

  function version(uid, number, extra) {
    var doc = mindset(uid, number, extra);
    ["numberKey", "published", "updatedAt", "bucket"].forEach(function (key) {
      delete doc[key];
    });
    return doc;
  }
  var versionPath = "mindsets/1/versions/20261015000000000";
  await expect("alice writes a version", await commit("alice", [w.create(versionPath, version("alice", 1))]), "ok");
  await expect("bob cannot write alice's version", await commit("bob", [w.create("mindsets/1/versions/20261015000000001", version("bob", 1))]), 403);
  await expect("version with closed text denied", await commit("alice", [w.create("mindsets/1/versions/20261015000000002", version("alice", 1, { desireScript: "x" }))]), 403);
  await expect("versions are immutable", await commit("alice", [w.set(versionPath, version("alice", 1, { personalCode: "Changed." }))]), 403);
  await expect("history none: tribe member blocked", await get(versionPath, "bob"), 403);
  await expect("history none: owner reads", await get(versionPath, "alice"), "ok");
  await expect("bad history level denied", await commit("alice", [w.patch("mindsets/1", { history: "friends" })]), 403);
  await expect("alice opens history to tribe", await commit("alice", [w.patch("mindsets/1", { history: "tribe" })]), "ok");
  await expect("history tribe: member reads", await get(versionPath, "bob"), "ok");
  await expect("history tribe: outsider blocked", await get(versionPath, "carol"), 403);
  await expect("history tribe: anonymous blocked", await get(versionPath), 403);
  await expect("alice opens history to everyone", await commit("alice", [w.patch("mindsets/1", { history: "public" })]), "ok");
  await expect("history public: anonymous reads", await get(versionPath), "ok");
  await expect("history public: list versions", await call("POST", ROOT + "/mindsets/1:runQuery", null, { structuredQuery: { from: [{ collectionId: "versions" }] } }), "ok");
  await expect("unpublished hides history", await commit("alice", [w.patch("mindsets/1", { published: false })]), "ok");
  await expect("history public but unpublished: blocked", await get(versionPath, "carol"), 403);
  await expect("alice republishes", await commit("alice", [w.patch("mindsets/1", { published: true, history: "none" })]), "ok");
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
  await expect("alias hidden again after leaving", await get("aliases/alicefish", "bob"), 403);
  await expect(
    "owner of mindset 1 can take mindhunter",
    await commit("alice", [
      w.remove("aliases/alicefish"),
      w.set("aliases/mindhunter", { ownerUid: "alice", number: 1 }),
      w.set("aliasOf/1", { ownerUid: "alice", alias: "mindhunter" })
    ]),
    "ok"
  );

  console.log(results.join("\n"));
  console.log("rules.emulator.js passed (" + results.length + " checks)");
})().catch(function (error) {
  console.log(results.join("\n"));
  console.error(error.message);
  process.exit(1);
});

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
  if (value instanceof Date) return { timestampValue: value.toISOString() };
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
  await expect("firstfish reserved for mindset 1", await setAlias("bob", 2, "firstfish"), 403);
  await expect("bob back to his alias", await setAlias("bob", 2, "bobfish"), "ok");

  // ---- Step 0: closed texts (used verbatim by glints and seals) ----
  await expect("alice writes closed text", await commit("alice", [w.set("privateMindsets/1", privateDoc("alice", 1, { desireScript: "I want to be seen." }))]), "ok");
  await expect("bob writes private doc", await commit("bob", [w.create("privateMindsets/2", privateDoc("bob", 2, { unsayableAttitude: "I envy quietly." }))]), "ok");

  // ---- Step 1: tails ----
  function tail(from, to, fromNumber, toNumber) {
    return { from: from, to: to, fromNumber: fromNumber, toNumber: toNumber, createdAt: NOW };
  }
  await expect("bob tails alice", await commit("bob", [w.create("tails/bob_alice", tail("bob", "alice", 2, 1))]), "ok");
  await expect("cannot tail with someone else's number", await commit("bob", [w.create("tails/bob_carol", tail("bob", "carol", 1, 3))]), 403);
  await expect("cannot tail yourself", await commit("bob", [w.create("tails/bob_bob", tail("bob", "bob", 2, 2))]), 403);
  await expect("target number must belong to target uid", await commit("bob", [w.create("tails/bob_carol", tail("bob", "carol", 2, 1))]), 403);
  await expect("forged tail denied", await commit("carol", [w.create("tails/bob_carol", tail("bob", "carol", 2, 3))]), 403);
  await expect("alice sees who tails her", await get("tails/bob_alice", "alice"), "ok");
  await expect("carol cannot read the tail", await get("tails/bob_alice", "carol"), 403);
  await expect(
    "alice lists tails on her",
    await call("POST", ROOT + ":runQuery", "alice", { structuredQuery: { from: [{ collectionId: "tails" }], where: { fieldFilter: { field: { fieldPath: "to" }, op: "EQUAL", value: { stringValue: "alice" } } } } }),
    "ok"
  );
  await expect("unfiltered tail list denied", await call("POST", ROOT + ":runQuery", "carol", { structuredQuery: { from: [{ collectionId: "tails" }] } }), 403);

  // ---- Step 2: glint (alice shows bob one closed field for a few days) ----
  var inDays = function (days) {
    return new Date(Date.now() + days * 86400000);
  };
  function glint(extra) {
    return Object.assign({ from: "alice", to: "bob", fromNumber: 1, toNumber: 2, field: "desireScript", text: "I want to be seen.", createdAt: NOW, expiresAt: inDays(6) }, extra || {});
  }
  await expect("glint needs a tail from the receiver", await commit("alice", [w.set("glints/alice_carol", glint({ to: "carol", toNumber: 3 }))]), 403);
  await expect("tail the other way first", await commit("alice", [w.create("tails/alice_bob", tail("alice", "bob", 1, 2))]), "ok");
  await commit("bob", [w.remove("tails/bob_alice")]);
  await expect("tail from bob needed for alice's glint", await commit("alice", [w.set("glints/alice_bob", glint())]), 403);
  await expect("bob tails alice again", await commit("bob", [w.create("tails/bob_alice", tail("bob", "alice", 2, 1))]), "ok");
  await expect("glint with edited text denied", await commit("alice", [w.set("glints/alice_bob", glint({ text: "Something else." }))]), 403);
  await expect("glint with unknown field denied", await commit("alice", [w.set("glints/alice_bob", glint({ field: "city" }))]), 403);
  await expect("glint expiring in 8 days denied", await commit("alice", [w.set("glints/alice_bob", glint({ expiresAt: inDays(8) }))]), 403);
  await expect("glint already expired denied", await commit("alice", [w.set("glints/alice_bob", glint({ expiresAt: inDays(-1) }))]), 403);
  await expect("glint with a string expiry denied", await commit("alice", [w.set("glints/alice_bob", glint({ expiresAt: NOW }))]), 403);
  await expect("forged glint from carol denied", await commit("carol", [w.set("glints/alice_bob", glint())]), 403);
  await expect("alice shines a scale for bob", await commit("alice", [w.set("glints/alice_bob", glint())]), "ok");
  await expect("bob reads the live glint", await get("glints/alice_bob", "bob"), "ok");
  await expect("alice reads her own glint", await get("glints/alice_bob", "alice"), "ok");
  await expect("carol cannot read it", await get("glints/alice_bob", "carol"), 403);
  await expect(
    "recipient lists glints toward them",
    await call("POST", ROOT + ":runQuery", "bob", {
      structuredQuery: {
        from: [{ collectionId: "glints" }],
        where: { fieldFilter: { field: { fieldPath: "to" }, op: "EQUAL", value: { stringValue: "bob" } } }
      }
    }),
    "ok"
  );
  await expect(
    "stranger cannot list others' glints",
    await call("POST", ROOT + ":runQuery", "carol", {
      structuredQuery: {
        from: [{ collectionId: "glints" }],
        where: { fieldFilter: { field: { fieldPath: "to" }, op: "EQUAL", value: { stringValue: "bob" } } }
      }
    }),
    403
  );
  await expect("bob cannot edit alice's glint", await commit("bob", [w.set("glints/alice_bob", glint())]), 403);

  // ---- Step 3: bob asks to form a school, with a sealed pledge ----
  function seal(extra) {
    return Object.assign({ from: "bob", to: "alice", fromNumber: 2, toNumber: 1, field: "unsayableAttitude", text: "I envy quietly.", createdAt: NOW }, extra || {});
  }
  function schoolRequest(extra) {
    return Object.assign({ from: "bob", to: "alice", fromNumber: 2, toNumber: 1, field: "unsayableAttitude", createdAt: NOW }, extra || {});
  }
  await expect("request without a glint denied", await commit("carol", [
    w.set("seals/carol_alice", seal({ from: "carol", fromNumber: 3 })),
    w.create("schoolRequests/carol_alice", schoolRequest({ from: "carol", fromNumber: 3 }))
  ]), 403);
  await expect("request without seal denied", await commit("bob", [w.create("schoolRequests/bob_alice", schoolRequest())]), 403);
  await expect("request with a seal that differs from the shown text denied", await commit("bob", [
    w.set("seals/bob_alice", seal({ text: "Something else." })),
    w.create("schoolRequests/bob_alice", schoolRequest())
  ]), 403);
  await expect("request and seal field mismatch denied", await commit("bob", [
    w.set("seals/bob_alice", seal()),
    w.create("schoolRequests/bob_alice", schoolRequest({ field: "desireScript" }))
  ]), 403);
  await expect("bob requests with a sealed pledge", await commit("bob", [
    w.set("seals/bob_alice", seal()),
    w.create("schoolRequests/bob_alice", schoolRequest())
  ]), "ok");
  await expect("alice reads the incoming request", await get("schoolRequests/bob_alice", "alice"), "ok");
  await expect("carol cannot read the request", await get("schoolRequests/bob_alice", "carol"), 403);
  await expect("alice cannot read the seal before the school exists", await get("seals/bob_alice", "alice"), 403);
  await expect("bob reads his own seal", await get("seals/bob_alice", "bob"), "ok");
  await expect("bob cannot self-join alice's school", await commit("bob", [w.create("schools/alice/members/bob", { uid: "bob", number: 2, since: NOW })]), 403);
  await expect("bob cannot add alice to his school", await commit("bob", [w.create("schools/bob/members/alice", { uid: "alice", number: 1, since: NOW })]), 403);
  
  await expect("alice writes deep reading", await commit("alice", [w.create("deepReadings/1", { ownerUid: "alice", number: 1, updatedAt: NOW, codeGap: 40, authorityLean: 30, desireSplit: 80, shadowDistance: 55 })]), "ok");
  await expect("deep reading with a text denied", await commit("alice", [w.set("deepReadings/1", { ownerUid: "alice", number: 1, updatedAt: NOW, codeGap: 40, authorityLean: 30, desireSplit: 80, shadowDistance: 55, desireScript: "x" })]), 403);
  await expect("deep reading for someone else's number denied", await commit("bob", [w.create("deepReadings/1", { ownerUid: "bob", number: 1, updatedAt: NOW, codeGap: 1, authorityLean: 1, desireSplit: 1, shadowDistance: 1 })]), 403);
  await expect("outsider cannot read deep reading", await get("deepReadings/1", "bob"), 403);

  await expect(
    "alice accepts",
    await commit("alice", [
      w.create("schools/alice/members/bob", { uid: "bob", number: 2, since: NOW }),
      w.create("schools/bob/members/alice", { uid: "alice", number: 1, since: NOW }),
      w.remove("schoolRequests/bob_alice")
    ]),
    "ok"
  );
  await expect("request gone after accept", await get("schoolRequests/bob_alice", "alice"), 404);
  await expect("school member sees alias", await get("aliases/alicefish", "bob"), "ok");
  await expect("school member sees aliasOf", await get("aliasOf/1", "bob"), "ok");
  await expect("outsider still blocked", await get("aliases/alicefish", "carol"), 403);
  await expect("alice reads the pledge now", await get("seals/bob_alice", "alice"), "ok");
  await expect("school member reads deep reading", await get("deepReadings/1", "bob"), "ok");
  await expect("outsider still cannot read deep reading", await get("deepReadings/1", "carol"), 403);
  await expect("school member keeps the glint", await get("glints/alice_bob", "bob"), "ok");
  await expect("no duplicate request once in a school", await commit("bob", [
    w.set("seals/bob_alice", seal()),
    w.create("schoolRequests/bob_alice", schoolRequest())
  ]), 403);

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
  await expect("history none: school member blocked", await get(versionPath, "bob"), 403);
  await expect("history none: owner reads", await get(versionPath, "alice"), "ok");
  await expect("bad history level denied", await commit("alice", [w.patch("mindsets/1", { history: "friends" })]), 403);
  await expect("alice opens history to school", await commit("alice", [w.patch("mindsets/1", { history: "school" })]), "ok");
  await expect("history school: member reads", await get(versionPath, "bob"), "ok");
  await expect("history school: outsider blocked", await get(versionPath, "carol"), 403);
  await expect("history school: anonymous blocked", await get(versionPath), 403);
  await expect("alice opens history to everyone", await commit("alice", [w.patch("mindsets/1", { history: "public" })]), "ok");
  await expect("history public: anonymous reads", await get(versionPath), "ok");
  await expect("history public: list versions", await call("POST", ROOT + "/mindsets/1:runQuery", null, { structuredQuery: { from: [{ collectionId: "versions" }] } }), "ok");
  await expect("unpublished hides history", await commit("alice", [w.patch("mindsets/1", { published: false })]), "ok");
  await expect("history public but unpublished: blocked", await get(versionPath, "carol"), 403);
  await expect("alice republishes", await commit("alice", [w.patch("mindsets/1", { published: true, history: "none" })]), "ok");
  await expect("member reads school list", await call("POST", ROOT + "/schools/alice:runQuery", "bob", { structuredQuery: { from: [{ collectionId: "members" }] } }), "ok");
  await expect("outsider cannot read school list", await call("POST", ROOT + "/schools/alice:runQuery", "carol", { structuredQuery: { from: [{ collectionId: "members" }] } }), 403);

  await expect("stats create", await commit("alice", [w.create("stats/public", { lens: "v2", count: 0, axes: {} })]), "ok");
  await expect("stats increment slice", await commit("alice", [w.increment("stats/public", "byAge.a25_34.n")]), "ok");
  await expect("stats increment city", await commit("alice", [w.increment("stats/public", "cities.TR_izmir")]), "ok");
  await expect("stats unknown age key denied", await commit("alice", [w.increment("stats/public", "byAge.bogus.n")]), 403);
  await expect("stats unknown top-level denied", await commit("alice", [w.increment("stats/public", "junk")]), 403);

  await expect(
    "bob leaves the school",
    await commit("bob", [w.remove("schools/bob/members/alice"), w.remove("schools/alice/members/bob")]),
    "ok"
  );
  await expect("alias hidden again after leaving", await get("aliases/alicefish", "bob"), 403);
  await expect("deep reading hidden again after leaving", await get("deepReadings/1", "bob"), 403);
  await expect("pledge hidden again after leaving", await get("seals/bob_alice", "alice"), 403);
  await expect("deleting a missing pair doc is fine", await commit("bob", [w.remove("tails/bob_carol")]), "ok");
  await expect(
    "owner of mindset 1 can take firstfish",
    await commit("alice", [
      w.remove("aliases/alicefish"),
      w.set("aliases/firstfish", { ownerUid: "alice", number: 1 }),
      w.set("aliasOf/1", { ownerUid: "alice", alias: "firstfish" })
    ]),
    "ok"
  );

  // ---- Root (alice owns mindset 1) and test fish without accounts ----
  await commit("owner", [
    w.set("mindsets/10", mindset("sim10", 10, { seed: true })),
    w.set("mindsets/11", mindset("sim11", 11, { seed: true })),
    w.set("privateMindsets/10", privateDoc("sim10", 10, { desireScript: "Sim ten wants more." })),
    w.set("privateMindsets/11", privateDoc("sim11", 11, { desireScript: "Sim eleven hides." })),
    w.set("deepReadings/10", { ownerUid: "sim10", number: 10, updatedAt: NOW, codeGap: 10, authorityLean: 20, desireSplit: 30, shadowDistance: 40 })
  ]);
  var inDays = function (days) {
    return new Date(Date.now() + days * 86400000);
  };
  function simTail(from, to, fromNumber, toNumber) {
    return { from: from, to: to, fromNumber: fromNumber, toNumber: toNumber, createdAt: NOW };
  }
  function simGlint(from, to, fromNumber, toNumber, text) {
    return { from: from, to: to, fromNumber: fromNumber, toNumber: toNumber, field: "desireScript", text: text, createdAt: NOW, expiresAt: inDays(6) };
  }

  await expect("root tails on behalf of a test fish", await commit("alice", [w.create("tails/sim10_alice", simTail("sim10", "alice", 10, 1))]), "ok");
  await expect("root tails between two test fish", await commit("alice", [
    w.create("tails/sim10_sim11", simTail("sim10", "sim11", 10, 11)),
    ]), "ok");
  await expect("root tails the other way", await commit("alice", [w.create("tails/sim11_sim10", simTail("sim11", "sim10", 11, 10))]), "ok");
  await expect("non-root cannot act for a test fish", await commit("bob", [w.create("tails/sim11_alice", simTail("sim11", "alice", 11, 1))]), 403);
  await expect("root cannot act for a real fish", await commit("alice", [w.create("tails/bob_sim10", simTail("bob", "sim10", 2, 10))]), 403);
  await expect("test fish need their own number", await commit("alice", [w.create("tails/sim10_sim11", simTail("sim10", "sim11", 11, 11))]), 403);
  await expect("root reads all tails", await call("POST", ROOT + ":runQuery", "alice", { structuredQuery: { from: [{ collectionId: "tails" }] } }), "ok");
  await expect("non-root cannot read all tails", await call("POST", ROOT + ":runQuery", "bob", { structuredQuery: { from: [{ collectionId: "tails" }] } }), 403);

  await expect("root shines for a test fish", await commit("alice", [w.set("glints/sim10_sim11", simGlint("sim10", "sim11", 10, 11, "Sim ten wants more."))]), "ok");
  await expect("test fish glint must copy its own text", await commit("alice", [w.set("glints/sim10_sim11", simGlint("sim10", "sim11", 10, 11, "Made up."))]), 403);
  await expect("non-root cannot shine for a test fish", await commit("bob", [w.set("glints/sim10_sim11", simGlint("sim10", "sim11", 10, 11, "Sim ten wants more."))]), 403);
  await expect("root reads a test fish glint", await get("glints/sim10_sim11", "alice"), "ok");
  await expect("non-root cannot read it", await get("glints/sim10_sim11", "bob"), 403);
  await expect(
    "root lists glints",
    await call("POST", ROOT + ":runQuery", "alice", {
      structuredQuery: { from: [{ collectionId: "glints" }] }
    }),
    "ok"
  );
  await expect(
    "non-root cannot list every glint",
    await call("POST", ROOT + ":runQuery", "bob", {
      structuredQuery: { from: [{ collectionId: "glints" }] }
    }),
    403
  );

  await expect("root reads a test fish's closed text", await get("privateMindsets/10", "alice"), "ok");
  await expect("root cannot read a real fish's closed text", await get("privateMindsets/2", "alice"), 403);
  await expect("non-root cannot read a test fish's closed text", await get("privateMindsets/10", "bob"), 403);
  await expect("root reads a test fish's deep reading", await get("deepReadings/10", "alice"), "ok");
  await expect("others cannot read it", await get("deepReadings/10", "carol"), 403);

  await expect("test fish ask with a sealed pledge", await commit("alice", [
    w.set("seals/sim11_sim10", { from: "sim11", to: "sim10", fromNumber: 11, toNumber: 10, field: "desireScript", text: "Sim eleven hides.", createdAt: NOW }),
    w.create("schoolRequests/sim11_sim10", { from: "sim11", to: "sim10", fromNumber: 11, toNumber: 10, field: "desireScript", createdAt: NOW })
  ]), "ok");
  await expect("test fish cannot ask without a scale", await commit("alice", [
    w.set("seals/sim10_sim11", { from: "sim10", to: "sim11", fromNumber: 10, toNumber: 11, field: "desireScript", text: "Sim ten wants more.", createdAt: NOW }),
    w.create("schoolRequests/sim10_sim11", { from: "sim10", to: "sim11", fromNumber: 10, toNumber: 11, field: "desireScript", createdAt: NOW })
  ]), 403);
  await expect("root reads the sim request", await get("schoolRequests/sim11_sim10", "alice"), "ok");
  await expect("test fish accept", await commit("alice", [
    w.create("schools/sim10/members/sim11", { uid: "sim11", number: 11, since: NOW }),
    w.create("schools/sim11/members/sim10", { uid: "sim10", number: 10, since: NOW }),
    w.remove("schoolRequests/sim11_sim10"),
    w.remove("schoolRequests/sim10_sim11"),
    w.remove("seals/sim10_sim11")
  ]), "ok");
  await expect("test fish cannot join without a request", await commit("alice", [w.create("schools/sim10/members/carol", { uid: "carol", number: 3, since: NOW })]), 403);
  var anyMembers = { structuredQuery: { from: [{ collectionId: "members", allDescendants: true }] } };
  await expect("root lists every school", await call("POST", ROOT + ":runQuery", "alice", anyMembers), "ok");
  await expect("non-root cannot list every school", await call("POST", ROOT + ":runQuery", "bob", anyMembers), 403);

  // A real fish and a test fish shake hands through the real screens.
  await expect("bob tails a test fish", await commit("bob", [w.create("tails/bob_sim10", simTail("bob", "sim10", 2, 10))]), "ok");
  await expect("test fish shines for bob", await commit("alice", [w.set("glints/sim10_bob", simGlint("sim10", "bob", 10, 2, "Sim ten wants more."))]), "ok");
  await expect("bob reads the scale", await get("glints/sim10_bob", "bob"), "ok");
  await expect("bob asks the test fish", await commit("bob", [
    w.set("seals/bob_sim10", { from: "bob", to: "sim10", fromNumber: 2, toNumber: 10, field: "unsayableAttitude", text: "I envy quietly.", createdAt: NOW }),
    w.create("schoolRequests/bob_sim10", { from: "bob", to: "sim10", fromNumber: 2, toNumber: 10, field: "unsayableAttitude", createdAt: NOW })
  ]), "ok");
  await expect("root reads bob's pledge for the test fish", await get("seals/bob_sim10", "alice"), "ok");
  await expect("carol cannot read bob's pledge", await get("seals/bob_sim10", "carol"), 403);
  await expect("test fish accept bob", await commit("alice", [
    w.create("schools/sim10/members/bob", { uid: "bob", number: 2, since: NOW }),
    w.create("schools/bob/members/sim10", { uid: "sim10", number: 10, since: NOW }),
    w.remove("schoolRequests/bob_sim10"),
    w.remove("schoolRequests/sim10_bob"),
    w.remove("seals/sim10_bob")
  ]), "ok");
  await expect("bob now reads the test fish's alias path", await get("deepReadings/10", "bob"), "ok");

  await expect("root clears a test fish pair", await commit("alice", [w.remove("tails/sim10_sim11"), w.remove("glints/sim10_sim11")]), "ok");
  await expect("non-root cannot clear it", await commit("bob", [w.remove("tails/sim11_sim10")]), 403);
  await expect("root removes a test fish membership", await commit("alice", [w.remove("schools/sim10/members/sim11"), w.remove("schools/sim11/members/sim10")]), "ok");

  await expect("root writes the sim state", await commit("alice", [w.set("sim/state", { tick: 1 })]), "ok");
  await expect("root reads the sim state", await get("sim/state", "alice"), "ok");
  await expect("others cannot read the sim state", await get("sim/state", "bob"), 403);
  await expect("others cannot write the sim state", await commit("bob", [w.set("sim/state", { tick: 9 })]), 403);
  await expect("root logs a cycle", await commit("alice", [w.set("simTicks/1", { tick: 1 })]), "ok");
  await expect("others cannot read the cycle log", await get("simTicks/1", "carol"), 403);

  console.log(results.join("\n"));
  console.log("rules.emulator.js passed (" + results.length + " checks)");
})().catch(function (error) {
  console.log(results.join("\n"));
  console.error(error.message);
  process.exit(1);
});

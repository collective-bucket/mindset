"use strict";

/**
 * Creates 100 seed mindsets (skipping taken numbers such as 1 and 4).
 * Login: ms{N}@mindsetbucket.com / ms{NNNN}
 * Each public doc has seed:true so the UI can tell them apart.
 *
 * Usage: node scripts/seed-accounts.js
 * Needs network for Identity Toolkit, Firestore, and the embedding model.
 */

var fs = require("fs");
var path = require("path");
var reading = require("../public/assets/reading.js");
var lens = require("../public/assets/lens-v2.js");

var API_KEY = "AIzaSyDJsuk_SaPUJkzP9gnlpB6qet0TUQJ5uZA";
var PROJECT = "collective-bucket";
var TARGET = 100;
var CACHE = path.join("/tmp", "mindset-seed-cache.json");
var AUTH = "https://identitytoolkit.googleapis.com/v1";
var DB = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";

var AGE = ["18-24", "25-34", "25-34", "25-34", "35-44", "35-44", "45-54", "55-64", "65+"];
var GENDER = ["woman", "woman", "woman", "man", "man", "man", "nonbinary", "other"];
var PLACES = [
  { country: "TR", cities: ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Eskişehir"] },
  { country: "TR", cities: ["İstanbul", "Ankara", "İzmir"] },
  { country: "DE", cities: ["Berlin", "Munich", "Hamburg"] },
  { country: "US", cities: ["Austin", "Seattle", "Chicago"] },
  { country: "GB", cities: ["London", "Manchester", "Bristol"] },
  { country: "NL", cities: ["Amsterdam", "Utrecht"] },
  { country: "FR", cities: ["Paris", "Lyon"] },
  { country: "ES", cities: ["Madrid", "Barcelona"] },
  { country: "IT", cities: ["Milan", "Rome"] },
  { country: "SE", cities: ["Stockholm"] },
  { country: "PL", cities: ["Warsaw"] },
  { country: "BR", cities: ["São Paulo"] },
  { country: "JP", cities: ["Tokyo"] },
  { country: "CA", cities: ["Toronto"] },
  { country: "AU", cities: ["Melbourne"] }
];

var POSITIONS = {
  highAgency: [
    "I run my own studio and decide who I work with. Money is tight some months, but the choices are mine.",
    "I manage a small team and own the roadmap. When things break, I fix them or say no.",
    "I left a safer job last year. I plan the week, I chase invoices, and I do not wait for permission.",
    "I am between contracts on purpose. I set the rate and I walk if the brief is wrong."
  ],
  lowAgency: [
    "Work arrives and I take it. My manager sets the hours and I adjust around family.",
    "I am waiting on a visa and a landlord. Most weeks other people decide the next step.",
    "The company reorganized again. I keep my head down and hope the reorg leaves my desk alone.",
    "I care for someone at home, so my calendar is not really mine. I fit work into the gaps."
  ],
  midAgency: [
    "I freelanced for years and now I am back on payroll. I still negotiate, but less than before.",
    "Some projects I lead; some I just ship. It depends on who is louder that month.",
    "I share a flat and a shop with a partner. We split decisions, and sometimes that slows everything."
  ]
};

var CODES = {
  clear: [
    "I keep my word. If I say Friday, it is Friday. I do not gossip about people who trust me.",
    "No lying to clients. No taking credit for someone else's work. Those two lines do not move.",
    "I pay what I owe before I buy anything fun. Debt for toys is a line I will not cross.",
    "I tell the hard thing early. Softening bad news later costs more than honesty on day one."
  ],
  loose: [
    "Rules bend when people need them to. I care more about keeping the room calm than being exact.",
    "I change my mind when the room changes. Consistency matters less than not burning bridges.",
    "I promise what the moment needs and sort the details later. Rigid plans make me itchy.",
    "I borrow and lend without counting too carefully. Keeping score ruins friendship."
  ],
  mid: [
    "I try to be reliable, but I leave room for mood. Some weeks the rulebook is thicker.",
    "I keep a few hard lines around money and leave the rest flexible with people I like."
  ]
};

var STORIES = {
  redeemed: [
    "The worst year taught me I can rebuild. I lost the job, then built a quieter practice that fits.",
    "I burned out hard, rested longer than I wanted, and came back with clearer limits. The story turns toward repair.",
    "A friendship ended badly. We talked years later and it did not fix everything, but it closed the loop.",
    "I failed a launch in public. I wrote what I learned and the next one shipped smaller and cleaner."
  ],
  unresolved: [
    "It started well and then the company folded. I still tell that story as a warning more than a lesson.",
    "A caretaking season never really ended. I am proud and tired, and I do not see a neat ending yet.",
    "I moved countries and never felt settled. The plot keeps restarting without a clear arc.",
    "I kept waiting for someone else to apologize. That wait became the whole chapter."
  ],
  mixed: [
    "Some chapters resolved; some still sit open. I hold both without forcing a moral.",
    "I tell the comeback version at parties and the messier version to two friends. Both are true."
  ]
};

var COMMUNION = {
  us: [
    "I check on people. Dinner with the same three friends is a standing ritual.",
    "I am happiest when a project has a we. Solo wins feel thin after a week."
  ],
  alone: [
    "I keep to myself after work. Groups drain me faster than deadlines.",
    "I prefer one deep conversation to a room of acquaintances."
  ]
};

function pick(list, n) {
  return list[n % list.length];
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPersona(index) {
  var rnd = mulberry32(1000 + index * 97);
  var agencyBand = rnd() < 0.33 ? "highAgency" : rnd() < 0.5 ? "lowAgency" : "midAgency";
  var codeBand = rnd() < 0.4 ? "clear" : rnd() < 0.7 ? "loose" : "mid";
  var storyBand = rnd() < 0.4 ? "redeemed" : rnd() < 0.7 ? "unresolved" : "mixed";
  var withUs = rnd() < 0.55;
  var position = pick(POSITIONS[agencyBand], index);
  if (withUs) position += " " + pick(COMMUNION.us, index);
  else if (rnd() < 0.5) position += " " + pick(COMMUNION.alone, index);
  var place = pick(PLACES, Math.floor(rnd() * 40) + index);
  var historyRoll = rnd();
  return {
    texts: {
      currentPosition: position,
      personalCode: pick(CODES[codeBand], index + 3),
      selfNarrative: pick(STORIES[storyBand], index + 5),
      unsayableAttitude: "",
      desireScript: "",
      disownedSelf: ""
    },
    demo: {
      ageBand: pick(AGE, Math.floor(rnd() * 20) + index),
      gender: pick(GENDER, Math.floor(rnd() * 20) + index * 3),
      country: place.country,
      city: pick(place.cities, index)
    },
    history: historyRoll < 0.7 ? "none" : historyRoll < 0.9 ? "tribe" : "public"
  };
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") {
    var fields = {};
    Object.keys(value).forEach(function (key) {
      if (key === "id") return;
      fields[key] = encodeValue(value[key]);
    });
    return { mapValue: { fields: fields } };
  }
  throw new Error("bad type");
}

function encodeFields(data) {
  var fields = {};
  Object.keys(data).forEach(function (key) {
    if (key === "id") return;
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
    var fields = (node.mapValue && node.mapValue.fields) || {};
    Object.keys(fields).forEach(function (key) {
      out[key] = decodeValue(fields[key]);
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
  return data;
}

async function http(url, options) {
  options = options || {};
  var headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  var response = await fetch(url, {
    method: options.method || "GET",
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  var text = await response.text();
  var json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (error) {
    json = { raw: text };
  }
  if (!response.ok) {
    var err = new Error((json && json.error && json.error.message) || text || response.status);
    err.status = response.status;
    err.body = json;
    throw err;
  }
  return json;
}

function withKey(url) {
  return url + (url.indexOf("?") >= 0 ? "&" : "?") + "key=" + encodeURIComponent(API_KEY);
}

async function signUp(email, password) {
  try {
    return await http(withKey(AUTH + "/accounts:signUp"), {
      method: "POST",
      body: { email: email, password: password, returnSecureToken: true }
    });
  } catch (error) {
    if (/EMAIL_EXISTS/i.test(error.message)) {
      return http(withKey(AUTH + "/accounts:signInWithPassword"), {
        method: "POST",
        body: { email: email, password: password, returnSecureToken: true }
      });
    }
    throw error;
  }
}

async function getDoc(docPath, token) {
  try {
    var doc = await http(withKey(DB + "/" + docPath), {
      headers: token ? { Authorization: "Bearer " + token } : {}
    });
    return decodeDocument(doc);
  } catch (error) {
    // Rules deny reads of missing or unpublished docs as 403, not 404.
    if (error.status === 404 || error.status === 403) return null;
    throw error;
  }
}

async function createDoc(collection, id, data, token) {
  return http(withKey(DB + "/" + collection + "?documentId=" + encodeURIComponent(id)), {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: { fields: encodeFields(data) }
  });
}

async function patchDoc(docPath, data, token) {
  var mask = Object.keys(data)
    .filter(function (key) {
      return key !== "id";
    })
    .map(function (key) {
      return "updateMask.fieldPaths=" + encodeURIComponent(key);
    })
    .join("&");
  return http(withKey(DB + "/" + docPath + "?" + mask), {
    method: "PATCH",
    headers: { Authorization: "Bearer " + token },
    body: { fields: encodeFields(data) }
  });
}

async function commit(writes, token) {
  // Hosting client uses .../documents:commit (not .../databases/(default):commit).
  return http(withKey(DB + ":commit"), {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: { writes: writes }
  });
}

function incrementWrite(deltas) {
  var transforms = deltas.map(function (item) {
    return {
      fieldPath: item.path,
      increment: { integerValue: String(item.by) }
    };
  });
  return {
    transform: {
      document: "projects/" + PROJECT + "/databases/(default)/documents/stats/public",
      fieldTransforms: transforms
    }
  };
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function loadScorer() {
  var modulePath = require.resolve("@huggingface/transformers", {
    paths: [path.join("/tmp/mindset-seed"), process.cwd()]
  });
  var imported = await import(modulePath);
  var transformers = imported.default || imported;
  if (transformers.env) transformers.env.allowLocalModels = false;
  console.log("loading embedding model…");
  var extractor = await transformers.pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
    dtype: "q8"
  });
  var poleCache = {};
  var CHUNK = 480;

  function asVector(output) {
    var list = output && output.tolist ? output.tolist() : output;
    if (list && Array.isArray(list[0])) return list[0];
    return Array.from(list);
  }

  function meanNormalize(vectors) {
    var dim = vectors[0].length;
    var acc = new Array(dim).fill(0);
    vectors.forEach(function (vector) {
      for (var i = 0; i < dim; i += 1) acc[i] += vector[i];
    });
    var norm = 0;
    for (var j = 0; j < dim; j += 1) {
      acc[j] /= vectors.length;
      norm += acc[j] * acc[j];
    }
    norm = Math.sqrt(norm) || 1;
    for (var k = 0; k < dim; k += 1) acc[k] /= norm;
    return acc;
  }

  function dot(left, right) {
    var sum = 0;
    for (var i = 0; i < left.length; i += 1) sum += left[i] * right[i];
    return sum;
  }

  async function embedRaw(text) {
    var output = await extractor("query: " + text, { pooling: "mean", normalize: true });
    return asVector(output);
  }

  async function embedDocument(text) {
    var clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return null;
    var parts = [];
    for (var i = 0; i < clean.length; i += CHUNK) parts.push(clean.slice(i, i + CHUNK));
    var vectors = [];
    for (var p = 0; p < parts.length; p += 1) vectors.push(await embedRaw(parts[p]));
    return vectors.length === 1 ? vectors[0] : meanNormalize(vectors);
  }

  async function embedPole(anchors) {
    var list = anchors.en.concat(anchors.tr);
    var key = list.join("\n");
    if (!poleCache[key]) {
      var vectors = [];
      for (var i = 0; i < list.length; i += 1) vectors.push(await embedRaw(list[i]));
      poleCache[key] = meanNormalize(vectors);
    }
    return poleCache[key];
  }

  return async function scoreTexts(texts) {
    var scores = reading.blankScores();
    for (var index = 0; index < lens.axes.length; index += 1) {
      var axis = lens.axes[index];
      if (axis.kind === "polarity") {
        var source = reading.joinFields(texts, axis.sources);
        if (!source) continue;
        var vector = await embedDocument(source);
        var low = await embedPole(axis.lowAnchors);
        var high = await embedPole(axis.highAnchors);
        scores[axis.key] = reading.polarityScore(dot(vector, low), dot(vector, high), axis.calibration);
        continue;
      }
      var leftText = reading.joinFields(texts, axis.left);
      var rightText = reading.joinFields(texts, axis.right);
      if (!leftText || !rightText) continue;
      var left = await embedDocument(leftText);
      var right = await embedDocument(rightText);
      scores[axis.key] = reading.distanceScore(dot(left, right));
    }
    return scores;
  };
}

async function takenNumbers() {
  var taken = { 1: true };
  var page = await http(withKey(DB + ":runQuery"), {
    method: "POST",
    body: {
      structuredQuery: {
        from: [{ collectionId: "mindsets" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "published" },
            op: "EQUAL",
            value: { booleanValue: true }
          }
        },
        select: { fields: [{ fieldPath: "number" }] },
        limit: 500
      }
    }
  });
  (page || []).forEach(function (row) {
    if (!row.document) return;
    var doc = decodeDocument(row.document);
    if (doc && doc.number) taken[doc.number] = true;
  });
  return taken;
}

function passwordFor(n) {
  return "ms" + String(n).padStart(4, "0");
}

function aliasFor(n) {
  return "ms" + String(n).padStart(4, "0");
}

function emailFor(n) {
  return "ms" + n + "@mindsetbucket.com";
}

async function main() {
  var taken = await takenNumbers();
  var numbers = [];
  for (var n = 2; numbers.length < TARGET; n += 1) {
    if (!taken[n]) numbers.push(n);
  }
  console.log("will seed numbers", numbers[0] + "…" + numbers[numbers.length - 1], "(" + numbers.length + ")");

  var cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : { scores: {} };
  var score = await loadScorer();
  var personas = {};

  for (var i = 0; i < numbers.length; i += 1) {
    var number = numbers[i];
    var persona = buildPersona(number);
    personas[number] = persona;
    var cacheKey = String(number);
    if (!cache.scores[cacheKey]) {
      process.stdout.write("score #" + number + "… ");
      cache.scores[cacheKey] = await score(persona.texts);
      fs.writeFileSync(CACHE, JSON.stringify(cache));
      console.log(
        "agency=" + cache.scores[cacheKey].agency,
        "communion=" + cache.scores[cacheKey].communion,
        "code=" + cache.scores[cacheKey].codeClarity,
        "redemption=" + cache.scores[cacheKey].redemption
      );
    }
  }

  var created = 0;
  var skipped = 0;
  var failed = [];
  var lastToken = null;
  var maxNumber = 1;

  for (var j = 0; j < numbers.length; j += 1) {
    var num = numbers[j];
    maxNumber = Math.max(maxNumber, num);
    var email = emailFor(num);
    var password = passwordFor(num);
    var alias = aliasFor(num);
    var person = personas[num];
    var scores = cache.scores[String(num)];
    try {
      var existing = await getDoc("mindsets/" + num);
      if (existing && !existing.seed) {
        console.log("skip #" + num + " (real account)");
        skipped += 1;
        continue;
      }
      if (existing && existing.seed) {
        console.log("skip #" + num + " (already seeded)");
        skipped += 1;
        continue;
      }

      var auth = await signUp(email, password);
      lastToken = auth.idToken;
      var uid = auth.localId;
      var now = new Date().toISOString();
      var docs = reading.buildDocuments(
        uid,
        num,
        person.texts,
        scores,
        true,
        now,
        now,
        person.demo,
        person.history,
        true
      );

      await createDoc("mindsets", String(num), docs.publicDoc, auth.idToken);
      await createDoc("privateMindsets", String(num), docs.privateDoc, auth.idToken);
      await createDoc("owners", uid, { number: num }, auth.idToken);
      await createDoc(
        "mindsets/" + num + "/versions",
        reading.versionId(now),
        reading.buildVersion(docs.publicDoc),
        auth.idToken
      );

      try {
        await commit(
          [
            {
              update: {
                name: "projects/" + PROJECT + "/databases/(default)/documents/aliases/" + alias,
                fields: encodeFields({ ownerUid: uid, number: num })
              },
              currentDocument: { exists: false }
            },
            {
              update: {
                name: "projects/" + PROJECT + "/databases/(default)/documents/aliasOf/" + num,
                fields: encodeFields({ ownerUid: uid, alias: alias })
              },
              currentDocument: { exists: false }
            }
          ],
          auth.idToken
        );
      } catch (error) {
        console.log("alias warn #" + num, error.message);
      }

      var deltas = reading.histogramDelta(null, {
        published: true,
        scores: scores,
        demo: person.demo
      });
      if (deltas.length) {
        try {
          await commit([incrementWrite(deltas)], auth.idToken);
        } catch (error) {
          console.log("stats warn #" + num, error.message);
        }
      }

      created += 1;
      console.log("ok #" + num, email, password, "@" + alias, person.demo.country, person.demo.gender);
      await sleep(120);
    } catch (error) {
      failed.push({ number: num, error: error.message });
      console.log("FAIL #" + num, error.message);
      await sleep(400);
    }
  }

  if (lastToken) {
    try {
      var counter = await getDoc("counters/mindset", lastToken);
      var next = Math.max((counter && counter.next) || 1, maxNumber + 1);
      if (!counter) await createDoc("counters", "mindset", { next: next }, lastToken);
      else if (counter.next < next) await patchDoc("counters/mindset", { next: next }, lastToken);
      console.log("counter next =", next);
    } catch (error) {
      console.log("counter warn", error.message);
    }
  }

  console.log(JSON.stringify({ created: created, skipped: skipped, failed: failed.length, fails: failed }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});

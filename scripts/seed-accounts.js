"use strict";

/**
 * Creates 100 seed mindsets numbered 2–101.
 * Login: {N}@ms.com / monkey{N}
 * Open texts are Turkish. Each public doc has seed:true.
 *
 * Usage: NODE_PATH=/tmp/mindset-seed/node_modules node scripts/seed-accounts.js
 */

var fs = require("fs");
var path = require("path");
var reading = require("../public/assets/reading.js");
var lens = require("../public/assets/lens-v2.js");

var API_KEY = "AIzaSyDJsuk_SaPUJkzP9gnlpB6qet0TUQJ5uZA";
var PROJECT = "collective-bucket";
var TARGET = 100;
var FIRST = 2;
var CACHE = path.join("/tmp", "mindset-seed-cache-tr.json");
var AUTH = "https://identitytoolkit.googleapis.com/v1";
var DB = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";

var AGE = ["18-24", "25-34", "25-34", "25-34", "35-44", "35-44", "45-54", "55-64", "65+"];
var GENDER = ["woman", "woman", "woman", "man", "man", "man", "nonbinary", "other"];
var PLACES = [
  { country: "TR", cities: ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Eskişehir"] },
  { country: "TR", cities: ["İstanbul", "Ankara", "İzmir"] },
  { country: "DE", cities: ["Berlin", "Münih", "Hamburg"] },
  { country: "US", cities: ["Austin", "Seattle", "Chicago"] },
  { country: "GB", cities: ["Londra", "Manchester", "Bristol"] },
  { country: "NL", cities: ["Amsterdam", "Utrecht"] },
  { country: "FR", cities: ["Paris", "Lyon"] },
  { country: "ES", cities: ["Madrid", "Barcelona"] },
  { country: "IT", cities: ["Milano", "Roma"] },
  { country: "SE", cities: ["Stockholm"] },
  { country: "PL", cities: ["Varşova"] },
  { country: "BR", cities: ["São Paulo"] },
  { country: "JP", cities: ["Tokyo"] },
  { country: "CA", cities: ["Toronto"] },
  { country: "AU", cities: ["Melbourne"] }
];

var POSITIONS = {
  highAgency: [
    "Kendi stüdyomu yönetiyorum; kiminle çalışacağıma ben karar veriyorum. Para bazı aylar dar, ama seçimler bende.",
    "Küçük bir ekibi yönetiyorum ve yol haritası bende. Bir şey kırılınca ya ben düzeltiyorum ya da hayır diyorum.",
    "Geçen yıl daha güvenli işi bıraktım. Haftayı ben planlıyorum, faturaların peşine ben düşüyorum, izin beklemiyorum.",
    "Bilerek sözleşmeler arasında boşluk bıraktım. Ücreti ben koyuyorum; brief yanlışsa yürüyorum."
  ],
  lowAgency: [
    "İş geliyor, ben alıyorum. Saatleri müdürüm belirliyor; ben aileye göre ayarlıyorum.",
    "Vize ve ev sahibini bekliyorum. Çoğu hafta bir sonraki adımı başkaları kararlaştırıyor.",
    "Şirket yine yeniden düzenlendi. Başımı eğip masamın kalmasını umuyorum.",
    "Evde birine bakıyorum; takvim gerçekten benim değil. İşi boşluklara sıkıştırıyorum."
  ],
  midAgency: [
    "Yıllarca freelance çalıştım, şimdi yine bordrodayım. Hâlâ pazarlık ederim ama eskisi kadar değil.",
    "Bazı işleri ben yönetirim, bazılarını sadece teslim ederim. O ay kim daha gürültülüyse ona kalır.",
    "Evi ve dükkânı bir ortakla paylaşıyorum. Kararları bölüşüyoruz; bazen her şey yavaşlıyor."
  ]
};

var CODES = {
  clear: [
    "Sözüm sözdür. Cuma dedimse cumadır. Bana güvenenlerin arkasından konuşmam.",
    "Müşteriye yalan yok. Başkasının işine sahip çıkmak yok. Bu iki çizgi kıpırdamaz.",
    "Eğlenceye para basmadan önce borcumu öderim. Oyuncak için borç çizgim değildir.",
    "Zor olanı erken söylerim. Kötü haberi yumuşatmak birinci günden pahalıya patlar."
  ],
  loose: [
    "Kurallar gerektiğinde esner. Doğru olmaktan çok odanın sakin kalmasını önemserim.",
    "Ortam değişince fikrim de değişir. Köprü yakmamak tutarlılıktan önemli.",
    "Anın istediğini söz veririm, ayrıntıyı sonra çözerim. Katı planlar beni kaşındırır.",
    "Ödünç alıp verirken fazla saymam. Hesap tutmak dostluğu bozar."
  ],
  mid: [
    "Güvenilir olmaya çalışırım ama ruh haline yer bırakırım. Bazı haftalar kural kitabı kalınlaşır.",
    "Parada birkaç sert çizgim var; sevdiğim insanlarda geri kalanı esnek bırakırım."
  ]
};

var STORIES = {
  redeemed: [
    "En kötü yıl yeniden kurabileceğimi öğretti. İşi kaybettim, sonra bana uyan daha sakin bir düzen kurdum.",
    "Sert bir tükenmişlik yaşadım, istediğimden uzun dinlendim, daha net sınırlarla döndüm. Hikâye onarıma dönüyor.",
    "Bir dostluk kötü bitti. Yıllar sonra konuştuk; her şeyi düzeltmedi ama döngüyü kapattı.",
    "Bir lansmanı herkesin önünde batırdım. Öğrendiklerimi yazdım; sonraki daha küçük ve temiz çıktı."
  ],
  unresolved: [
    "İyi başladı, sonra şirket battı. O hikâyeyi dersten çok uyarı gibi anlatıyorum.",
    "Bakım dönemi hiç bitmedi. Gururluyum ve yorgunum; düzgün bir son görmüyorum.",
    "Ülke değiştirdim, hiç yerleşmedim. Konu net bir yay olmadan yeniden başlıyor.",
    "Birinin özür dilemesini bekledim. O bekleme bütün bölüm oldu."
  ],
  mixed: [
    "Bazı bölümler kapandı, bazıları hâlâ açık. Zorla ahlak çıkarmadan ikisini birden tutuyorum.",
    "Partilerde toparlanma versiyonunu, iki arkadaşa daha dağınık olanı anlatırım. İkisi de doğru."
  ]
};

var COMMUNION = {
  us: [
    "İnsanları ararım. Aynı üç arkadaşla yemek ayakta bir ritüel.",
    "Bir işte biz olunca en mutluyum. Tek başıma zafer bir haftada inceliyor."
  ],
  alone: [
    "İşten sonra kendi başıma kalırım. Gruplar beni teslim tarihlerinden çabuk tüketir.",
    "Tanıdık dolu bir odadan çok tek derin sohbeti tercih ederim."
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
  return "monkey" + n;
}

function aliasFor(n) {
  return "ms" + n;
}

function emailFor(n) {
  return n + "@ms.com";
}

async function main() {
  var taken = await takenNumbers();
  var numbers = [];
  for (var n = FIRST; numbers.length < TARGET; n += 1) {
    if (taken[n]) {
      console.log("skip taken #" + n);
      continue;
    }
    numbers.push(n);
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

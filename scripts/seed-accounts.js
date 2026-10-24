"use strict";

/**
 * Creates 100 sim mindsets numbered 2–101 with ownerUid sim{N} (no Auth).
 * Open + closed texts are Turkish. Public docs have seed:true.
 * Needs firebase-tools login (admin token bypasses rules).
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
var CACHE = path.join("/tmp", "mindset-seed-cache-sim-tr.json");
var DB = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";
var DOC_PREFIX = "projects/" + PROJECT + "/databases/(default)/documents/";

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

var CLOSED = {
  unsayable: [
    "Bazen yakınlarımın başarısını kıskandığımı kimseye söylemiyorum.",
    "Yardım isterken küçüldüğümü hissediyorum; onu da saklıyorum.",
    "Öfkem çoğu zaman korkudan geliyor; bunu itiraf etmek zor.",
    "Sevilmeye layık olmadığımı düşündüğüm geceler oluyor."
  ],
  desire: [
    "Daha az çalışıp daha net seçmek istiyorum ama tembel görünmekten korkuyorum.",
    "Birinin beni tamamen görmesini istiyorum; aynı anda kaçmak da.",
    "Güvenli bir isim ve sabit bir adres istiyorum, sonra yine hareket.",
    "Sahneye çıkmak istiyorum; sahne ışığı beni yakıyor gibi."
  ],
  disowned: [
    "İçimdeki sert yargıcı tanımıyorum; dışarıda nazik duruyorum.",
    "Kontrolcü tarafımı inkâr ediyorum; 'sadece düzenliyorum' diyorum.",
    "Bağımlı tarafımı saklıyorum; herkese yetiyormuşum gibi.",
    "Kırılgan çocuğu kapalı tutuyorum; yetişkin maskesi yapışık."
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
      unsayableAttitude: pick(CLOSED.unsayable, index + 7),
      desireScript: pick(CLOSED.desire, index + 11),
      disownedSelf: pick(CLOSED.disowned, index + 13)
    },
    demo: {
      ageBand: pick(AGE, Math.floor(rnd() * 20) + index),
      gender: pick(GENDER, Math.floor(rnd() * 20) + index * 3),
      country: place.country,
      city: pick(place.cities, index)
    },
    history: historyRoll < 0.7 ? "none" : historyRoll < 0.9 ? "school" : "public"
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

function adminToken() {
  return require(process.env.HOME + "/.config/configstore/firebase-tools.json").tokens.access_token;
}

function adminHeaders(token) {
  return {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
    "x-goog-user-project": PROJECT
  };
}

function withKey(url) {
  return url + (url.indexOf("?") >= 0 ? "&" : "?") + "key=" + encodeURIComponent(API_KEY);
}

async function getDoc(docPath, token) {
  try {
    var doc = await http(DB + "/" + docPath, {
      headers: token ? adminHeaders(token) : { "Content-Type": "application/json" }
    });
    return decodeDocument(doc);
  } catch (error) {
    if (error.status === 404 || error.status === 403) return null;
    throw error;
  }
}

async function commit(writes, token) {
  return http(DB + ":commit", {
    method: "POST",
    headers: adminHeaders(token),
    body: { writes: writes }
  });
}

function setWrite(path, data) {
  return {
    update: {
      name: DOC_PREFIX + path,
      fields: encodeFields(data)
    }
  };
}

function deleteWrite(path) {
  return { delete: DOC_PREFIX + path };
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

async function takenNumbers(token) {
  var taken = { 1: true };
  var pageToken = null;
  for (;;) {
    var url = DB + "/mindsets?pageSize=300" + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    var page = await http(url, { headers: adminHeaders(token) });
    (page.documents || []).forEach(function (raw) {
      var doc = decodeDocument(raw);
      if (doc && doc.number) taken[doc.number] = true;
      else if (doc && doc.id) taken[Number(doc.id)] = true;
    });
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }
  return taken;
}

// One lake name per sim number, starting at FIRST. Stable so a fish keeps its alias.
var SIM_ALIASES = [
  "derin", "kiyi", "yanki", "puslu", "sisli", "dalga", "mercan", "yosun", "kabuk", "inci",
  "fener", "pusula", "liman", "iskele", "kayik", "yelken", "rota", "gelgit", "resif", "lagun",
  "koy", "burun", "atol", "bogaz", "delta", "menderes", "caglayan", "pinar", "golge", "ayna",
  "kuyruk", "solungac", "yuzgec", "kabarcik", "kopuk", "cereyan", "akinti", "girdap", "esinti", "ufuk",
  "sahil", "kumsal", "midye", "istiridye", "ahtapot", "yunus", "orkinos", "hamsi", "levrek", "cipura",
  "kefal", "palamut", "barbun", "tekir", "mezgit", "kalkan", "sessiz", "duru", "berrak", "bulut",
  "damla", "yagmur", "camur", "dere", "irmak", "nehir", "kaynak", "sarnic", "gececi", "kiyici",
  "derinci", "yankici", "pusluca", "sislica", "dalgaci", "mercanci", "yosuncu", "kabukcu", "incici", "fenerci",
  "limanci", "iskeleci", "kayikci", "yelkenci", "rotaci", "resifci", "laguncu", "koycu", "burnucu", "atolcu",
  "bogazci", "deltaci", "pinarci", "golgeci", "aynaci", "kuyrukcu", "akintici", "girdapci", "esintici", "ufukcu"
];

function aliasFor(n) {
  var index = n - FIRST;
  if (index >= 0 && index < SIM_ALIASES.length) return SIM_ALIASES[index];
  return ("balik" + n).slice(0, 20);
}

function simUid(n) {
  return "sim" + n;
}

async function listMindsets(token) {
  var rows = [];
  var pageToken = null;
  for (;;) {
    var url = DB + "/mindsets?pageSize=300" + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    var page = await http(url, { headers: adminHeaders(token) });
    (page.documents || []).forEach(function (raw) {
      var doc = decodeDocument(raw);
      if (doc) rows.push(doc);
    });
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }
  return rows;
}

async function chosenAlias(token, num, uid) {
  var want = aliasFor(num);
  var holder = await getDoc("aliases/" + want, token);
  if (holder && String(holder.ownerUid) !== uid) return (want + num).slice(0, 20);
  return want;
}

async function ensureAlias(token, num, uid) {
  var alias = await chosenAlias(token, num, uid);
  var current = await getDoc("aliasOf/" + num, token);
  if (current && current.alias === alias && current.ownerUid === uid) return { alias: alias, changed: false };
  var writes = [];
  if (current && current.alias && current.alias !== alias) {
    var old = await getDoc("aliases/" + current.alias, token);
    if (old && String(old.ownerUid) === uid) writes.push(deleteWrite("aliases/" + current.alias));
  }
  writes.push(
    setWrite("aliases/" + alias, { ownerUid: uid, number: num }),
    setWrite("aliasOf/" + num, { ownerUid: uid, alias: alias })
  );
  await commit(writes, token);
  return { alias: alias, changed: true };
}

async function backfillAliases(token) {
  var rows = await listMindsets(token);
  var updated = 0;
  var kept = 0;
  for (var i = 0; i < rows.length; i += 1) {
    var doc = rows[i];
    if (doc.seed !== true || !/^sim[0-9]+$/.test(String(doc.ownerUid || ""))) continue;
    var num = Number(doc.number || doc.id);
    if (!num) continue;
    var result = await ensureAlias(token, num, String(doc.ownerUid));
    if (result.changed) {
      updated += 1;
      console.log("alias #" + num, "@" + result.alias);
    } else {
      kept += 1;
    }
    await sleep(40);
  }
  console.log("aliases updated", updated, "already set", kept);
}

async function main() {
  var token = adminToken();
  await backfillAliases(token);
  var taken = await takenNumbers(token);
  var numbers = [];
  for (var n = FIRST; numbers.length < TARGET; n += 1) {
    if (taken[n]) {
      console.log("skip taken #" + n);
      continue;
    }
    numbers.push(n);
  }
  if (!numbers.length) {
    console.log("nothing to seed");
    return;
  }
  console.log("will seed sim fish", numbers[0] + "…" + numbers[numbers.length - 1], "(" + numbers.length + ")");

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
        "redemption=" + cache.scores[cacheKey].redemption,
        "gap=" + cache.scores[cacheKey].codeGap
      );
    }
  }

  var created = 0;
  var skipped = 0;
  var failed = [];
  var maxNumber = 1;

  for (var j = 0; j < numbers.length; j += 1) {
    var num = numbers[j];
    maxNumber = Math.max(maxNumber, num);
    var uid = simUid(num);
    var alias = await chosenAlias(token, num, uid);
    var person = personas[num];
    var scores = cache.scores[String(num)];
    try {
      var existing = await getDoc("mindsets/" + num, token);
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
        true,
        "tr"
      );
      var version = reading.buildVersion(docs.publicDoc);
      var deep = {
        ownerUid: uid,
        number: num,
        updatedAt: now,
        codeGap: scores.codeGap,
        authorityLean: scores.authorityLean,
        desireSplit: scores.desireSplit,
        shadowDistance: scores.shadowDistance
      };

      await commit(
        [
          setWrite("mindsets/" + num, docs.publicDoc),
          setWrite("privateMindsets/" + num, docs.privateDoc),
          setWrite("owners/" + uid, { number: num }),
          setWrite("deepReadings/" + num, deep),
          setWrite("mindsets/" + num + "/versions/" + reading.versionId(now), version),
          setWrite("aliases/" + alias, { ownerUid: uid, number: num }),
          setWrite("aliasOf/" + num, { ownerUid: uid, alias: alias })
        ],
        token
      );

      var deltas = reading.histogramDelta(null, {
        published: true,
        scores: scores,
        demo: person.demo
      });
      if (deltas.length) {
        try {
          await commit([incrementWrite(deltas)], token);
        } catch (error) {
          console.log("stats warn #" + num, error.message);
        }
      }

      created += 1;
      console.log("ok #" + num, uid, "@" + alias, person.demo.country, person.demo.gender);
      await sleep(80);
    } catch (error) {
      failed.push({ number: num, error: error.message });
      console.log("FAIL #" + num, error.message);
      await sleep(300);
    }
  }

  try {
    var counter = await getDoc("counters/mindset", token);
    var next = Math.max((counter && counter.next) || 1, maxNumber + 1);
    await commit([setWrite("counters/mindset", { next: next })], token);
    console.log("counter next =", next);
  } catch (error) {
    console.log("counter warn", error.message);
  }

  console.log(JSON.stringify({ created: created, skipped: skipped, failed: failed.length, fails: failed }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});

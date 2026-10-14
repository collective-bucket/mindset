(function (root) {
  "use strict";

  var lens = root.MindsetLens;
  if (!lens && typeof require === "function") lens = require("./lens-v1.js");

  var OPEN_KEYS = ["agency", "communion", "codeClarity", "redemption"];
  var CLOSED_KEYS = ["codeGap", "authorityLean", "desireSplit", "shadowDistance"];
  var CLOSED_TEXT_KEYS = ["unsayableAttitude", "desireScript", "disownedSelf"];

  function clamp01(value) {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  function polarityScore(cosLow, cosHigh) {
    // Bu modelde kutuplar arası kosinüs farkı çoğu kez 0.02 civarındadır.
    // Fark 20 ile açılır; 0 hâlâ orta noktadır.
    var delta = cosHigh - cosLow;
    return Math.round(clamp01((20 * delta + 2) / 4) * 100);
  }

  function distanceScore(cos) {
    // Aynı cümle 1, yakın anlatım ~0.93, ilgisiz Türkçe ~0.82.
    var close = 0.93;
    var far = 0.82;
    return Math.round(clamp01((close - cos) / (close - far)) * 100);
  }

  function quintileKey(score) {
    if (typeof score !== "number" || score < 0) return null;
    if (score >= 80) return "b4";
    if (score >= 60) return "b3";
    if (score >= 40) return "b2";
    if (score >= 20) return "b1";
    return "b0";
  }

  function bucketChar(score) {
    var key = quintileKey(score);
    return key ? key.slice(1) : "u";
  }

  function bucket(scores) {
    return OPEN_KEYS.map(function (key) {
      return bucketChar(scores[key]);
    }).join("");
  }

  function knownOpen(scores) {
    return OPEN_KEYS.filter(function (key) {
      return typeof scores[key] === "number" && scores[key] >= 0;
    });
  }

  function cap(sentence) {
    if (!sentence) return "";
    return sentence.charAt(0).toLocaleUpperCase("tr-TR") + sentence.slice(1);
  }

  function summary(number, scores) {
    var parts = [];
    if (scores.agency >= 60) parts.push("iş bende");
    else if (scores.agency >= 0 && scores.agency <= 40) parts.push("iş bende değil");
    if (scores.codeClarity >= 60) parts.push("kuralı net");
    else if (scores.codeClarity >= 0 && scores.codeClarity <= 40) parts.push("kuralı gevşek");

    var sentences = [];
    if (parts.length) sentences.push(cap(parts.join(" ve ")) + ".");
    if (scores.redemption >= 60) sentences.push("Hikaye düze çıkıyor.");
    else if (scores.redemption >= 0 && scores.redemption <= 40) sentences.push("Hikaye düze çıkmıyor.");
    if (scores.communion >= 60) sentences.push("Bir aradayım.");
    else if (scores.communion >= 0 && scores.communion <= 40) sentences.push("Kendi başımayım.");

    if (!sentences.length) return String(number) + ". Açık okuma ortada duruyor.";
    return String(number) + ". " + sentences.join(" ");
  }

  function placements(scores, published) {
    var out = {};
    if (!published) return out;
    OPEN_KEYS.forEach(function (key) {
      var quintile = quintileKey(scores[key]);
      if (quintile) out[key] = quintile;
    });
    return out;
  }

  function histogramDelta(previous, next) {
    var before = placements(
      previous ? previous.scores : {},
      previous ? previous.published : false
    );
    var after = placements(next.scores, next.published);
    var keys = {};
    Object.keys(before).forEach(function (key) {
      keys[key] = true;
    });
    Object.keys(after).forEach(function (key) {
      keys[key] = true;
    });

    return Object.keys(keys).reduce(function (deltas, key) {
      var from = before[key];
      var to = after[key];
      if (from && from !== to) {
        deltas.push({ path: "axes." + key + "." + from, by: -1 });
      }
      if (to && to !== from) {
        deltas.push({ path: "axes." + key + "." + to, by: 1 });
      }
      return deltas;
    }, []);
  }

  function blankScores() {
    var scores = {};
    OPEN_KEYS.concat(CLOSED_KEYS).forEach(function (key) {
      scores[key] = -1;
    });
    return scores;
  }

  function normalizeTexts(raw) {
    var texts = {};
    lens.fields.forEach(function (field) {
      var value = String((raw && raw[field.key]) || "").replace(/\s+$/g, "").replace(/^\s+/g, "");
      if (value.length > lens.maxChars) {
        throw new Error(field.label + " 1200 karakteri aşamaz.");
      }
      texts[field.key] = value;
    });
    if (!texts.personalCode) {
      throw new Error("Yayınlamak için doğru bildiğin bir cümle yaz.");
    }
    return texts;
  }

  function joinFields(texts, keys) {
    return keys
      .map(function (key) {
        return String((texts && texts[key]) || "").trim();
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function buildDocuments(uid, number, texts, scores, published, createdAt, now) {
    var numberKey = String(number);
    var when = now || new Date().toISOString();
    return {
      publicDoc: {
        ownerUid: uid,
        number: number,
        numberKey: numberKey,
        published: published,
        createdAt: createdAt || when,
        updatedAt: when,
        lens: lens.version,
        agency: scores.agency,
        communion: scores.communion,
        codeClarity: scores.codeClarity,
        redemption: scores.redemption,
        known: knownOpen(scores),
        bucket: bucket(scores),
        currentPosition: texts.currentPosition,
        personalCode: texts.personalCode,
        selfNarrative: texts.selfNarrative
      },
      privateDoc: {
        ownerUid: uid,
        number: number,
        numberKey: numberKey,
        lens: lens.version,
        updatedAt: when,
        unsayableAttitude: texts.unsayableAttitude,
        desireScript: texts.desireScript,
        disownedSelf: texts.disownedSelf,
        codeGap: scores.codeGap,
        authorityLean: scores.authorityLean,
        desireSplit: scores.desireSplit,
        shadowDistance: scores.shadowDistance
      }
    };
  }

  function scoresOf(doc) {
    var scores = blankScores();
    if (!doc) return scores;
    OPEN_KEYS.concat(CLOSED_KEYS).forEach(function (key) {
      if (typeof doc[key] === "number") scores[key] = doc[key];
    });
    return scores;
  }

  var api = {
    OPEN_KEYS: OPEN_KEYS,
    CLOSED_KEYS: CLOSED_KEYS,
    CLOSED_TEXT_KEYS: CLOSED_TEXT_KEYS,
    polarityScore: polarityScore,
    distanceScore: distanceScore,
    quintileKey: quintileKey,
    bucket: bucket,
    knownOpen: knownOpen,
    summary: summary,
    histogramDelta: histogramDelta,
    blankScores: blankScores,
    normalizeTexts: normalizeTexts,
    joinFields: joinFields,
    buildDocuments: buildDocuments,
    scoresOf: scoresOf
  };

  root.MindsetReading = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

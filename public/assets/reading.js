(function (root) {
  "use strict";

  var lens = root.MindsetLens;
  var demographics = root.MindsetDemographics;
  if (!lens && typeof require === "function") lens = require("./lens-v2.js");
  if (!demographics && typeof require === "function") demographics = require("./demographics.js");

  var OPEN_KEYS = ["agency", "communion", "codeClarity", "redemption"];
  var CLOSED_KEYS = ["codeGap", "authorityLean", "desireSplit", "shadowDistance"];
  var CLOSED_TEXT_KEYS = ["unsayableAttitude", "desireScript", "disownedSelf"];
  var BUCKETS = ["b0", "b1", "b2", "b3", "b4"];

  // e5-small pole gaps are tiny (~0.01-0.03); each axis carries its own midpoint and half-gap.
  var DEFAULT_CALIBRATION = { center: 0, spread: 0.02 };
  // Identical text is 1, a paraphrase ~0.87, the same line across EN/TR ~0.89, unrelated ~0.77.
  var DISTANCE_CLOSE = 0.9;
  var DISTANCE_FAR = 0.78;

  var PHRASES = {
    en: {
      agencyHigh: "in charge",
      agencyLow: "not in charge",
      codeHigh: "clear on the rules",
      codeLow: "loose on the rules",
      join: " and ",
      redemptionHigh: "The story turns out fine.",
      redemptionLow: "The story doesn't turn out fine.",
      communionHigh: "Part of an us.",
      communionLow: "On my own.",
      neutral: "The open reading sits in the middle."
    },
    tr: {
      agencyHigh: "iş bende",
      agencyLow: "iş bende değil",
      codeHigh: "kuralı net",
      codeLow: "kuralı gevşek",
      join: " ve ",
      redemptionHigh: "Hikaye düze çıkıyor.",
      redemptionLow: "Hikaye düze çıkmıyor.",
      communionHigh: "Bir aradayım.",
      communionLow: "Kendi başımayım.",
      neutral: "Açık okuma ortada duruyor."
    }
  };

  function clamp01(value) {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  function polarityScore(cosLow, cosHigh, calibration) {
    var cal = calibration || DEFAULT_CALIBRATION;
    var delta = cosHigh - cosLow;
    return Math.round(clamp01(0.5 + (0.25 * (delta - cal.center)) / cal.spread) * 100);
  }

  function distanceScore(cos) {
    return Math.round(clamp01((DISTANCE_CLOSE - cos) / (DISTANCE_CLOSE - DISTANCE_FAR)) * 100);
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

  // Same bucket plus every bucket one quintile away on a single known axis.
  function neighborBuckets(code) {
    var out = [code];
    for (var index = 0; index < code.length; index += 1) {
      var char = code.charAt(index);
      if (char === "u") continue;
      var value = Number(char);
      [value - 1, value + 1].forEach(function (next) {
        if (next < 0 || next > 4) return;
        out.push(code.slice(0, index) + next + code.slice(index + 1));
      });
    }
    return out;
  }

  function scoreDistance(left, right) {
    var shared = 0;
    var sum = 0;
    OPEN_KEYS.forEach(function (key) {
      if (left[key] >= 0 && right[key] >= 0) {
        shared += 1;
        sum += Math.abs(left[key] - right[key]);
      }
    });
    if (!shared) return Infinity;
    return sum / shared + (OPEN_KEYS.length - shared) * 25;
  }

  function knownOpen(scores) {
    return OPEN_KEYS.filter(function (key) {
      return typeof scores[key] === "number" && scores[key] >= 0;
    });
  }

  function capitalize(sentence, lang) {
    if (!sentence) return "";
    var locale = lang === "tr" ? "tr-TR" : "en-US";
    return sentence.charAt(0).toLocaleUpperCase(locale) + sentence.slice(1);
  }

  function summary(number, scores, lang) {
    var words = PHRASES[lang] || PHRASES.en;
    var parts = [];
    if (scores.agency >= 60) parts.push(words.agencyHigh);
    else if (scores.agency >= 0 && scores.agency <= 40) parts.push(words.agencyLow);
    if (scores.codeClarity >= 60) parts.push(words.codeHigh);
    else if (scores.codeClarity >= 0 && scores.codeClarity <= 40) parts.push(words.codeLow);

    var sentences = [];
    if (parts.length) sentences.push(capitalize(parts.join(words.join), lang) + ".");
    if (scores.redemption >= 60) sentences.push(words.redemptionHigh);
    else if (scores.redemption >= 0 && scores.redemption <= 40) sentences.push(words.redemptionLow);
    if (scores.communion >= 60) sentences.push(words.communionHigh);
    else if (scores.communion >= 0 && scores.communion <= 40) sentences.push(words.communionLow);

    if (!sentences.length) return String(number) + ". " + words.neutral;
    return String(number) + ". " + sentences.join(" ");
  }

  // Every stats counter a published mindset occupies. Each path counts 1.
  function placements(state) {
    var out = {};
    if (!state || !state.published) return out;
    var scores = state.scores || {};
    var demo = demographics.normalize(state.demo);
    var slices = ["axes"];
    var ageKey = demographics.ageKey(demo.ageBand);
    if (ageKey) slices.push("byAge." + ageKey);
    if (demo.gender) slices.push("byGender." + demo.gender);
    if (demo.country) slices.push("byCountry." + demo.country);

    out.count = true;
    slices.forEach(function (slice) {
      if (slice !== "axes") out[slice + ".n"] = true;
      OPEN_KEYS.forEach(function (key) {
        var quintile = quintileKey(scores[key]);
        if (quintile) out[slice + "." + key + "." + quintile] = true;
      });
    });
    var city = demographics.cityKey(demo.country, demo.city);
    if (city) out["cities." + city] = true;
    return out;
  }

  function histogramDelta(previous, next) {
    var before = placements(previous);
    var after = placements(next);
    var deltas = [];
    Object.keys(before).forEach(function (path) {
      if (!after[path]) deltas.push({ path: path, by: -1 });
    });
    Object.keys(after).forEach(function (path) {
      if (!before[path]) deltas.push({ path: path, by: 1 });
    });
    return deltas;
  }

  function blankScores() {
    var scores = {};
    OPEN_KEYS.concat(CLOSED_KEYS).forEach(function (key) {
      scores[key] = -1;
    });
    return scores;
  }

  function codedError(code, message, field) {
    var error = new Error(message);
    error.code = code;
    if (field) error.field = field;
    return error;
  }

  function normalizeTexts(raw) {
    var texts = {};
    lens.fields.forEach(function (field) {
      var value = String((raw && raw[field.key]) || "").trim();
      if (value.length > lens.maxChars) {
        throw codedError("text_too_long", field.label.en + " cannot exceed 1200 characters.", field.key);
      }
      texts[field.key] = value;
    });
    if (!texts.personalCode) {
      throw codedError("code_required", "Write one line you hold true to publish.");
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

  function buildDocuments(uid, number, texts, scores, published, createdAt, now, demo) {
    var numberKey = String(number);
    var when = now || new Date().toISOString();
    var profile = demographics.normalize(demo);
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
        ageBand: profile.ageBand,
        gender: profile.gender,
        country: profile.country,
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
        city: profile.city,
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

  function demoOf(publicDoc, privateDoc) {
    return demographics.normalize({
      ageBand: publicDoc && publicDoc.ageBand,
      gender: publicDoc && publicDoc.gender,
      country: publicDoc && publicDoc.country,
      city: privateDoc && privateDoc.city
    });
  }

  var api = {
    OPEN_KEYS: OPEN_KEYS,
    CLOSED_KEYS: CLOSED_KEYS,
    CLOSED_TEXT_KEYS: CLOSED_TEXT_KEYS,
    BUCKETS: BUCKETS,
    polarityScore: polarityScore,
    distanceScore: distanceScore,
    quintileKey: quintileKey,
    bucket: bucket,
    neighborBuckets: neighborBuckets,
    scoreDistance: scoreDistance,
    knownOpen: knownOpen,
    summary: summary,
    placements: placements,
    histogramDelta: histogramDelta,
    blankScores: blankScores,
    normalizeTexts: normalizeTexts,
    joinFields: joinFields,
    buildDocuments: buildDocuments,
    scoresOf: scoresOf,
    demoOf: demoOf
  };

  root.MindsetReading = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

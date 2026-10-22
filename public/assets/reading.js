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

  // Lite embedder pole gaps are wider than e5; each axis carries its own midpoint and half-gap.
  var DEFAULT_CALIBRATION = { center: 0, spread: 0.02 };
  // Lite embedder: identical is 1, same-language paraphrase ~0.55, unrelated ~0.
  var DISTANCE_CLOSE = 0.65;
  var DISTANCE_FAR = 0;

  var PHRASES = {
    en: {
      agencyHigh: "riding the current",
      agencyMid: "drifting with the current",
      agencyLow: "swept by the current",
      codeHigh: "scales hard against the current",
      codeMid: "scales in between",
      codeLow: "soft scales",
      join: " and ",
      redemptionHigh: "The story surfaces.",
      redemptionMid: "The story holds still.",
      redemptionLow: "The story sinks.",
      communionHigh: "In a school.",
      communionMid: "Near the school.",
      communionLow: "Alone in the lake.",
      neutral: "The surface reading sits in the middle."
    },
    tr: {
      agencyHigh: "akıntı bende",
      agencyMid: "akıntıyla birlikteyim",
      agencyLow: "akıntı beni sürüklüyor",
      codeHigh: "akıntıya karşı pulları sert",
      codeMid: "pulları ortada",
      codeLow: "pulları yumuşak",
      join: " ve ",
      redemptionHigh: "Hikaye yüzeye çıkıyor.",
      redemptionMid: "Hikaye yerinde duruyor.",
      redemptionLow: "Hikaye dibe çöküyor.",
      communionHigh: "Sürüdeyim.",
      communionMid: "Sürüye yakınım.",
      communionLow: "Gölde yalnızım.",
      neutral: "Yüzey okuması ortada."
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

  function phraseFor(score, high, mid, low) {
    if (typeof score !== "number" || score < 0) return "";
    if (score >= 60) return high;
    if (score <= 40) return low;
    return mid;
  }

  function summary(number, scores, lang) {
    var words = PHRASES[lang] || PHRASES.en;
    var parts = [];
    var agency = phraseFor(scores.agency, words.agencyHigh, words.agencyMid, words.agencyLow);
    var code = phraseFor(scores.codeClarity, words.codeHigh, words.codeMid, words.codeLow);
    if (agency) parts.push(agency);
    if (code) parts.push(code);

    var sentences = [];
    if (parts.length) sentences.push(capitalize(parts.join(words.join), lang) + ".");
    var redemption = phraseFor(
      scores.redemption,
      words.redemptionHigh,
      words.redemptionMid,
      words.redemptionLow
    );
    var communion = phraseFor(
      scores.communion,
      words.communionHigh,
      words.communionMid,
      words.communionLow
    );
    if (redemption) sentences.push(redemption);
    if (communion) sentences.push(communion);

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

  var HISTORY_LEVELS = ["none", "school", "public"];


  // Accepts "42", "#42", "/i/42", "/fish/42" and full profile URLs. Rejects aliases and junk.
  function parseNumber(text) {
    var raw = String(text || "").trim();
    if (!raw) return null;
    try {
      if (/^https?:\/\//i.test(raw) || raw.indexOf("/") >= 0) {
        var url = new URL(raw, "https://mindsetbucket.com");
        raw = url.pathname || raw;
      }
    } catch (error) {
      return null;
    }
    var match = raw.match(/(?:^|\/)(?:(?:i|fish)\/)?#?(\d{1,7})\/?$/i);
    if (!match) return null;
    var n = Number(match[1]);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
  }

  function historyLevel(value) {
    if (value === "tribe") return "school";
    return HISTORY_LEVELS.indexOf(value) >= 0 ? value : "none";
  }

  function versionId(when) {
    return String(when).replace(/\D/g, "").slice(0, 17);
  }

  function firstSentence(text, max) {
    var clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    var match = clean.match(/^(.+?[.!?…])(?:\s|$)/);
    var line = match ? match[1] : clean;
    if (line.length > max) line = line.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
    return line;
  }

  // Short title from open text; not user-editable. No trailing period on cards.
  function deriveHeadline(texts) {
    return firstSentence(texts.personalCode || texts.currentPosition || "", 70).replace(/\.$/, "");
  }

  // Card blurb: open-axis score phrases only (headline carries the user line).
  function deriveBlurb(number, texts, scores, lang) {
    return summary(number, scores, lang).replace(/^\d+\.\s*/, "");
  }

  function deriveQuote(texts) {
    return firstSentence(texts.personalCode || texts.currentPosition || "", 120);
  }

  // Only the open side is ever copied into history.
  function buildVersion(publicDoc) {
    return {
      ownerUid: publicDoc.ownerUid,
      number: publicDoc.number,
      createdAt: publicDoc.updatedAt,
      lens: publicDoc.lens,
      agency: publicDoc.agency,
      communion: publicDoc.communion,
      codeClarity: publicDoc.codeClarity,
      redemption: publicDoc.redemption,
      known: publicDoc.known,
      ageBand: publicDoc.ageBand || "",
      gender: publicDoc.gender || "",
      country: publicDoc.country || "",
      currentPosition: publicDoc.currentPosition,
      personalCode: publicDoc.personalCode,
      selfNarrative: publicDoc.selfNarrative,
      headline: publicDoc.headline || "",
      blurb: publicDoc.blurb || ""
    };
  }

  function buildDocuments(uid, number, texts, scores, published, createdAt, now, demo, history, seed, lang) {
    var numberKey = String(number);
    var when = now || new Date().toISOString();
    var profile = demographics.normalize(demo);
    var publicDoc = {
        ownerUid: uid,
        number: number,
        numberKey: numberKey,
        published: published,
        createdAt: createdAt || when,
        updatedAt: when,
        history: historyLevel(history),
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
        selfNarrative: texts.selfNarrative,
        headline: deriveHeadline(texts),
        blurb: deriveBlurb(number, texts, scores, lang || "en")
      };
    if (seed) publicDoc.seed = true;
    return {
      publicDoc: publicDoc,
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
    buildVersion: buildVersion,
    deriveHeadline: deriveHeadline,
    deriveBlurb: deriveBlurb,
    deriveQuote: deriveQuote,
    versionId: versionId,
    historyLevel: historyLevel,
    parseNumber: parseNumber,
    HISTORY_LEVELS: HISTORY_LEVELS,
    scoresOf: scoresOf,
    demoOf: demoOf
  };

  root.MindsetReading = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

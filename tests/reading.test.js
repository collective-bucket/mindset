"use strict";

var assert = require("assert");
var lens = require("../public/assets/lens-v2.js");
var demographics = require("../public/assets/demographics.js");
var reading = require("../public/assets/reading.js");

// Polarity: centered and scaled per axis.
var flat = { center: 0, spread: 0.02 };
assert.strictEqual(reading.polarityScore(0.8, 0.8, flat), 50);
assert.strictEqual(reading.polarityScore(0.8, 0.82, flat), 75);
assert.strictEqual(reading.polarityScore(0.82, 0.8, flat), 25);
assert.strictEqual(reading.polarityScore(-1, 1, flat), 100);
assert.strictEqual(reading.polarityScore(1, -1, flat), 0);
var shifted = { center: 0.01, spread: 0.02 };
assert.strictEqual(reading.polarityScore(0.8, 0.81, shifted), 50);

// Every polarity axis carries measured calibration and EN+TR anchors.
lens.axes
  .filter(function (axis) {
    return axis.kind === "polarity";
  })
  .forEach(function (axis) {
    assert.ok(axis.calibration.spread > 0, axis.key + " spread");
    ["lowAnchors", "highAnchors"].forEach(function (side) {
      assert.ok(axis[side].en.length >= 3, axis.key + " " + side + " en");
      assert.strictEqual(axis[side].en.length, axis[side].tr.length, axis.key + " " + side + " pairs");
    });
  });
lens.fields.concat(lens.axes).forEach(function (item) {
  assert.ok(item.label.en && item.label.tr, item.key + " label");
});

// Distance: identical 0, paraphrase low, unrelated 100.
assert.strictEqual(reading.distanceScore(1), 0);
assert.strictEqual(reading.distanceScore(0.9), 0);
assert.strictEqual(reading.distanceScore(0.78), 100);
assert.strictEqual(reading.distanceScore(-1), 100);
assert.ok(reading.distanceScore(0.87) <= 30, "paraphrase stays close");
assert.ok(reading.distanceScore(0.837) >= 45, "code vs power reads apart");

assert.strictEqual(reading.quintileKey(-1), null);
assert.strictEqual(reading.quintileKey(0), "b0");
assert.strictEqual(reading.quintileKey(19), "b0");
assert.strictEqual(reading.quintileKey(20), "b1");
assert.strictEqual(reading.quintileKey(40), "b2");
assert.strictEqual(reading.quintileKey(60), "b3");
assert.strictEqual(reading.quintileKey(80), "b4");
assert.strictEqual(reading.quintileKey(100), "b4");

assert.strictEqual(
  reading.bucket({ agency: 80, communion: -1, codeClarity: 20, redemption: 40 }),
  "4u12"
);
assert.deepStrictEqual(reading.neighborBuckets("4u12"), ["4u12", "3u12", "4u02", "4u22", "4u11", "4u13"]);

var near = { agency: 70, communion: 60, codeClarity: 50, redemption: -1 };
var same = { agency: 70, communion: 60, codeClarity: 50, redemption: -1 };
var far = { agency: 10, communion: 0, codeClarity: 90, redemption: -1 };
assert.ok(reading.scoreDistance(near, same) < reading.scoreDistance(near, far));
assert.strictEqual(reading.scoreDistance({ agency: -1 }, { agency: 50 }), Infinity);

var scores212 = { agency: 80, communion: 50, codeClarity: 80, redemption: 20 };
assert.strictEqual(
  reading.summary(212, scores212, "en"),
  "212. In charge and clear on the rules. The story doesn't turn out fine."
);
assert.strictEqual(
  reading.summary(212, scores212, "tr"),
  "212. İş bende ve kuralı net. Hikaye düze çıkmıyor."
);
assert.strictEqual(
  reading.summary(3, { agency: 50, communion: 50, codeClarity: 50, redemption: 50 }, "en"),
  "3. The open reading sits in the middle."
);
assert.strictEqual(
  reading.summary(3, { agency: 50, communion: 50, codeClarity: 50, redemption: 50 }),
  "3. The open reading sits in the middle."
);

// Demographics normalize to known values only.
assert.deepStrictEqual(
  demographics.normalize({ ageBand: "25-34", gender: "woman", country: "tr", city: "  İzmir " }),
  { ageBand: "25-34", gender: "woman", country: "TR", city: "İzmir" }
);
assert.deepStrictEqual(
  demographics.normalize({ ageBand: "12-17", gender: "x", country: "ZZ", city: "Paris" }),
  { ageBand: "", gender: "", country: "", city: "" }
);
assert.strictEqual(demographics.cityKey("TR", "İstanbul"), "TR_istanbul");
assert.strictEqual(demographics.cityKey("TR", "Kırıkkale"), "TR_kirikkale");
assert.strictEqual(demographics.cityKey("DE", "München"), "DE_munchen");
assert.strictEqual(demographics.cityKey("", "Paris"), "");
assert.strictEqual(demographics.ageKey("65+"), "a65p");

// Stats deltas.
var first = reading.histogramDelta(null, {
  published: true,
  scores: { agency: 80, communion: -1, codeClarity: 20, redemption: 40 }
});
assert.deepStrictEqual(first, [
  { path: "count", by: 1 },
  { path: "axes.agency.b4", by: 1 },
  { path: "axes.codeClarity.b1", by: 1 },
  { path: "axes.redemption.b2", by: 1 }
]);

var withDemo = reading.histogramDelta(null, {
  published: true,
  scores: { agency: 80, communion: -1, codeClarity: -1, redemption: -1 },
  demo: { ageBand: "25-34", gender: "man", country: "TR", city: "Ankara" }
});
assert.deepStrictEqual(
  withDemo.map(function (delta) {
    return delta.path;
  }),
  [
    "count",
    "axes.agency.b4",
    "byAge.a25_34.n",
    "byAge.a25_34.agency.b4",
    "byGender.man.n",
    "byGender.man.agency.b4",
    "byCountry.TR.n",
    "byCountry.TR.agency.b4",
    "cities.TR_ankara"
  ]
);

var moved = reading.histogramDelta(
  { published: true, scores: { agency: 80, communion: 10, codeClarity: 20, redemption: 40 } },
  { published: true, scores: { agency: 10, communion: 10, codeClarity: 20, redemption: 40 } }
);
assert.deepStrictEqual(moved, [
  { path: "axes.agency.b4", by: -1 },
  { path: "axes.agency.b0", by: 1 }
]);

var relocated = reading.histogramDelta(
  { published: true, scores: { agency: 80 }, demo: { country: "TR", city: "Ankara" } },
  { published: true, scores: { agency: 80 }, demo: { country: "DE", city: "Berlin" } }
);
assert.deepStrictEqual(relocated, [
  { path: "byCountry.TR.n", by: -1 },
  { path: "byCountry.TR.agency.b4", by: -1 },
  { path: "cities.TR_ankara", by: -1 },
  { path: "byCountry.DE.n", by: 1 },
  { path: "byCountry.DE.agency.b4", by: 1 },
  { path: "cities.DE_berlin", by: 1 }
]);

var hidden = reading.histogramDelta(
  { published: true, scores: { agency: 80, communion: -1, codeClarity: -1, redemption: -1 } },
  { published: false, scores: { agency: 80, communion: -1, codeClarity: -1, redemption: -1 } }
);
assert.deepStrictEqual(hidden, [
  { path: "count", by: -1 },
  { path: "axes.agency.b4", by: -1 }
]);
assert.deepStrictEqual(reading.histogramDelta({ published: true, scores: {} }, null), [
  { path: "count", by: -1 }
]);

// Texts.
var texts = reading.normalizeTexts({
  personalCode: "  Keep your word.  ",
  currentPosition: "",
  selfNarrative: "",
  unsayableAttitude: "secret",
  desireScript: "",
  disownedSelf: ""
});
assert.strictEqual(texts.personalCode, "Keep your word.");

assert.throws(
  function () {
    reading.normalizeTexts({ personalCode: "" });
  },
  function (error) {
    return error.code === "code_required";
  }
);
assert.throws(
  function () {
    reading.normalizeTexts({ personalCode: "a".repeat(1201) });
  },
  function (error) {
    return error.code === "text_too_long" && error.field === "personalCode";
  }
);

// Closed texts, closed scores and city never land on the public document.
var docs = reading.buildDocuments(
  "uid-1",
  212,
  texts,
  {
    agency: 70,
    communion: -1,
    codeClarity: 80,
    redemption: -1,
    codeGap: 40,
    authorityLean: 10,
    desireSplit: -1,
    shadowDistance: -1
  },
  true,
  "2026-10-14T12:00:00.000Z",
  "2026-10-14T12:00:00.000Z",
  { ageBand: "35-44", gender: "other", country: "TR", city: "Izmir" }
);

var publicKeys = Object.keys(docs.publicDoc);
reading.CLOSED_TEXT_KEYS.concat(reading.CLOSED_KEYS, ["city"]).forEach(function (key) {
  assert.ok(publicKeys.indexOf(key) < 0, key + " must not be public");
});
assert.strictEqual(docs.publicDoc.lens, "v2");
assert.strictEqual(docs.publicDoc.personalCode, "Keep your word.");
assert.strictEqual(docs.publicDoc.headline, "Keep your word.");
assert.ok(docs.publicDoc.blurb.indexOf("Keep your word.") >= 0);
assert.strictEqual(docs.publicDoc.bucket, "3u4u");
assert.strictEqual(docs.publicDoc.country, "TR");
assert.strictEqual(docs.publicDoc.ageBand, "35-44");
assert.deepStrictEqual(docs.publicDoc.known, ["agency", "codeClarity"]);
assert.strictEqual(docs.privateDoc.unsayableAttitude, "secret");
assert.strictEqual(docs.privateDoc.city, "Izmir");
assert.strictEqual(docs.privateDoc.codeGap, 40);

assert.strictEqual(
  reading.deriveHeadline({ personalCode: "Hold the line. More later.", currentPosition: "" }),
  "Hold the line."
);
assert.ok(
  reading.deriveBlurb(1, { personalCode: "Hold the line." }, { agency: 70, communion: 50, codeClarity: 80, redemption: 50 }, "en")
    .indexOf("Hold the line.") >= 0
);
assert.deepStrictEqual(
  demographics.suggestFromText("Ben 30 yaşında bir kadın, İstanbul'da yaşıyorum."),
  { ageBand: "25-34", gender: "woman", country: "TR", city: "İstanbul" }
);
lens.axes.forEach(function (axis) {
  assert.ok(axis.hint && axis.hint.en && axis.hint.tr, axis.key + " needs EN/TR hint");
});

// History defaults to private and versions copy only the open side.
assert.strictEqual(docs.publicDoc.history, "none");
assert.strictEqual(reading.historyLevel("school"), "school");
assert.strictEqual(reading.historyLevel("tribe"), "school", "legacy tribe level maps to school");
assert.strictEqual(reading.historyLevel("everyone"), "none");
assert.strictEqual(reading.versionId("2026-10-14T12:00:00.123Z"), "20261014120000123");
var version = reading.buildVersion(docs.publicDoc);
assert.strictEqual(version.createdAt, docs.publicDoc.updatedAt);
assert.strictEqual(version.personalCode, "Keep your word.");
assert.strictEqual(version.headline, docs.publicDoc.headline);
assert.strictEqual(version.blurb, docs.publicDoc.blurb);
assert.strictEqual(version.agency, 70);
reading.CLOSED_TEXT_KEYS.concat(reading.CLOSED_KEYS, ["city", "alias", "history", "published"]).forEach(function (key) {
  assert.ok(!(key in version), key + " must not be in a version");
});

var demo = reading.demoOf({ ageBand: "18-24", country: "US" }, { city: "Austin" });
assert.deepStrictEqual(demo, { ageBand: "18-24", gender: "", country: "US", city: "Austin" });

console.log("reading.test.js passed");

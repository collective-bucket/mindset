"use strict";

var assert = require("assert");
var reading = require("../public/assets/reading.js");

assert.strictEqual(reading.polarityScore(-1, 1), 100);
assert.strictEqual(reading.polarityScore(1, -1), 0);
assert.strictEqual(reading.polarityScore(0.4, 0.4), 50);

assert.strictEqual(reading.distanceScore(1), 0);
assert.strictEqual(reading.distanceScore(0.93), 0);
assert.strictEqual(reading.distanceScore(0.82), 100);
assert.strictEqual(reading.distanceScore(-1), 100);
assert.ok(reading.polarityScore(0.869, 0.893) >= 60);
assert.ok(reading.distanceScore(0.865) >= 55);

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

assert.strictEqual(
  reading.summary(212, {
    agency: 80,
    communion: 50,
    codeClarity: 80,
    redemption: 20
  }),
  "212. İş bende ve kuralı net. Hikaye düze çıkmıyor."
);

assert.strictEqual(
  reading.summary(3, {
    agency: 50,
    communion: 50,
    codeClarity: 50,
    redemption: 50
  }),
  "3. Açık okuma ortada duruyor."
);

var first = reading.histogramDelta(null, {
  published: true,
  scores: { agency: 80, communion: -1, codeClarity: 20, redemption: 40 }
});
assert.deepStrictEqual(first, [
  { path: "axes.agency.b4", by: 1 },
  { path: "axes.codeClarity.b1", by: 1 },
  { path: "axes.redemption.b2", by: 1 }
]);

var moved = reading.histogramDelta(
  {
    published: true,
    scores: { agency: 80, communion: 10, codeClarity: 20, redemption: 40 }
  },
  {
    published: true,
    scores: { agency: 10, communion: 10, codeClarity: 20, redemption: 40 }
  }
);
assert.deepStrictEqual(moved, [
  { path: "axes.agency.b4", by: -1 },
  { path: "axes.agency.b0", by: 1 }
]);

var hidden = reading.histogramDelta(
  {
    published: true,
    scores: { agency: 80, communion: -1, codeClarity: -1, redemption: -1 }
  },
  {
    published: false,
    scores: { agency: 80, communion: -1, codeClarity: -1, redemption: -1 }
  }
);
assert.deepStrictEqual(hidden, [{ path: "axes.agency.b4", by: -1 }]);

var texts = reading.normalizeTexts({
  personalCode: "  Sözüm net.  ",
  currentPosition: "",
  selfNarrative: "",
  unsayableAttitude: "gizli",
  desireScript: "",
  disownedSelf: ""
});
assert.strictEqual(texts.personalCode, "Sözüm net.");

assert.throws(function () {
  reading.normalizeTexts({ personalCode: "" });
}, /doğru bildiğin/);

assert.throws(function () {
  reading.normalizeTexts({ personalCode: "a".repeat(1201) });
}, /1200/);

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
  "2026-10-14T12:00:00.000Z"
);

var publicKeys = Object.keys(docs.publicDoc);
reading.CLOSED_TEXT_KEYS.concat(reading.CLOSED_KEYS).forEach(function (key) {
  assert.ok(!publicKeys.includes(key), key + " kamu belgesine yazılamaz");
});
assert.strictEqual(docs.publicDoc.personalCode, "Sözüm net.");
assert.strictEqual(docs.publicDoc.bucket, "3u4u");
assert.deepStrictEqual(docs.publicDoc.known, ["agency", "codeClarity"]);
assert.strictEqual(docs.privateDoc.unsayableAttitude, "gizli");
assert.strictEqual(docs.privateDoc.codeGap, 40);

console.log("reading.test.js geçti");

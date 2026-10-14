"use strict";

// Static checks: the rules allowlists must match what the client writes,
// and closed fields must never be allowed on the public document.
var assert = require("assert");
var fs = require("fs");
var path = require("path");
var reading = require("../public/assets/reading.js");

var rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");

function allowlist(functionName) {
  var start = rules.indexOf("function " + functionName + "(");
  assert.ok(start >= 0, functionName + " missing");
  var block = rules.slice(start, rules.indexOf("])", start));
  return (block.match(/'(\w+)'/g) || []).map(function (item) {
    return item.slice(1, -1);
  });
}

var publicAllowed = allowlist("validPublic");
var privateAllowed = allowlist("validPrivate");

var docs = reading.buildDocuments(
  "uid",
  1,
  { currentPosition: "", personalCode: "x", selfNarrative: "", unsayableAttitude: "", desireScript: "", disownedSelf: "" },
  reading.blankScores(),
  true,
  "2026-10-14T12:00:00.000Z",
  "2026-10-14T12:00:00.000Z",
  {}
);

Object.keys(docs.publicDoc).forEach(function (key) {
  assert.ok(publicAllowed.indexOf(key) >= 0, "public key not allowed by rules: " + key);
});
Object.keys(docs.privateDoc).forEach(function (key) {
  assert.ok(privateAllowed.indexOf(key) >= 0, "private key not allowed by rules: " + key);
});
reading.CLOSED_TEXT_KEYS.concat(reading.CLOSED_KEYS, ["city"]).forEach(function (key) {
  assert.ok(publicAllowed.indexOf(key) < 0, "rules allow closed key on public doc: " + key);
});

// The shared ads and trips rules stay first and untouched.
assert.ok(rules.indexOf("match /ads/{adId}") > 0, "ads rules missing");
assert.ok(rules.indexOf("match /trips/{tripId}") > 0, "trips rules missing");
assert.ok(rules.indexOf("paidPayments") > 0, "trips paidPayments rule missing");

console.log("rules.test.js passed");

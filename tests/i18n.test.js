"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var i18n = require("../public/assets/i18n.js");

var en = Object.keys(i18n.dict.en).sort();
var tr = Object.keys(i18n.dict.tr).sort();
assert.deepStrictEqual(tr, en, "en and tr must have the same keys");

Object.keys(i18n.dict.en).forEach(function (key) {
  var enVars = (i18n.dict.en[key].match(/\{\w+\}/g) || []).sort();
  var trVars = (i18n.dict.tr[key].match(/\{\w+\}/g) || []).sort();
  assert.deepStrictEqual(trVars, enVars, key + " placeholders differ");
});

// Every key referenced by markup or scripts exists.
var root = path.join(__dirname, "..", "public");
var used = {};
function scan(dir) {
  fs.readdirSync(dir).forEach(function (name) {
    var file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) return scan(file);
    if (!/\.(html|js)$/.test(name) || name === "i18n.js") return;
    var text = fs.readFileSync(file, "utf8");
    var patterns = [
      /data-i18n(?:-placeholder|-aria)?="([\w.]+)"/g,
      /data-title="([\w.]+)"/g,
      /\bt\("([\w.]+)"/g,
      /label: "([\w.]+)"/g,
      /"((?:auth\.err|create|common|profile|me|feed|tribe|explore|error)\.[\w.]+)"/g
    ];
    patterns.forEach(function (pattern) {
      var match;
      while ((match = pattern.exec(text))) used[match[1]] = file;
    });
  });
}
scan(root);
Object.keys(used).forEach(function (key) {
  if (!/^[a-z]+\.[\w.]+$/.test(key)) return;
  assert.ok(key in i18n.dict.en, "missing i18n key " + key + " (" + path.relative(root, used[key]) + ")");
});

assert.strictEqual(i18n.t("common.mindset", { n: 212 }), "212. mindset");
assert.strictEqual(i18n.pick({ en: "A", tr: "B" }), "A");

console.log("i18n.test.js passed");

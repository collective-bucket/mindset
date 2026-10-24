#!/usr/bin/env node
"use strict";

var childProcess = require("child_process");
var fs = require("fs");
var os = require("os");
var path = require("path");

var assets = path.join(__dirname, "..", "public", "assets");
var modules = ["auth.js"];

fs.readdirSync(assets)
  .filter(function (file) {
    return file.endsWith(".js");
  })
  .forEach(function (file) {
    var target = path.join(assets, file);
    if (modules.indexOf(file) >= 0) {
      var copy = path.join(os.tmpdir(), "mindset-check-" + file.replace(/\.js$/, ".mjs"));
      fs.copyFileSync(target, copy);
      target = copy;
    }
    childProcess.execFileSync(process.execPath, ["--check", target], { stdio: "inherit" });
  });

["reading.test.js", "privacy.test.js", "i18n.test.js", "rules.test.js", "sim.test.js", "call.test.js"].forEach(function (file) {
  childProcess.execFileSync(process.execPath, [path.join(__dirname, "..", "tests", file)], {
    stdio: "inherit"
  });
});

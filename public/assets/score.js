(function () {
  "use strict";

  // Runs only in the browser. Text never leaves the device.
  // Uses the lite on-device embedder (public/assets/embed.js). A neural
  // ONNX model was killing mobile Chrome tabs (~1GB renderer peak).
  var poleCache = {};
  var textCache = {};

  function t(key, vars) {
    return window.MindsetI18n.t(key, vars);
  }

  function embedApi() {
    return window.MindsetEmbed;
  }

  async function embedRaw(text) {
    if (Object.prototype.hasOwnProperty.call(textCache, text)) return textCache[text];
    var vector = embedApi().embed(text);
    textCache[text] = vector;
    return vector;
  }

  async function embedDocument(text) {
    var clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return null;
    return embedRaw(clean);
  }

  async function embedPole(anchors) {
    var list = anchors.en.concat(anchors.tr);
    var key = list.join("\n");
    if (!poleCache[key]) poleCache[key] = embedApi().embedPole(anchors);
    return poleCache[key];
  }

  function yieldUi() {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, 0);
    });
  }

  async function read(texts, onProgress) {
    if (onProgress) onProgress(t("model.reading"));
    await yieldUi();
    var lens = window.MindsetLens;
    var math = window.MindsetReading;
    var api = embedApi();
    var scores = math.blankScores();

    for (var index = 0; index < lens.axes.length; index += 1) {
      var axis = lens.axes[index];
      if (onProgress) onProgress(t("model.reading"));
      if (axis.kind === "polarity") {
        var source = math.joinFields(texts, axis.sources);
        if (!source) continue;
        var vector = await embedDocument(source);
        var low = await embedPole(axis.lowAnchors);
        var high = await embedPole(axis.highAnchors);
        scores[axis.key] = math.polarityScore(api.dot(vector, low), api.dot(vector, high), axis.calibration);
        await yieldUi();
        continue;
      }
      var leftText = math.joinFields(texts, axis.left);
      var rightText = math.joinFields(texts, axis.right);
      if (!leftText || !rightText) continue;
      var left = await embedDocument(leftText);
      var right = await embedDocument(rightText);
      scores[axis.key] = math.distanceScore(api.dot(left, right));
      await yieldUi();
    }

    if (onProgress) onProgress(t("model.ready"));
    return scores;
  }

  window.MindsetScore = { read: read };
})();

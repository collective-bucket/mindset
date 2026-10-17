(function () {
  "use strict";

  // Runs only in the browser. Text never leaves the device.
  var MODEL = "Xenova/multilingual-e5-small";
  var CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";
  var CHUNK = 480;
  var extractor = null;
  var loading = null;
  var poleCache = {};

  function t(key, vars) {
    return window.MindsetI18n.t(key, vars);
  }

  function asVector(output) {
    var list = output && output.tolist ? output.tolist() : output;
    if (list && Array.isArray(list[0])) return list[0];
    return Array.from(list);
  }

  function meanNormalize(vectors) {
    var dim = vectors[0].length;
    var acc = new Array(dim).fill(0);
    var index;
    vectors.forEach(function (vector) {
      for (index = 0; index < dim; index += 1) acc[index] += vector[index];
    });
    var norm = 0;
    for (index = 0; index < dim; index += 1) {
      acc[index] /= vectors.length;
      norm += acc[index] * acc[index];
    }
    norm = Math.sqrt(norm) || 1;
    for (index = 0; index < dim; index += 1) acc[index] /= norm;
    return acc;
  }

  function dot(left, right) {
    var sum = 0;
    for (var index = 0; index < left.length; index += 1) sum += left[index] * right[index];
    return sum;
  }

  function chunks(text) {
    var clean = text.replace(/\s+/g, " ").trim();
    var parts = [];
    for (var index = 0; index < clean.length; index += CHUNK) {
      parts.push(clean.slice(index, index + CHUNK));
    }
    return parts;
  }

  async function embedRaw(text) {
    var output = await extractor("query: " + text, { pooling: "mean", normalize: true });
    return asVector(output);
  }

  async function embedDocument(text) {
    var parts = chunks(text);
    if (!parts.length) return null;
    var vectors = [];
    for (var index = 0; index < parts.length; index += 1) {
      vectors.push(await embedRaw(parts[index]));
    }
    return vectors.length === 1 ? vectors[0] : meanNormalize(vectors);
  }

  async function embedPole(anchors) {
    var list = anchors.en.concat(anchors.tr);
    var key = list.join("\n");
    if (!poleCache[key]) {
      var vectors = [];
      for (var index = 0; index < list.length; index += 1) {
        vectors.push(await embedRaw(list[index]));
      }
      poleCache[key] = meanNormalize(vectors);
    }
    return poleCache[key];
  }

  async function startModel(onProgress) {
    var transformers = await import(CDN);
    if (transformers.env) transformers.env.allowLocalModels = false;
    extractor = await transformers.pipeline("feature-extraction", MODEL, {
      dtype: "q8",
      progress_callback: function (update) {
        if (!onProgress || !update) return;
        if (update.status === "progress" && update.progress != null) {
          onProgress(t("model.downloading", { p: Math.round(update.progress) }));
          return;
        }
        if (update.status === "initiate") onProgress(t("model.preparing"));
      }
    });
    if (onProgress) onProgress(t("model.reading"));
  }

  async function load(onProgress) {
    if (extractor) {
      if (onProgress) onProgress(t("model.reading"));
      return;
    }
    if (!loading) {
      loading = startModel(onProgress).catch(function (error) {
        loading = null;
        throw error;
      });
    } else if (onProgress) {
      onProgress(t("model.reading"));
    }
    await loading;
    if (onProgress) onProgress(t("model.reading"));
  }

  async function read(texts, onProgress) {
    if (onProgress) onProgress(t("model.reading"));
    await load(onProgress);
    if (onProgress) onProgress(t("model.reading"));
    var lens = window.MindsetLens;
    var math = window.MindsetReading;
    var scores = math.blankScores();

    for (var index = 0; index < lens.axes.length; index += 1) {
      var axis = lens.axes[index];
      if (axis.kind === "polarity") {
        var source = math.joinFields(texts, axis.sources);
        if (!source) continue;
        var vector = await embedDocument(source);
        var low = await embedPole(axis.lowAnchors);
        var high = await embedPole(axis.highAnchors);
        scores[axis.key] = math.polarityScore(dot(vector, low), dot(vector, high), axis.calibration);
        continue;
      }
      var leftText = math.joinFields(texts, axis.left);
      var rightText = math.joinFields(texts, axis.right);
      if (!leftText || !rightText) continue;
      var left = await embedDocument(leftText);
      var right = await embedDocument(rightText);
      scores[axis.key] = math.distanceScore(dot(left, right));
    }

    return scores;
  }

  window.MindsetScore = { read: read };
})();

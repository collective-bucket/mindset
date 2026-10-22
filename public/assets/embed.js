(function (root) {
  "use strict";

  // Lightweight multilingual embedding for on-device reading.
  // Character n-grams keep Turkish morphology without a 100MB+ neural net
  // that kills mobile Chrome tabs (~1GB renderer peak for e5-small/onnx).
  var DIM = 384;

  function hash32(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function tokenize(text) {
    var clean = String(text || "")
      .normalize("NFKC")
      .toLocaleLowerCase("tr-TR")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    if (!clean) return [];
    return clean.split(/\s+/);
  }

  function addFeature(vector, key, weight) {
    var h = hash32(key);
    var i = h % DIM;
    var sign = h & 0x1000000 ? 1 : -1;
    vector[i] += sign * weight;
    var j = (h >>> 8) % DIM;
    var sign2 = h & 0x2000000 ? 1 : -1;
    vector[j] += sign2 * weight * 0.5;
  }

  function normalize(vector) {
    var norm = 0;
    var i;
    for (i = 0; i < vector.length; i += 1) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm) || 1;
    var out = new Array(vector.length);
    for (i = 0; i < vector.length; i += 1) out[i] = vector[i] / norm;
    return out;
  }

  function embed(text) {
    var vector = new Array(DIM).fill(0);
    var words = tokenize(text);
    if (!words.length) return normalize(vector);
    words.forEach(function (word) {
      addFeature(vector, "w:" + word, 1);
      var padded = "[" + word + "]";
      var n;
      for (n = 3; n <= 4; n += 1) {
        for (var i = 0; i + n <= padded.length; i += 1) {
          addFeature(vector, "g" + n + ":" + padded.slice(i, i + n), 0.6);
        }
      }
    });
    return normalize(vector);
  }

  function meanNormalize(vectors) {
    if (!vectors.length) return normalize(new Array(DIM).fill(0));
    var acc = new Array(DIM).fill(0);
    vectors.forEach(function (vector) {
      for (var i = 0; i < DIM; i += 1) acc[i] += vector[i];
    });
    for (var j = 0; j < DIM; j += 1) acc[j] /= vectors.length;
    return normalize(acc);
  }

  function dot(left, right) {
    var sum = 0;
    for (var i = 0; i < left.length; i += 1) sum += left[i] * right[i];
    return sum;
  }

  function embedPole(anchors) {
    var list = (anchors.en || []).concat(anchors.tr || []);
    return meanNormalize(list.map(embed));
  }

  function embedDocument(text) {
    var clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return null;
    return embed(clean);
  }

  var api = {
    DIM: DIM,
    embed: embed,
    embedDocument: embedDocument,
    embedPole: embedPole,
    meanNormalize: meanNormalize,
    dot: dot
  };

  root.MindsetEmbed = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

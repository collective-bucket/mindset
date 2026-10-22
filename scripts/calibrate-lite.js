"use strict";

/**
 * Recompute polarity calibration for the lite on-device embedder.
 * Prints center/spread per axis to paste into public/assets/lens-v2.js.
 *
 * Usage: node scripts/calibrate-lite.js
 */

var lens = require("../public/assets/lens-v2.js");
var embed = require("../public/assets/embed.js");

var SAMPLES = {
  agency: {
    high: [
      "I take charge of my life and fix what breaks.",
      "Hayatımın sorumluluğunu ben alırım; yönümü ben belirlerim.",
      "I built my life with my own decisions."
    ],
    mid: [
      "Some weeks I steer, some weeks I follow the room.",
      "Bazı işleri ben yönetirim, bazılarını teslim ederim."
    ],
    low: [
      "Things happen to me without my choice.",
      "Hayatımı koşullar yönetiyor; ne gelirse ona uyuyorum.",
      "Other people decide how my life goes."
    ]
  },
  communion: {
    high: [
      "We are together and I belong to a community.",
      "Bir bizin parçasıyım; insanlarım benim için en önemlisi."
    ],
    mid: [
      "I keep a few close people and also need alone time.",
      "Birkaç yakınım var ama yalnız kalmaya da ihtiyacım olur."
    ],
    low: [
      "I am alone and belong nowhere.",
      "Yalnızım; hiçbir yere ait değilim."
    ]
  },
  codeClarity: {
    high: [
      "My rules are absolute. No exceptions.",
      "Kurallarım kesindir; ilkelerimden asla şaşmam."
    ],
    mid: [
      "I keep a few hard lines and leave the rest flexible.",
      "Birkaç sert çizgim var; gerisini esnek bırakırım."
    ],
    low: [
      "It depends on the situation. My rules are flexible.",
      "Duruma göre değişir; sabit ilkelerim yok."
    ]
  },
  redemption: {
    high: [
      "It was hard, but it got better. In the end things turned out well.",
      "Zordu ama düzeldi; sonunda her şey yoluna girdi."
    ],
    mid: [
      "Some chapters repair, some fall apart.",
      "Bazı bölümler düzelir, bazıları dağılır."
    ],
    low: [
      "It was good, but it got worse. In the end everything fell apart.",
      "İyiydi ama kötüleşti; sonunda her şey dağıldı."
    ]
  },
  authorityLean: {
    high: [
      "People need a strong leader. Obedience to authority is a virtue.",
      "İnsanları hizada tutmak için güçlü bir lider gerekir."
    ],
    mid: [
      "I respect order but still question power when it harms people.",
      "Düzene saygı duyarım ama gücü zarar verince sorgularım."
    ],
    low: [
      "Authority must always be questioned. Freedom matters more than order.",
      "Otorite her zaman sorgulanmalı; özgürlük düzenden önemlidir."
    ]
  }
};

function mean(values) {
  if (!values.length) return 0;
  return values.reduce(function (a, b) { return a + b; }, 0) / values.length;
}

function deltas(texts, lowPole, highPole) {
  return texts.map(function (text) {
    var vector = embed.embedDocument(text);
    return embed.dot(vector, highPole) - embed.dot(vector, lowPole);
  });
}

lens.axes.forEach(function (axis) {
  if (axis.kind !== "polarity") return;
  var sample = SAMPLES[axis.key];
  if (!sample) {
    console.log(axis.key, "no samples — keep previous calibration");
    return;
  }
  var lowPole = embed.embedPole(axis.lowAnchors);
  var highPole = embed.embedPole(axis.highAnchors);
  var mid = deltas(sample.mid, lowPole, highPole);
  var high = deltas(sample.high, lowPole, highPole);
  var low = deltas(sample.low, lowPole, highPole);
  var center = mean(mid);
  var highGap = mean(high) - center;
  var lowGap = center - mean(low);
  var spread = Math.max(0.02, (highGap + lowGap) / 2.4);
  function score(delta) {
    var x = 0.5 + (0.25 * (delta - center)) / spread;
    if (x < 0) x = 0;
    if (x > 1) x = 1;
    return Math.round(x * 100);
  }
  console.log(
    axis.key +
      ": { center: " +
      center.toFixed(4) +
      ", spread: " +
      spread.toFixed(4) +
      " }  // high~" +
      score(mean(high)) +
      " mid~" +
      score(mean(mid)) +
      " low~" +
      score(mean(low))
  );
});

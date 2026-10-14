(function (root) {
  "use strict";

  var lens = {
    version: "v1",
    maxChars: 1200,
    fields: [
      {
        key: "currentPosition",
        code: "current_position",
        label: "Şu an",
        placeholder: "İşin, paran, baktığın kişi, durduğun yer.",
        open: true,
        rows: 4
      },
      {
        key: "personalCode",
        code: "personal_code",
        label: "Doğru bildiğim",
        placeholder: "Kendine koyduğun kurallar, sık tekrar ettiğin cümle.",
        open: true,
        rows: 4
      },
      {
        key: "selfNarrative",
        code: "self_narrative",
        label: "Kendimi nasıl anlatırım",
        placeholder: "Başına gelenleri kendine nasıl bağlarsın.",
        open: true,
        rows: 6
      },
      {
        key: "unsayableAttitude",
        code: "unsayable_attitude",
        label: "Dışarıda söylemediğim",
        placeholder: "Toplum içinde ağzından çıkmayacak eğilim.",
        open: false,
        rows: 5
      },
      {
        key: "desireScript",
        code: "desire_script",
        label: "Arzu",
        placeholder: "Çekim, cinsellik, istemek.",
        open: false,
        rows: 5
      },
      {
        key: "disownedSelf",
        code: "disowned_self",
        label: "Utandığım yan",
        placeholder: "Anlattığın kişide yeri olmayan itiraf.",
        open: false,
        rows: 5
      }
    ],
    axes: [
      {
        key: "agency",
        code: "agency",
        label: "İş bende",
        lowLabel: "Sürükleniyorum",
        highLabel: "Son söz bende",
        open: true,
        kind: "polarity",
        sources: ["currentPosition", "selfNarrative"],
        lowPole: "Hayatımda son söz bende değil. Olaylar beni sürüklüyor. Kontrol bende değil. Yönümü ben seçmiyorum.",
        highPole: "Hayatımda son söz bende. Kararları ben veririm. Yönümü ben seçerim. Kontrol bende."
      },
      {
        key: "communion",
        code: "communion",
        label: "Bir aradayım",
        lowLabel: "Kendi başımayım",
        highLabel: "Kendimi bir biz içinde görüyorum",
        open: true,
        kind: "polarity",
        sources: ["selfNarrative", "personalCode"],
        lowPole: "Kendi başımayım. Kendimi bir biz içinde görmüyorum. Anlatım tekil. Aidiyet kurmuyorum.",
        highPole: "Kendimi bir biz içinde görüyorum. Anlatım birlikte. Aidiyet kuruyorum. Kendi başıma değilim."
      },
      {
        key: "codeClarity",
        code: "code_clarity",
        label: "Kuralım net",
        lowLabel: "Duruma göre değişir",
        highLabel: "Benim için doğru olan net",
        open: true,
        kind: "polarity",
        sources: ["personalCode"],
        lowPole: "Doğru bildiğim duruma göre değişir. Kuralım gevşek. Kesin bir ilkem yok.",
        highPole: "Benim için doğru olan net. Kuralım kesin. İlkem duruma göre eğilmez."
      },
      {
        key: "redemption",
        code: "redemption",
        label: "Düze çıkıyor",
        lowLabel: "Hikaye bozularak bitiyor",
        highLabel: "Hikaye düzelerek bitiyor",
        open: true,
        kind: "polarity",
        sources: ["selfNarrative"],
        lowPole: "Hikayem bozularak bitiyor. Düzelmiyor. Kırık kalıyor. Onarım yok.",
        highPole: "Hikayem düzelerek bitiyor. Bozulan yer toparlanıyor. Anlatı onarımla kapanıyor."
      },
      {
        key: "codeGap",
        code: "code_gap",
        label: "Söylediğimle içim",
        lowLabel: "İkisi birbirine yakın",
        highLabel: "İkisi birbirine yabancı",
        open: false,
        kind: "distance",
        left: ["personalCode"],
        right: ["unsayableAttitude"]
      },
      {
        key: "authorityLean",
        code: "authority_lean",
        label: "Güce yaslanma",
        lowLabel: "Güce karşı durulur",
        highLabel: "Güçlü olan çözer, zayıf olan uyar",
        open: false,
        kind: "polarity",
        sources: ["unsayableAttitude"],
        lowPole: "Güce karşı durulur. Güçlü olan sırf güçlü diye çözmez. Zayıf olan sırf zayıf diye uymaz.",
        highPole: "Güçlü olan çözer. Zayıf olan uyar. Güce yaslanılır. Karşı durmak boşunadır."
      },
      {
        key: "desireSplit",
        code: "desire_split",
        label: "Arzu ayrı duruyor",
        lowLabel: "Arzu anlatılan hayata karışık",
        highLabel: "Arzu anlatılan hayattan ayrı",
        open: false,
        kind: "distance",
        left: ["desireScript"],
        right: ["selfNarrative"]
      },
      {
        key: "shadowDistance",
        code: "shadow_distance",
        label: "İtiraf uzak",
        lowLabel: "İtiraf anlattığım kişiye yakın",
        highLabel: "İtiraf anlattığım kişiye yabancı",
        open: false,
        kind: "distance",
        left: ["disownedSelf"],
        right: ["personalCode", "selfNarrative"]
      }
    ]
  };

  root.MindsetLens = lens;
  if (typeof module !== "undefined" && module.exports) module.exports = lens;
})(typeof globalThis !== "undefined" ? globalThis : this);

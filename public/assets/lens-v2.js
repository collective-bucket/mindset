(function (root) {
  "use strict";

  // Codebook. Academic names live in `code`; the UI only shows `label`.
  // A pole is the mean embedding of all its EN and TR anchors (lite on-device
  // embedder in public/assets/embed.js). `calibration` holds the measured
  // midpoint and half-gap of (cosHigh - cosLow) on held-out EN/TR examples,
  // so clear examples land near 25 and 75. Recompute with scripts/calibrate-lite.js.
  var lens = {
    version: "v2",
    maxChars: 1200,
    fields: [
      {
        key: "currentPosition",
        code: "current_position",
        label: { en: "The waters I swim", tr: "Yüzdüğüm sular" },
        plain: { en: "Right now", tr: "Şu an" },
        placeholder: {
          en: "Your work, your money, who you look after, where you stand.",
          tr: "İşin, paran, baktığın kişi, durduğun yer."
        },
        open: true,
        rows: 4
      },
      {
        key: "personalCode",
        code: "personal_code",
        label: { en: "My scales", tr: "Pullarım" },
        plain: { en: "What I hold true", tr: "Doğru bildiğim" },
        placeholder: {
          en: "Rules you set for yourself, a line you keep repeating.",
          tr: "Kendine koyduğun kurallar, sık tekrar ettiğin cümle."
        },
        open: true,
        rows: 4
      },
      {
        key: "selfNarrative",
        code: "self_narrative",
        label: { en: "The foam I leave", tr: "Bıraktığım köpük" },
        plain: { en: "How I tell my story", tr: "Kendimi nasıl anlatırım" },
        placeholder: {
          en: "How you tie what happened to you to who you are.",
          tr: "Başına gelenleri kendine nasıl bağlarsın."
        },
        open: true,
        rows: 6
      },
      {
        key: "unsayableAttitude",
        code: "unsayable_attitude",
        label: { en: "The mud I swallowed", tr: "Yuttuğum çamur" },
        plain: { en: "What I don't say out loud", tr: "Dışarıda söylemediğim" },
        placeholder: {
          en: "A leaning that would never leave your mouth in public.",
          tr: "Toplum içinde ağzından çıkmayacak eğilim."
        },
        open: false,
        rows: 5
      },
      {
        key: "desireScript",
        code: "desire_script",
        label: { en: "The pull from below", tr: "Dipteki çekim" },
        plain: { en: "Desire", tr: "Arzu" },
        placeholder: {
          en: "Attraction, sex, wanting.",
          tr: "Çekim, cinsellik, istemek."
        },
        open: false,
        rows: 5
      },
      {
        key: "disownedSelf",
        code: "disowned_self",
        label: { en: "The wound in my belly", tr: "Karnımdaki yara" },
        plain: { en: "The side I'm ashamed of", tr: "Utandığım yan" },
        placeholder: {
          en: "A confession with no place in the person you describe.",
          tr: "Anlattığın kişide yeri olmayan itiraf."
        },
        open: false,
        rows: 5
      }
    ],
    axes: [
      {
        key: "agency",
        code: "agency",
        label: { en: "Facing the current", tr: "Akıntı karşısında" },
        lowLabel: { en: "Swept along", tr: "Akıntıya kapılan" },
        highLabel: { en: "Swimming upstream", tr: "Akıntıya karşı yüzen" },
        hint: {
          en: "Do you steer your life, or do events and other people steer you?",
          tr: "Hayatının dümeni sende mi, yoksa olaylar ve başkaları mı sürüklüyor?"
        },
        open: true,
        kind: "polarity",
        sources: ["currentPosition", "selfNarrative"],
        calibration: { center: 0.0095, spread: 0.1868 },
        lowAnchors: {
          en: [
            "Things happen to me without my choice.",
            "Other people decide how my life goes.",
            "I just go along with whatever comes.",
            "I never really chose where I ended up.",
            "Circumstances control my life."
          ],
          tr: [
            "Seçmeden her şey başıma geliyor.",
            "Hayatımın nasıl gideceğine başkaları karar veriyor.",
            "Ne gelirse ona uyuyorum.",
            "Bulunduğum yeri aslında hiç seçmedim.",
            "Hayatımı koşullar yönetiyor."
          ]
        },
        highAnchors: {
          en: [
            "I take charge of my life.",
            "I built my life with my own decisions.",
            "When something goes wrong, I fix it.",
            "Nobody else steers my life.",
            "I set my own direction and act on it."
          ],
          tr: [
            "Hayatımın sorumluluğunu ben alırım.",
            "Hayatımı kendi kararlarımla kurdum.",
            "Bir şey ters gidince ben düzeltirim.",
            "Hayatımı benden başkası yönetmez.",
            "Yönümü ben belirler, harekete geçerim."
          ]
        }
      },
      {
        key: "communion",
        code: "communion",
        label: { en: "School or deep", tr: "Sürüde mi dipte mi" },
        lowLabel: { en: "Loner of the deep", tr: "Dip balığı" },
        highLabel: { en: "Schooling fish", tr: "Sürü balığı" },
        hint: {
          en: "Do you tell your story as alone, or as part of a we?",
          tr: "Hikâyeni yalnız mı anlatıyorsun, yoksa bir bizin parçası olarak mı?"
        },
        open: true,
        kind: "polarity",
        sources: ["selfNarrative", "personalCode"],
        calibration: { center: -0.0688, spread: 0.3095 },
        lowAnchors: {
          en: [
            "I am alone.",
            "I belong nowhere.",
            "I rely only on myself.",
            "I am on my own."
          ],
          tr: [
            "Yalnızım.",
            "Hiçbir yere ait değilim.",
            "Yalnızca kendime güvenirim.",
            "Tek başımayım."
          ]
        },
        highAnchors: {
          en: [
            "We are together.",
            "I belong to a community.",
            "My people matter most to me.",
            "I am part of an us."
          ],
          tr: [
            "Biz birlikteyiz.",
            "Bir topluluğa aidim.",
            "Benim için en önemlisi insanlarım.",
            "Bir bizin parçasıyım."
          ]
        }
      },
      {
        key: "codeClarity",
        code: "code_clarity",
        label: { en: "Scale hardness", tr: "Pul sertliği" },
        lowLabel: { en: "Slippery, supple", tr: "Kıvrak, kaygan" },
        highLabel: { en: "Hard scaled", tr: "Sert pullu" },
        hint: {
          en: "Are your rules firm, or do they bend with the room?",
          tr: "Kuralların sert mi, yoksa ortama göre mi esniyor?"
        },
        open: true,
        kind: "polarity",
        sources: ["personalCode"],
        calibration: { center: -0.0907, spread: 0.2880 },
        lowAnchors: {
          en: [
            "It depends on the situation.",
            "My rules are flexible.",
            "I have no fixed principles.",
            "Whatever works."
          ],
          tr: [
            "Duruma göre değişir.",
            "Kurallarım esnek.",
            "Sabit ilkelerim yok.",
            "Ne işe yararsa."
          ]
        },
        highAnchors: {
          en: [
            "My rules are absolute.",
            "I never break my principles.",
            "Right and wrong are clear to me.",
            "No exceptions."
          ],
          tr: [
            "Kurallarım kesindir.",
            "İlkelerimden asla şaşmam.",
            "Doğru ve yanlış benim için net.",
            "İstisna yok."
          ]
        }
      },
      {
        key: "redemption",
        code: "redemption",
        label: { en: "Course of the story", tr: "Hikâyenin seyri" },
        lowLabel: { en: "Sinking", tr: "Dibe çöken" },
        highLabel: { en: "Surfacing", tr: "Yüzeye çıkan" },
        hint: {
          en: "In the story you tell, do things repair — or fall apart?",
          tr: "Anlattığın hikâyede işler düzelerek mi bitiyor, yoksa dağılarak mı?"
        },
        open: true,
        kind: "polarity",
        sources: ["selfNarrative"],
        calibration: { center: -0.0193, spread: 0.1710 },
        lowAnchors: {
          en: [
            "It was good, but it got worse.",
            "It never got better.",
            "Good times ended in loss.",
            "In the end everything fell apart."
          ],
          tr: [
            "İyiydi ama kötüleşti.",
            "Hiç düzelmedi.",
            "İyi günler kayıpla bitti.",
            "Sonunda her şey dağıldı."
          ]
        },
        highAnchors: {
          en: [
            "It was hard, but it got better.",
            "I recovered and grew stronger.",
            "Bad times led to something good.",
            "In the end things turned out well."
          ],
          tr: [
            "Zordu ama düzeldi.",
            "Toparlandım ve güçlendim.",
            "Kötü günler iyi bir şeye vardı.",
            "Sonunda her şey yoluna girdi."
          ]
        }
      },
      {
        key: "codeGap",
        code: "code_gap",
        label: { en: "Pressure gap", tr: "Basınç farkı" },
        lowLabel: { en: "Close to each other", tr: "İkisi birbirine yakın" },
        highLabel: { en: "Strangers to each other", tr: "İkisi birbirine yabancı" },
        hint: {
          en: "How far is what you hold true from what you won't say out loud?",
          tr: "Doğru bildiğin ile dışarıda söylemediğin ne kadar uzak?"
        },
        open: false,
        kind: "distance",
        left: ["personalCode"],
        right: ["unsayableAttitude"]
      },
      {
        key: "authorityLean",
        code: "authority_lean",
        label: { en: "Facing the net", tr: "Ağ karşısında" },
        lowLabel: { en: "Net-tearer", tr: "Ağı yırtan" },
        highLabel: { en: "Net-yielding", tr: "Ağa uysal gelen" },
        hint: {
          en: "In what you keep private: do you lean toward obedience to strength, or resistance?",
          tr: "Gizli tuttuğun tarafta: güce itaat mi, yoksa karşı duruş mu ağır basıyor?"
        },
        open: false,
        kind: "polarity",
        sources: ["unsayableAttitude"],
        calibration: { center: -0.1343, spread: 0.2141 },
        lowAnchors: {
          en: [
            "Authority must always be questioned.",
            "I side with the weak against the powerful.",
            "No one deserves obedience just for being strong.",
            "Those in power must be held accountable.",
            "Freedom matters more than order."
          ],
          tr: [
            "Otorite her zaman sorgulanmalı.",
            "Güçlüye karşı zayıfın yanındayım.",
            "Kimse sırf güçlü diye itaati hak etmez.",
            "İktidardakiler hesap vermeli.",
            "Özgürlük düzenden önemlidir."
          ]
        },
        highAnchors: {
          en: [
            "The strong should rule and the weak should obey.",
            "People need a strong leader to keep them in line.",
            "Obedience to authority is a virtue.",
            "A firm hand is better than freedom.",
            "Some people are meant to command, others to serve."
          ],
          tr: [
            "Güçlü olan yönetmeli, zayıf olan itaat etmeli.",
            "İnsanları hizada tutmak için güçlü bir lider gerekir.",
            "Otoriteye itaat bir erdemdir.",
            "Sert bir el özgürlükten iyidir.",
            "Bazıları emretmek, bazıları hizmet etmek içindir."
          ]
        }
      },
      {
        key: "desireSplit",
        code: "desire_split",
        label: { en: "Different waters", tr: "Farklı sular" },
        lowLabel: { en: "Desire is woven into the life I describe", tr: "Arzu anlatılan hayata karışık" },
        highLabel: { en: "Desire stands apart from the life I describe", tr: "Arzu anlatılan hayattan ayrı" },
        hint: {
          en: "Is desire woven into the life you describe, or does it sit apart?",
          tr: "Arzu anlattığın hayata karışık mı, yoksa ayrı mı duruyor?"
        },
        open: false,
        kind: "distance",
        left: ["desireScript"],
        right: ["selfNarrative"]
      },
      {
        key: "shadowDistance",
        code: "shadow_distance",
        label: { en: "Blind-spot gulf", tr: "Kör nokta uçurumu" },
        lowLabel: { en: "Close to the person I describe", tr: "İtiraf anlattığım kişiye yakın" },
        highLabel: { en: "A stranger to the person I describe", tr: "İtiraf anlattığım kişiye yabancı" },
        hint: {
          en: "How far is the side you're ashamed of from the person you describe in public?",
          tr: "Utandığın yan, dışarıda anlattığın kişiden ne kadar uzak?"
        },
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

(function (root) {
  "use strict";

  var AGE_BANDS = [
    { id: "18-24", key: "a18_24" },
    { id: "25-34", key: "a25_34" },
    { id: "35-44", key: "a35_44" },
    { id: "45-54", key: "a45_54" },
    { id: "55-64", key: "a55_64" },
    { id: "65+", key: "a65p" }
  ];

  var GENDERS = ["woman", "man", "nonbinary", "other"];

  var COUNTRIES = (
    "AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ " +
    "CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO FR " +
    "GA GB GD GE GH GI GL GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG " +
    "KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR " +
    "MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU " +
    "RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ " +
    "UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW"
  ).split(" ");

  var CITY_MAX = 60;

  function ageKey(id) {
    var band = AGE_BANDS.find(function (item) {
      return item.id === id;
    });
    return band ? band.key : "";
  }

  function cityKey(country, city) {
    if (!country || !city) return "";
    var slug = String(city)
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ß/g, "ss")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    return slug ? country + "_" + slug : "";
  }

  function normalize(raw) {
    raw = raw || {};
    var ageBand = String(raw.ageBand || "");
    var gender = String(raw.gender || "");
    var country = String(raw.country || "").toUpperCase();
    var city = String(raw.city || "").replace(/\s+/g, " ").trim().slice(0, CITY_MAX);
    if (!ageKey(ageBand)) ageBand = "";
    if (GENDERS.indexOf(gender) < 0) gender = "";
    if (COUNTRIES.indexOf(country) < 0) country = "";
    if (!country) city = "";
    return { ageBand: ageBand, gender: gender, country: country, city: city };
  }

  // Soft hints from open text for the form only — never auto-written without Apply.
  // Avoid \\b with Turkish letters — JS word boundaries are ASCII-only.
  var CITY_HINTS = [
    { city: "İstanbul", country: "TR", re: /(?:^|[^A-Za-z])(istanbul|İstanbul)(?![A-Za-z])/i },
    { city: "Ankara", country: "TR", re: /(?:^|[^A-Za-z])ankara(?![A-Za-z])/i },
    { city: "İzmir", country: "TR", re: /(?:^|[^A-Za-z])(izmir|İzmir)(?![A-Za-z])/i },
    { city: "Bursa", country: "TR", re: /(?:^|[^A-Za-z])bursa(?![A-Za-z])/i },
    { city: "Antalya", country: "TR", re: /(?:^|[^A-Za-z])antalya(?![A-Za-z])/i },
    { city: "Berlin", country: "DE", re: /(?:^|[^A-Za-z])berlin(?![A-Za-z])/i },
    { city: "München", country: "DE", re: /(?:^|[^A-Za-z])(munich|münih|muenchen|münchen)(?![A-Za-z])/i },
    { city: "London", country: "GB", re: /(?:^|[^A-Za-z])(london|londra)(?![A-Za-z])/i },
    { city: "Paris", country: "FR", re: /(?:^|[^A-Za-z])paris(?![A-Za-z])/i },
    { city: "Amsterdam", country: "NL", re: /(?:^|[^A-Za-z])amsterdam(?![A-Za-z])/i },
    { city: "New York", country: "US", re: /(?:^|[^A-Za-z])new\s*york(?![A-Za-z])/i },
    { city: "Tokyo", country: "JP", re: /(?:^|[^A-Za-z])tokyo(?![A-Za-z])/i }
  ];

  var AGE_HINTS = [
    { ageBand: "18-24", re: /\b(18|19|20|21|22|23|24)\s*(yaşında|yasinda|yaş|yas|y\.?o\.?|years?\s*old)\b/i },
    { ageBand: "25-34", re: /\b(25|26|27|28|29|30|31|32|33|34)\s*(yaşında|yasinda|yaş|yas|y\.?o\.?|years?\s*old)\b/i },
    { ageBand: "35-44", re: /\b(35|36|37|38|39|40|41|42|43|44)\s*(yaşında|yasinda|yaş|yas|y\.?o\.?|years?\s*old)\b/i },
    { ageBand: "45-54", re: /\b(45|46|47|48|49|50|51|52|53|54)\s*(yaşında|yasinda|yaş|yas|y\.?o\.?|years?\s*old)\b/i },
    { ageBand: "55-64", re: /\b(55|56|57|58|59|60|61|62|63|64)\s*(yaşında|yasinda|yaş|yas|y\.?o\.?|years?\s*old)\b/i },
    { ageBand: "65+", re: /\b(6[5-9]|[7-9]\d)\s*(yaşında|yasinda|yaş|yas|y\.?o\.?|years?\s*old)\b/i },
    { ageBand: "18-24", re: /(?:^|[^A-Za-z])(üniversite|university|öğrenci|student)(?![A-Za-z])/i },
    { ageBand: "65+", re: /(?:^|[^A-Za-z])(emekli|retired)(?![A-Za-z])/i }
  ];

  function suggestFromText(text) {
    var source = String(text || "");
    var out = {};
    var i;
    for (i = 0; i < AGE_HINTS.length; i += 1) {
      if (AGE_HINTS[i].re.test(source)) {
        out.ageBand = AGE_HINTS[i].ageBand;
        break;
      }
    }
    if (/(?:^|[^A-Za-z])(kadın|woman|female|kız)(?![A-Za-z])/i.test(source)) out.gender = "woman";
    else if (/(?:^|[^A-Za-z])(erkek|man|male|adam)(?![A-Za-z])/i.test(source) && !/\b(human|mankind)\b/i.test(source)) {
      out.gender = "man";
    } else if (/(?:^|[^A-Za-z])(non[- ]?binary|ikili olmayan)(?![A-Za-z])/i.test(source)) {
      out.gender = "nonbinary";
    }

    if (/(?:^|[^A-Za-z])(türkiye|turkey|türkçe|turkish)(?![A-Za-z])/i.test(source)) out.country = "TR";
    else if (/(?:^|[^A-Za-z])(germany|almanya|deutsch)(?![A-Za-z])/i.test(source)) out.country = "DE";
    else if (/(?:^|[^A-Za-z])(united states|amerika|usa|american)(?![A-Za-z])/i.test(source)) out.country = "US";
    else if (/(?:^|[^A-Za-z])(britain|england|ingiltere|uk)(?![A-Za-z])/i.test(source)) out.country = "GB";
    else if (/(?:^|[^A-Za-z])(france|fransa|français|francais)(?![A-Za-z])/i.test(source)) out.country = "FR";
    else if (/(?:^|[^A-Za-z])(netherlands|hollanda|dutch)(?![A-Za-z])/i.test(source)) out.country = "NL";

    for (i = 0; i < CITY_HINTS.length; i += 1) {
      if (CITY_HINTS[i].re.test(source)) {
        out.city = CITY_HINTS[i].city;
        if (!out.country) out.country = CITY_HINTS[i].country;
        break;
      }
    }
    return normalize(out);
  }

  var api = {
    AGE_BANDS: AGE_BANDS,
    GENDERS: GENDERS,
    COUNTRIES: COUNTRIES,
    CITY_MAX: CITY_MAX,
    ageKey: ageKey,
    cityKey: cityKey,
    normalize: normalize,
    suggestFromText: suggestFromText
  };

  root.MindsetDemographics = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

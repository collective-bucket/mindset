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

  var api = {
    AGE_BANDS: AGE_BANDS,
    GENDERS: GENDERS,
    COUNTRIES: COUNTRIES,
    CITY_MAX: CITY_MAX,
    ageKey: ageKey,
    cityKey: cityKey,
    normalize: normalize
  };

  root.MindsetDemographics = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

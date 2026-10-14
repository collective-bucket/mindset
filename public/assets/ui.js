(function () {
  "use strict";

  var i18n = window.MindsetI18n;
  var t = i18n.t;

  var ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    explore: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    create: '<path d="M12 5v14M5 12h14"/>',
    tribe: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 20c0-2 .8-3.7 2-4.6 2.3.3 4 2.2 4 4.6"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>'
  };

  var TABS = [
    { id: "home", href: "/" },
    { id: "explore", href: "/explore" },
    { id: "create", href: "/new" },
    { id: "tribe", href: "/tribe" },
    { id: "me", href: "/me" }
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function icon(name) {
    return (
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + "</svg>"
    );
  }

  function mountShell() {
    var body = document.body;
    var active = body.getAttribute("data-tab") || "";

    var top = document.createElement("header");
    top.className = "topbar";
    top.innerHTML =
      '<a class="brand" href="/"><img src="/assets/logo.svg" alt="" width="26" height="26" /><span>mindset</span></a>' +
      '<a class="top-action" id="top-action" href="/login">' +
      escapeHtml(t("top.signIn")) +
      "</a>";
    body.insertBefore(top, body.firstChild);

    var footer = document.createElement("footer");
    footer.className = "footer";
    footer.innerHTML =
      '<a href="' +
      escapeHtml(window.MindsetConfig.collectiveBucketUrl) +
      '" rel="noopener">' +
      escapeHtml(t("footer.project")) +
      '</a><span class="lang" role="group" aria-label="' +
      escapeHtml(t("footer.language")) +
      '">' +
      i18n.LANGS.map(function (code) {
        return (
          '<button type="button" data-lang="' +
          code +
          '"' +
          (code === i18n.lang ? ' aria-pressed="true"' : "") +
          ">" +
          code.toUpperCase() +
          "</button>"
        );
      }).join("") +
      "</span>";
    var main = document.querySelector("main");
    if (main) main.appendChild(footer);
    else body.appendChild(footer);
    footer.addEventListener("click", function (event) {
      var button = event.target.closest("[data-lang]");
      if (button) i18n.setLang(button.getAttribute("data-lang"));
    });

    var nav = document.createElement("nav");
    nav.className = "tabbar";
    nav.setAttribute("aria-label", "mindset");
    nav.innerHTML = TABS.map(function (tab) {
      return (
        '<a href="' +
        tab.href +
        '" class="tab tab-' +
        tab.id +
        '"' +
        (tab.id === active ? ' aria-current="page"' : "") +
        ">" +
        icon(tab.id) +
        "<span>" +
        escapeHtml(t("tab." + tab.id)) +
        "</span></a>"
      );
    }).join("");
    body.appendChild(nav);

    window.MindsetStore.getOptionalSession().then(function (session) {
      var action = document.querySelector("#top-action");
      if (!action || !session) return;
      action.textContent = "";
      action.href = "/me";
      action.classList.add("is-icon");
      action.setAttribute("aria-label", t("tab.me"));
      action.innerHTML = icon("me");
    });
  }

  function formatWhen(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(i18n.lang === "tr" ? "tr-TR" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function errorText(error, fallbackKey) {
    if (!error) return t(fallbackKey || "common.error");
    if (error.code === "text_too_long") {
      var field = window.MindsetLens.fields.find(function (item) {
        return item.key === error.field;
      });
      return t("error.text_too_long", { field: field ? i18n.pick(field.label) : "" });
    }
    if (error.code && i18n.dict.en["error." + error.code]) return t("error." + error.code);
    if (error.i18n) return t(error.i18n);
    if (window.MindsetFirestore.isPermission(error)) return t("common.permission");
    return error.message || t(fallbackKey || "common.error");
  }

  function setStatus(element, message, kind) {
    if (!element) return;
    element.textContent = message || "";
    element.className = "status" + (kind ? " " + kind : "");
    element.hidden = !message;
  }

  function axisByKey(key) {
    return window.MindsetLens.axes.find(function (axis) {
      return axis.key === key;
    });
  }

  function bar(axis, score) {
    var label = escapeHtml(i18n.pick(axis.label));
    if (typeof score !== "number" || score < 0) {
      return (
        '<div class="bar-row is-unknown"><div class="bar-label"><span>' +
        label +
        "</span><span>" +
        escapeHtml(t("common.unknown")) +
        "</span></div></div>"
      );
    }
    return (
      '<div class="bar-row"><div class="bar-label"><span>' +
      label +
      "</span><span>" +
      score +
      '</span></div><div class="bar-track"><div class="bar-fill" style="width:' +
      score +
      '%"></div></div><div class="bar-poles"><span>' +
      escapeHtml(i18n.pick(axis.lowLabel)) +
      "</span><span>" +
      escapeHtml(i18n.pick(axis.highLabel)) +
      "</span></div></div>"
    );
  }

  function renderBars(container, scores, keys) {
    container.innerHTML = keys
      .map(function (key) {
        return bar(axisByKey(key), scores[key]);
      })
      .join("");
  }

  function radarPoint(cx, cy, radius, index, count, value) {
    var angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    var span = radius * (Math.max(0, value) / 100);
    return [cx + Math.cos(angle) * span, cy + Math.sin(angle) * span];
  }

  // Unknown scores are not drawn as zero; the radar only appears when all four are known.
  function renderRadar(container, scores) {
    var keys = window.MindsetReading.OPEN_KEYS;
    var complete = keys.every(function (key) {
      return scores[key] >= 0;
    });
    if (!complete) {
      container.innerHTML = "";
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var cx = 160;
    var cy = 150;
    var radius = 86;
    var rings = [0.25, 0.5, 0.75, 1]
      .map(function (scale) {
        var points = keys
          .map(function (key, index) {
            return radarPoint(cx, cy, radius * scale, index, keys.length, 100).join(",");
          })
          .join(" ");
        return '<polygon class="radar-ring" points="' + points + '"></polygon>';
      })
      .join("");
    var spokes = keys
      .map(function (key, index) {
        var end = radarPoint(cx, cy, radius, index, keys.length, 100);
        return (
          '<line class="radar-spoke" x1="' + cx + '" y1="' + cy + '" x2="' + end[0] + '" y2="' + end[1] + '"></line>'
        );
      })
      .join("");
    var shape = keys
      .map(function (key, index) {
        return radarPoint(cx, cy, radius, index, keys.length, scores[key]).join(",");
      })
      .join(" ");
    var labels = keys
      .map(function (key, index) {
        var spot = radarPoint(cx, cy, radius + 26, index, keys.length, 100);
        var anchor = "middle";
        if (spot[0] < cx - 20) {
          spot = [cx - radius - 8, cy - 12];
          anchor = "start";
        } else if (spot[0] > cx + 20) {
          spot = [cx + radius + 8, cy - 12];
          anchor = "end";
        }
        return (
          '<text class="radar-label" x="' + spot[0] + '" y="' + spot[1] + '" text-anchor="' + anchor + '">' +
          escapeHtml(i18n.pick(axisByKey(key).label)) +
          "</text>"
        );
      })
      .join("");
    container.innerHTML =
      '<svg class="radar" viewBox="0 0 320 300" role="img" aria-label="' +
      escapeHtml(t("common.approx")) +
      '">' +
      rings +
      spokes +
      '<polygon class="radar-shape" points="' +
      shape +
      '"></polygon>' +
      labels +
      "</svg>";
  }

  function renderOpenTexts(container, doc) {
    container.innerHTML = window.MindsetLens.fields
      .filter(function (field) {
        return field.open && doc[field.key];
      })
      .map(function (field) {
        return (
          '<article class="post"><h3>' +
          escapeHtml(i18n.pick(field.label)) +
          "</h3><p>" +
          escapeHtml(doc[field.key]) +
          "</p></article>"
        );
      })
      .join("");
  }

  function hue(number) {
    return (Number(number) * 137) % 360;
  }

  function avatar(number, size) {
    var label = String(number);
    return (
      '<span class="avatar' +
      (size ? " avatar-" + size : "") +
      '" style="--hue:' +
      hue(number) +
      '" aria-hidden="true">' +
      escapeHtml(label.length > 4 ? label.slice(-4) : label) +
      "</span>"
    );
  }

  function badges(doc) {
    var items = [];
    if (doc.ageBand) items.push(doc.ageBand);
    if (doc.gender) items.push(t("gender." + doc.gender));
    if (doc.country) items.push(i18n.countryName(doc.country));
    return items
      .map(function (item) {
        return '<span class="badge">' + escapeHtml(item) + "</span>";
      })
      .join("");
  }

  function profileHref(doc) {
    return "/i/" + doc.id;
  }

  function miniMeters(scores) {
    return (
      '<div class="meters">' +
      window.MindsetReading.OPEN_KEYS.map(function (key) {
        var value = scores[key];
        var known = value >= 0;
        return (
          '<div class="meter' +
          (known ? "" : " is-unknown") +
          '"><span>' +
          escapeHtml(i18n.pick(axisByKey(key).label)) +
          '</span><div class="meter-track"><div class="meter-fill" style="width:' +
          (known ? value : 0) +
          '%"></div></div></div>'
        );
      }).join("") +
      "</div>"
    );
  }

  function card(doc, options) {
    options = options || {};
    if (!/^\d+$/.test(String(doc.id || ""))) return "";
    var scores = window.MindsetReading.scoresOf(doc);
    var alias = options.alias || doc.alias || "";
    var quote = String(doc.personalCode || "");
    if (quote.length > 160) quote = quote.slice(0, 157) + "…";
    return (
      '<a class="card" href="' +
      profileHref(doc) +
      '">' +
      '<div class="card-head">' +
      avatar(doc.id) +
      '<div class="card-id"><strong>' +
      escapeHtml(t("common.mindset", { n: doc.id })) +
      "</strong>" +
      (alias ? '<span class="alias">@' + escapeHtml(alias) + "</span>" : "") +
      "</div>" +
      (options.tag ? '<span class="tag">' + escapeHtml(options.tag) + "</span>" : "") +
      "</div>" +
      (doc.ageBand || doc.gender || doc.country ? '<div class="badges">' + badges(doc) + "</div>" : "") +
      '<p class="card-summary">' +
      escapeHtml(window.MindsetReading.summary(doc.id, scores, i18n.lang).replace(/^\d+\.\s*/, "")) +
      "</p>" +
      (quote ? '<p class="card-quote">' + escapeHtml(quote) + "</p>" : "") +
      miniMeters(scores) +
      "</a>"
    );
  }

  function renderCards(container, rows, emptyKey, options) {
    if (!rows.length) {
      container.innerHTML = '<p class="empty">' + escapeHtml(t(emptyKey || "feed.empty")) + "</p>";
      return;
    }
    container.innerHTML = rows
      .map(function (doc) {
        return card(doc, options && options(doc));
      })
      .join("");
  }

  function textareaControl(field) {
    return (
      '<label class="field" for="' +
      field.key +
      '"><span>' +
      escapeHtml(i18n.pick(field.label)) +
      '</span><textarea id="' +
      field.key +
      '" name="' +
      field.key +
      '" rows="' +
      field.rows +
      '" maxlength="1200" placeholder="' +
      escapeHtml(i18n.pick(field.placeholder)) +
      '"></textarea><small data-count-for="' +
      field.key +
      '">0 / 1200</small></label>'
    );
  }

  function renderForm(openHost, closedHost) {
    var fields = window.MindsetLens.fields;
    openHost.innerHTML = fields
      .filter(function (field) {
        return field.open;
      })
      .map(textareaControl)
      .join("");
    closedHost.innerHTML = fields
      .filter(function (field) {
        return !field.open;
      })
      .map(textareaControl)
      .join("");
  }

  function option(value, label, selected) {
    return (
      '<option value="' +
      escapeHtml(value) +
      '"' +
      (selected ? " selected" : "") +
      ">" +
      escapeHtml(label) +
      "</option>"
    );
  }

  function sortedCountries() {
    return window.MindsetDemographics.COUNTRIES.map(function (code) {
      return { code: code, name: i18n.countryName(code) };
    }).sort(function (left, right) {
      return left.name.localeCompare(right.name, i18n.lang);
    });
  }

  function demoOptions(kind, emptyLabel) {
    var demo = window.MindsetDemographics;
    var html = option("", emptyLabel, false);
    if (kind === "ageBand") {
      demo.AGE_BANDS.forEach(function (band) {
        html += option(band.id, band.id, false);
      });
    } else if (kind === "gender") {
      demo.GENDERS.forEach(function (gender) {
        html += option(gender, t("gender." + gender), false);
      });
    } else if (kind === "country") {
      sortedCountries().forEach(function (item) {
        html += option(item.code, item.name, false);
      });
    }
    return html;
  }

  function renderDemoForm(host) {
    var none = t("demo.none");
    host.innerHTML =
      '<div class="demo-grid">' +
      '<label class="field"><span>' + escapeHtml(t("demo.age")) + '</span><select id="ageBand">' + demoOptions("ageBand", none) + "</select></label>" +
      '<label class="field"><span>' + escapeHtml(t("demo.gender")) + '</span><select id="gender">' + demoOptions("gender", none) + "</select></label>" +
      '<label class="field"><span>' + escapeHtml(t("demo.country")) + '</span><select id="country">' + demoOptions("country", none) + "</select></label>" +
      '<label class="field"><span>' + escapeHtml(t("demo.city")) + '</span><input id="city" type="text" maxlength="' + window.MindsetDemographics.CITY_MAX + '" autocomplete="address-level2" /><small>' + escapeHtml(t("demo.cityHint")) + "</small></label>" +
      "</div>";
    var country = host.querySelector("#country");
    var city = host.querySelector("#city");
    function sync() {
      city.disabled = !country.value;
    }
    country.addEventListener("change", sync);
    sync();
  }

  function collectDemo(form) {
    function value(id) {
      var input = form.querySelector("#" + id);
      return input ? input.value : "";
    }
    return window.MindsetDemographics.normalize({
      ageBand: value("ageBand"),
      gender: value("gender"),
      country: value("country"),
      city: value("city")
    });
  }

  function fillDemo(form, demo) {
    ["ageBand", "gender", "country", "city"].forEach(function (key) {
      var input = form.querySelector("#" + key);
      if (input) input.value = (demo && demo[key]) || "";
    });
    var city = form.querySelector("#city");
    var country = form.querySelector("#country");
    if (city && country) city.disabled = !country.value;
  }

  function collectTexts(form) {
    var raw = {};
    window.MindsetLens.fields.forEach(function (field) {
      var input = form.querySelector("#" + field.key);
      raw[field.key] = input ? input.value : "";
    });
    return window.MindsetReading.normalizeTexts(raw);
  }

  function fillTexts(form, texts) {
    window.MindsetLens.fields.forEach(function (field) {
      var input = form.querySelector("#" + field.key);
      if (input) input.value = (texts && texts[field.key]) || "";
      updateCount(form, field.key);
    });
  }

  function updateCount(form, key) {
    var input = form.querySelector("#" + key);
    var count = form.querySelector('[data-count-for="' + key + '"]');
    if (!input || !count) return;
    count.textContent = input.value.length + " / 1200";
  }

  function loginHref() {
    return "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search);
  }

  function closeOnBackdrop(dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close("cancel");
    });
  }

  window.MindsetUi = {
    escapeHtml: escapeHtml,
    icon: icon,
    formatWhen: formatWhen,
    errorText: errorText,
    setStatus: setStatus,
    axisByKey: axisByKey,
    renderBars: renderBars,
    renderRadar: renderRadar,
    renderOpenTexts: renderOpenTexts,
    avatar: avatar,
    badges: badges,
    card: card,
    renderCards: renderCards,
    renderForm: renderForm,
    renderDemoForm: renderDemoForm,
    demoOptions: demoOptions,
    collectDemo: collectDemo,
    fillDemo: fillDemo,
    collectTexts: collectTexts,
    fillTexts: fillTexts,
    updateCount: updateCount,
    loginHref: loginHref,
    closeOnBackdrop: closeOnBackdrop
  };

  mountShell();
})();

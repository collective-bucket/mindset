(function () {
  "use strict";

  var i18n = window.MindsetI18n;
  var t = i18n.t;

  // Shared fish mark around (0,0), facing right — cards, avatar, gamebar, lake.
  // Ichthys body (forked tail) + small dorsal/ventral fins + eye.
  var FISH_BODY =
    "M5.2 0C2.2-3.2-1.8-3.2-4.6 0L-7.2-2.6L-5 0L-7.2 2.6L-4.6 0C-1.8 3.2 2.2 3.2 5.2 0Z";
  var FISH_DORSAL = "M.4-2.7L1.7-4.4L2.7-2.4Z";
  var FISH_VENTRAL = "M.4 2.7L1.7 4.4L2.7 2.4Z";
  var FISH_PATH = FISH_BODY;
  var FISH_EYE = { cx: 3.4, cy: -0.45, r: 0.5 };

  function fishMark() {
    return (
      '<path class="fish-body" d="' +
      FISH_BODY +
      '"/>' +
      '<path class="fish-fin fish-fin-dorsal" d="' +
      FISH_DORSAL +
      '"/>' +
      '<path class="fish-fin fish-fin-ventral" d="' +
      FISH_VENTRAL +
      '"/>' +
      '<circle class="fish-eye" cx="' +
      FISH_EYE.cx +
      '" cy="' +
      FISH_EYE.cy +
      '" r="' +
      FISH_EYE.r +
      '"/>'
    );
  }

  function entryFishIcon(x, y, scale) {
    return (
      '<g transform="translate(' + x + " " + y + ") scale(" + scale + ')">' + fishMark() + "</g>"
    );
  }

  var ICONS = {
    lake: {
      box: "0 0 40 40",
      body:
        '<rect x="5" y="5" width="30" height="30" rx="7"/>' +
        '<path d="M11 15c2.4-2 4.5-2 6 0s4 2 6 0 3.5-1.5 6-.5"/>' +
        '<path d="M11 21c2.4-2 4.5-2 6 0s4 2 6 0 3.5-1.5 6-.5"/>' +
        '<path d="M11 27c2.4-2 4.5-2 6 0s4 2 6 0 3.5-1.5 6-.5"/>'
    },
    current: {
      box: "0 0 40 40",
      body:
        '<path d="M4 13c4-3.4 7-3.4 10.4 0s6.4 3.4 10.4 0 6-2.6 10.2-1"/>' +
        '<path d="M4 21.5c4-3.4 7-3.4 10.4 0s6.4 3.4 10.4 0 6-2.6 10.2-1"/>' +
        '<path d="M4 30c4-3.4 7-3.4 10.4 0s6.4 3.4 10.4 0 6-2.6 10.2-1"/>'
    },
    school: {
      box: "0 0 40 40",
      body: entryFishIcon(14, 15, 1.75) + entryFishIcon(26, 26, 1.75)
    },
    fish: {
      box: "0 0 40 40",
      body: entryFishIcon(20, 20, 2.2)
    },
    share: {
      box: "0 0 24 24",
      body:
        '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/>' +
        '<path d="M8.4 13.2l7.2 4.1M15.6 6.7l-7.2 4.1"/>'
    },
    edit: {
      box: "0 0 24 24",
      body: '<path d="M4 20l4.2-1.1L19 8.1 15.9 5 5.1 15.8 4 20z"/><path d="M13.8 7.1l3.1 3.1"/>'
    },
    preview: {
      box: "0 0 24 24",
      body:
        '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/>' +
        '<circle cx="12" cy="12" r="3"/>'
    },
    manage: {
      box: "0 0 24 24",
      body:
        '<circle cx="12" cy="12" r="3"/>' +
        '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
    },
    // Head-and-shoulders silhouette for "go to me / profile owner".
    profile: {
      box: "0 0 24 24",
      body:
        '<circle cx="12" cy="8" r="3.5"/>' +
        '<path d="M5.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/>'
    },
    guide: {
      box: "0 0 24 24",
      body:
        '<circle cx="12" cy="12" r="9"/>' +
        '<path d="M9.6 9.2c.5-1.4 2.5-2 3.8-1.2s1.4 2.4.2 3.3c-.8.6-1.6 1.1-1.6 2.2"/>' +
        '<circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>'
    },
    lock: {
      box: "0 0 24 24",
      body: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
    },
    close: {
      box: "0 0 24 24",
      body: '<path d="M6 6l12 12M18 6L6 18"/>'
    },
    more: {
      box: "0 0 24 24",
      body:
        '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/>' +
        '<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>' +
        '<circle cx="12" cy="18" r="1.6" fill="currentColor" stroke="none"/>'
    },
    search: {
      box: "0 0 24 24",
      body: '<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2 20 20"/>'
    },
    shine: {
      box: "0 0 24 24",
      body:
        '<path d="M5 16.2c1.8-4.4 4.2-6.6 7-6.6s5.2 2.2 7 6.6"/>' +
        '<path d="M8.2 16.2c1-2.3 2.3-3.5 3.8-3.5s2.8 1.2 3.8 3.5"/>' +
        '<path d="M12 3.6v2.4M9.6 5.2l1.4 1.4M14.4 5.2L13 6.6"/>'
    },
    dismiss: {
      box: "0 0 24 24",
      body:
        '<path d="M2.8 12S6 7.2 12 7.2 21.2 12 21.2 12 18 16.8 12 16.8 2.8 12 2.8 12z"/>' +
        '<path d="M4.6 5.4l14.8 13.2"/>'
    },
    withdraw: {
      box: "0 0 24 24",
      body:
        '<path d="M8.6 8.2H6a6.6 6.6 0 1 0 1.9 7.8"/>' +
        '<path d="M8.6 4v6.4L4.8 6.8"/>'
    },
    stop: {
      box: "0 0 24 24",
      body:
        '<path d="M9.4 14.6l-1.5 1.5a3.2 3.2 0 0 1-4.5-4.5l1.5-1.5"/>' +
        '<path d="M14.6 9.4l1.5-1.5a3.2 3.2 0 0 1 4.5 4.5l-1.5 1.5"/>'
    },
    review: {
      box: "0 0 24 24",
      body: entryFishIcon(7, 12, 0.72) + entryFishIcon(17, 12, 0.72)
    },
    radar: {
      box: "0 0 24 24",
      body: '<path d="M12 3.5l7.2 8.5L12 20.5 4.8 12z"/><path d="M12 3.5v17M4.8 12h14.4"/>'
    },
    bars: {
      box: "0 0 24 24",
      body: '<path d="M5 19V11M12 19V5M19 19v-7"/>'
    },
    trend: {
      box: "0 0 24 24",
      body: '<path d="M4 16.5l5.2-4.2 3.6 2.6L20 7"/><path d="M14.5 7H20v5.5"/>'
    },
    trash: {
      box: "0 0 24 24",
      body: '<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/><path d="M10 11v6M14 11v6"/>'
    },
    whole: {
      box: "0 0 24 24",
      body:
        '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>' +
        '<path d="M3 3v5h5"/>'
    },
    list: {
      box: "0 0 24 24",
      body: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4 7h1.2M4 12h1.2M4 17h1.2"/>'
    },
    waves: {
      box: "0 0 24 24",
      body:
        '<path d="M3 8.5c2-1.6 3.5-1.6 5.2 0s3.2 1.6 5.2 0 3-1.2 5.1-.5"/>' +
        '<path d="M3 13c2-1.6 3.5-1.6 5.2 0s3.2 1.6 5.2 0 3-1.2 5.1-.5"/>' +
        '<path d="M3 17.5c2-1.6 3.5-1.6 5.2 0s3.2 1.6 5.2 0 3-1.2 5.1-.5"/>'
    }
  };

  var BAR = [
    { id: "lake", href: "/lake", icon: "lake" },
    { id: "current", href: "/", icon: "current" },
    { id: "school", href: "/school", icon: "school" },
    { id: "me", href: "/me", icon: "fish" }
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function icon(name) {
    var item = ICONS[name];
    return (
      '<svg class="icon icon-' + name + '" viewBox="' + item.box + '" aria-hidden="true">' + item.body + "</svg>"
    );
  }

  function iconNames() {
    return Object.keys(ICONS);
  }

  function fishGlyph(className) {
    return (
      '<svg class="glyph ' +
      (className || "") +
      '" viewBox="-8 -5.2 16.4 10.4" aria-hidden="true">' +
      fishMark() +
      "</svg>"
    );
  }

  function footerMenuLinks() {
    return [
      { href: "/", label: t("footer.home") },
      { href: "/privacy", label: t("footer.privacy") },
      { href: "/cookies", label: t("footer.cookies") },
      { href: "/terms", label: t("footer.terms") },
      { href: "/about", label: t("landing.whatIsThis") },
      { href: "https://github.com/collective-bucket/mindset", label: t("footer.github"), external: true },
      { href: "/contribute", label: t("footer.contribute") },
      { href: "/license", label: t("footer.license") },
      { href: "https://collectivebucket.com", label: t("footer.collective"), external: true }
    ];
  }

  function brandLabel() {
    return t("brand.name");
  }

  function titleSuffix() {
    return " · " + brandLabel();
  }

  function crumbLabelFromBody() {
    var body = document.body;
    var text = body.getAttribute("data-crumb-text");
    if (text) return text;
    var key = body.getAttribute("data-crumb") || body.getAttribute("data-title");
    return key ? t(key) : "";
  }

  function setCrumb(label) {
    var current = document.querySelector("#crumb-current");
    if (current) {
      current.textContent = label || "";
      current.hidden = !label;
    }
    var sep = document.querySelector("#crumb-sep");
    if (sep) sep.hidden = !label;
    if (label) document.title = label + titleSuffix();
  }

  var LANG_CHOICES = [
    { code: "tr", label: "Türkçe" },
    { code: "en", label: "English" }
  ];

  function flag(code) {
    if (code === "tr") {
      return (
        '<svg class="flag" viewBox="0 0 30 20" aria-hidden="true">' +
        '<rect width="30" height="20" fill="#E30A17"/>' +
        '<circle cx="11.2" cy="10" r="5" fill="#fff"/>' +
        '<circle cx="12.8" cy="10" r="4" fill="#E30A17"/>' +
        '<polygon fill="#fff" points="17.30,7.85 17.80,9.31 19.34,9.34 18.11,10.26 18.56,11.74 17.30,10.85 16.04,11.74 16.49,10.26 15.26,9.34 16.80,9.31"/>' +
        "</svg>"
      );
    }
    return (
      '<svg class="flag" viewBox="0 0 30 20" aria-hidden="true">' +
      '<rect width="30" height="20" fill="#fff"/>' +
      '<path fill="#CF142B" d="M13 0h4v20h-4zM0 8h30v4H0z"/>' +
      "</svg>"
    );
  }

  function mountShell() {
    var body = document.body;
    var active = body.getAttribute("data-tab") || "";
    var crumb = crumbLabelFromBody();

    var top = document.createElement("header");
    top.className = "top";
    top.innerHTML =
      '<nav class="crumbs" aria-label="' +
      escapeHtml(t("nav.breadcrumb")) +
      '">' +
      '<a class="wordmark" href="/">' +
      '<img class="brand-mark" src="/assets/logo.svg" width="28" height="28" alt="" />' +
      '<span>' +
      escapeHtml(brandLabel()) +
      "</span></a>" +
      '<span class="crumb-sep" id="crumb-sep"' +
      (crumb ? "" : " hidden") +
      " aria-hidden=\"true\">›</span>" +
      '<span class="crumb-current" id="crumb-current"' +
      (crumb ? "" : " hidden") +
      ">" +
      escapeHtml(crumb) +
      "</span></nav>" +
      '<div class="top-actions">' +
      '<div class="lang dock">' +
      '<form class="dock-search" id="dock-search" role="search" aria-hidden="true">' +
      '<label class="visually-hidden" for="dock-search-input">' +
      escapeHtml(t("landing.lookupLabel")) +
      "</label>" +
      '<span class="dock-search-hash" aria-hidden="true">#</span>' +
      '<input id="dock-search-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="80" tabindex="-1" placeholder="' +
      escapeHtml(t("landing.lookupPlaceholder")) +
      '" />' +
      "</form>" +
      '<button type="button" class="dock-item" data-dock-search aria-expanded="false" aria-pressed="false" aria-controls="dock-search" aria-label="' +
      escapeHtml(t("nav.search")) +
      '">' +
      icon("search") +
      "</button>" +
      '<button type="button" class="dock-item" data-lang-menu aria-expanded="false" aria-haspopup="menu" aria-controls="lang-menu" aria-label="' +
      escapeHtml(t("footer.language")) +
      '">' +
      flag(i18n.lang) +
      "</button>" +
      '<button type="button" class="dock-item" data-site-menu aria-expanded="false" aria-haspopup="menu" aria-controls="site-menu" aria-label="' +
      escapeHtml(t("footer.menu")) +
      '">' +
      icon("more") +
      "</button></div>" +
      '<div id="lang-menu" class="lang-menu" role="menu" hidden>' +
      LANG_CHOICES.map(function (choice) {
        return (
          '<button type="button" role="menuitemradio" data-lang="' +
          choice.code +
          '" aria-checked="' +
          (choice.code === i18n.lang ? "true" : "false") +
          '">' +
          flag(choice.code) +
          "<span>" +
          choice.label +
          "</span></button>"
        );
      }).join("") +
      "</div>" +
      '<div id="site-menu" class="lang-menu" role="menu" hidden>' +
      footerMenuLinks()
        .map(function (link) {
          return (
            '<a role="menuitem" href="' +
            escapeHtml(link.href) +
            '"' +
            (link.external ? ' rel="noopener noreferrer"' : "") +
            ">" +
            escapeHtml(link.label) +
            "</a>"
          );
        })
        .join("") +
      "</div></div>";
    body.insertBefore(top, body.firstChild);
    var siteMenu = top.querySelector("#site-menu");
    var siteMenuButton = top.querySelector("[data-site-menu]");
    var langMenu = top.querySelector("#lang-menu");
    var langMenuButton = top.querySelector("[data-lang-menu]");
    function setLangMenu(open) {
      if (!langMenu || !langMenuButton) return;
      langMenu.hidden = !open;
      langMenuButton.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) setSiteMenu(false);
    }
    function setSiteMenu(open) {
      if (!siteMenu || !siteMenuButton) return;
      siteMenu.hidden = !open;
      siteMenuButton.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) setLangMenu(false);
    }
    top.addEventListener("click", function (event) {
      var langChoice = event.target.closest("[data-lang]");
      if (langChoice) {
        setLangMenu(false);
        i18n.setLang(langChoice.getAttribute("data-lang"));
        return;
      }
      var langToggle = event.target.closest("[data-lang-menu]");
      if (langToggle) {
        event.stopPropagation();
        setLangMenu(langMenu.hidden);
        return;
      }
      var menuButton = event.target.closest("[data-site-menu]");
      if (!menuButton) return;
      event.stopPropagation();
      setSiteMenu(siteMenu.hidden);
    });
    document.addEventListener("click", function (event) {
      if (siteMenu && !siteMenu.hidden && !event.target.closest("#site-menu") && !event.target.closest("[data-site-menu]")) {
        setSiteMenu(false);
      }
      if (langMenu && !langMenu.hidden && !event.target.closest("#lang-menu") && !event.target.closest("[data-lang-menu]")) {
        setLangMenu(false);
      }
    });
    var searchDock = top.querySelector(".lang.dock");
    var searchForm = top.querySelector("#dock-search");
    var searchInput = top.querySelector("#dock-search-input");
    var searchButton = top.querySelector("[data-dock-search]");
    var searchStatus = document.createElement("p");
    searchStatus.id = "dock-search-status";
    searchStatus.className = "status";
    searchStatus.hidden = true;
    searchStatus.setAttribute("role", "status");

    function searchNumber(text) {
      var raw = String(text || "").trim();
      if (!raw) return null;
      try {
        if (/^https?:\/\//i.test(raw) || raw.indexOf("/") >= 0) {
          raw = new URL(raw, window.location.origin).pathname || raw;
        }
      } catch (error) {
        return null;
      }
      var match = raw.match(/(?:^|\/)(?:i\/)?#?(\d{1,7})\/?$/i);
      if (!match) return null;
      var n = Number(match[1]);
      if (!Number.isInteger(n) || n < 1) return null;
      return n;
    }

    function setSearchOpen(open) {
      if (!searchDock || !searchForm || !searchButton || !searchInput) return;
      searchDock.classList.toggle("is-search-open", open);
      searchButton.setAttribute("aria-expanded", open ? "true" : "false");
      searchButton.setAttribute("aria-pressed", "false");
      searchForm.setAttribute("aria-hidden", open ? "false" : "true");
      searchInput.tabIndex = open ? 0 : -1;
      if (!open) setStatus(searchStatus, "");
      if (open) {
        setSiteMenu(false);
        setLangMenu(false);
        window.requestAnimationFrame(function () {
          searchInput.focus();
        });
      }
    }

    function openSearchProfile() {
      var raw = String(searchInput.value || "").trim();
      if (!raw) return;
      var number = searchNumber(raw);
      if (!number) {
        setStatus(searchStatus, t("landing.lookupBad"), "error");
        searchInput.focus();
        return;
      }
      setStatus(searchStatus, "");
      window.location.assign("/i/" + number);
    }

    if (searchForm) {
      searchForm.addEventListener("submit", function (event) {
        event.preventDefault();
        openSearchProfile();
      });
    }
    if (searchInput) {
      searchInput.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        openSearchProfile();
      });
    }
    if (searchButton) {
      searchButton.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = searchDock.classList.contains("is-search-open");
        if (!open) {
          setSearchOpen(true);
          return;
        }
        openSearchProfile();
      });
    }
    document.addEventListener("click", function (event) {
      if (!searchDock || !searchDock.classList.contains("is-search-open")) return;
      if (event.target.closest("#dock-search") || event.target.closest("[data-dock-search]")) return;
      setSearchOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      setSiteMenu(false);
      setSearchOpen(false);
    });
    if (siteMenu) {
      siteMenu.addEventListener("click", function (event) {
        if (event.target.closest("a")) setSiteMenu(false);
      });
    }

    document.addEventListener("click", function (event) {
      var back = event.target.closest("a.head-back");
      if (!back) return;
      event.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.assign("/");
    });

    document.addEventListener("click", function (event) {
      var kindHelp = event.target.closest("[data-kind-help]");
      if (!kindHelp) return;
      event.preventDefault();
      event.stopPropagation();
      showSimHelp(kindHelp.getAttribute("data-kind-help"));
    });

    document.addEventListener("keydown", function (event) {
      var kindHelp = event.target.closest("[data-kind-help]");
      if (!kindHelp) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      showSimHelp(kindHelp.getAttribute("data-kind-help"));
    });

    function paintActingExit() {
      var dock = top.querySelector(".lang.dock");
      var existing = dock && dock.querySelector("[data-acting-exit]");
      var as = window.MindsetStore && window.MindsetStore.getActingAs && window.MindsetStore.getActingAs();
      if (!as) {
        if (existing) existing.remove();
        return;
      }
      if (!dock) return;
      if (!existing) {
        existing = document.createElement("button");
        existing.type = "button";
        existing.className = "dock-item";
        existing.setAttribute("data-acting-exit", "");
      }
      var menu = dock.querySelector("[data-site-menu]");
      if (menu) dock.insertBefore(existing, menu);
      else dock.appendChild(existing);
      existing.textContent = t("sim.exitMind");
    }

    paintActingExit();
    var noticeDock = document.createElement("div");
    noticeDock.className = "notice-dock";
    document.querySelectorAll("#page-status, #feed-status, #auth-status").forEach(function (node) {
      noticeDock.appendChild(node);
    });
    noticeDock.appendChild(searchStatus);
    noticeDock.addEventListener("click", function (event) {
      if (!event.target.closest("[data-notice-close]")) return;
      var status = event.target.closest(".status");
      setStatus(status, "");
    });
    body.appendChild(noticeDock);
    document.addEventListener("click", function (event) {
      if (!event.target.closest("[data-acting-exit]")) return;
      window.MindsetStore.clearActingAs();
      paintActingExit();
      window.location.assign("/root");
    });

    var nav = document.createElement("nav");
    nav.className = "gamebar dock";
    nav.id = "gamebar";
    nav.hidden = true;
    nav.setAttribute("aria-label", t("bar.label"));
    nav.innerHTML = BAR.map(function (item) {
      return (
        '<a href="' +
        item.href +
        '" class="gamebar-button dock-item gamebar-' +
        item.id +
        '"' +
        (item.id === active ? ' aria-current="page"' : "") +
        ">" +
        icon(item.icon) +
        "<span>" +
        escapeHtml(t("bar." + item.id)) +
        '</span><small class="notice-badge" hidden></small></a>'
      );
    }).join("");
    body.appendChild(nav);
    if (body.getAttribute("data-tab") && !body.hasAttribute("data-no-gamebar")) {
      nav.hidden = false;
      body.classList.add("has-gamebar");
    }

    var siteFooter = document.createElement("footer");
    siteFooter.className = "site-footer";
    siteFooter.innerHTML =
      '<nav class="site-footer-row" aria-label="' +
      escapeHtml(t("footer.legalLinks")) +
      '">' +
      '<a href="/">' +
      escapeHtml(t("footer.home")) +
      '</a><a href="/privacy">' +
      escapeHtml(t("footer.privacy")) +
      '</a><a href="/cookies">' +
      escapeHtml(t("footer.cookies")) +
      '</a><a href="/terms">' +
      escapeHtml(t("footer.terms")) +
      '</a><a href="/about">' +
      escapeHtml(t("landing.whatIsThis")) +
      "</a></nav>" +
      '<nav class="site-footer-row" aria-label="' +
      escapeHtml(t("footer.projectLinks")) +
      '">' +
      '<a href="https://github.com/collective-bucket/mindset" rel="noopener noreferrer">' +
      escapeHtml(t("footer.github")) +
      '</a><a href="/contribute">' +
      escapeHtml(t("footer.contribute")) +
      '</a><a href="/license">' +
      escapeHtml(t("footer.license")) +
      "</a></nav>" +
      '<a class="site-footer-collective" href="https://collectivebucket.com" rel="noopener noreferrer">' +
      '<img src="https://collectivebucket.com/assets/logo.svg" width="18" height="18" alt="" />' +
      "<span>" +
      escapeHtml(t("footer.collective")) +
      "</span></a>";
    body.appendChild(siteFooter);

    var lastScrollY = window.scrollY || 0;
    var scrollThreshold = 8;

    function chromeForScroll() {
      if (body.classList.contains("has-gamebar") && !nav.hidden) return nav;
      return null;
    }

    window.addEventListener(
      "scroll",
      function () {
        var chrome = chromeForScroll();
        if (!chrome) return;
        var y = window.scrollY || 0;
        var delta = y - lastScrollY;
        if (Math.abs(delta) < scrollThreshold) {
          return;
        }
        if (delta > 0 && y > scrollThreshold) {
          chrome.classList.add("is-away");
        } else {
          chrome.classList.remove("is-away");
        }
        lastScrollY = y;
      },
      { passive: true }
    );

    window.MindsetStore.getOptionalSession().then(function (session) {
      if (!session || body.hasAttribute("data-no-gamebar")) {
        nav.hidden = true;
        body.classList.remove("has-gamebar");
        placePageLoading();
        if (!session) return;
        siteFooter.hidden = true;
        return;
      }
      nav.hidden = false;
      body.classList.add("has-gamebar");
      siteFooter.hidden = true;
      siteFooter.classList.remove("is-away");
      nav.classList.remove("is-away");
      if (window.MindsetNotices && window.MindsetNotices.refresh) {
        window.MindsetNotices.refresh(session).catch(function () {});
      }
      placePageLoading();
    });
    window.addEventListener("resize", placePageLoading);
  }

  function authWallHtml() {
    var openAxes = window.MindsetLens.axes
      .filter(function (axis) {
        return axis.open;
      })
      .map(function (axis) {
        return (
          "<li><strong>" +
          escapeHtml(i18n.pick(axis.label)) +
          '</strong> <span class="hint">(' +
          escapeHtml(axis.code.replace(/_/g, " ")) +
          ")</span> — " +
          escapeHtml(axisHint(axis) || i18n.pick(axis.lowLabel) + " ↔ " + i18n.pick(axis.highLabel)) +
          "</li>"
        );
      })
      .join("");
    return (
      "<h1>" +
      escapeHtml(t("gate.title")) +
      '</h1><p class="lead">' +
      escapeHtml(t("gate.lead")) +
      '</p><ul class="plain-list gate-points">' +
      "<li>" +
      escapeHtml(t("gate.point1")) +
      "</li><li>" +
      escapeHtml(t("gate.point2")) +
      "</li><li>" +
      escapeHtml(t("gate.point3")) +
      '</li></ul><div class="actions">' +
      '<a class="btn btn-primary" data-auth-login href="' +
      loginHref() +
      '">' +
      escapeHtml(t("gate.enter")) +
      '</a><a class="btn" href="/register">' +
      escapeHtml(t("auth.submitRegister")) +
      "</a></div>" +
      '<details class="how-to-read gate-schema"><summary>' +
      escapeHtml(t("gate.schemaTitle")) +
      '</summary><p class="hint">' +
      escapeHtml(t("gate.method")) +
      '</p><ul class="plain-list">' +
      openAxes +
      '</ul><p class="hint">' +
      escapeHtml(t("gate.closedNote")) +
      '</p><p class="hint">' +
      escapeHtml(t("common.notTest")) +
      "</p></details>"
    );
  }

  async function requireAuth() {
    var session = await window.MindsetStore.getOptionalSession();
    var wall = document.querySelector("#auth-wall");
    var gated = document.querySelector("#gated");
    if (session) {
      if (wall) wall.hidden = true;
      if (gated) gated.hidden = false;
      return session;
    }
    if (gated) gated.hidden = true;
    if (wall) {
      wall.innerHTML = authWallHtml();
      wall.hidden = false;
    }
    return null;
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
    if (error.status === 429 || /quota exceeded/i.test(String(error.message || ""))) return t("common.quota");
    if (error.status) return t(fallbackKey || "common.error");
    return error.message || t(fallbackKey || "common.error");
  }

  function ensureNoticeClose(element) {
    if (!element.closest || !element.closest(".notice-dock")) return null;
    var text = element.querySelector(".notice-text");
    if (text) return text;
    element.textContent = "";
    text = document.createElement("span");
    text.className = "notice-text";
    var close = document.createElement("button");
    close.type = "button";
    close.className = "notice-close";
    close.setAttribute("data-notice-close", "");
    close.setAttribute("aria-label", t("common.close"));
    close.innerHTML = icon("close");
    element.appendChild(text);
    element.appendChild(close);
    return text;
  }

  function setStatus(element, message, kind) {
    if (!element) return;
    var text = ensureNoticeClose(element);
    if (text) text.textContent = message || "";
    else element.textContent = message || "";
    element.className = "status" + (kind ? " " + kind : "");
    element.hidden = !message;
  }

  function fieldByKey(key) {
    return window.MindsetLens.fields.find(function (field) {
      return field.key === key;
    });
  }

  function fieldLabel(key) {
    var field = fieldByKey(key);
    return field ? i18n.pick(field.label) : key;
  }

  function axisByKey(key) {
    return window.MindsetLens.axes.find(function (axis) {
      return axis.key === key;
    });
  }

  function axisHint(axis) {
    return axis && axis.hint ? i18n.pick(axis.hint) : "";
  }

  function bar(axis, score) {
    var label = escapeHtml(i18n.pick(axis.label));
    var hint = axisHint(axis);
    var tip = hint ? ' title="' + escapeHtml(hint) + '"' : "";
    if (typeof score !== "number" || score < 0) {
      return (
        '<div class="bar-row is-unknown"' +
        tip +
        '><div class="bar-label"><span>' +
        label +
        "</span><span>" +
        escapeHtml(t("common.unknown")) +
        "</span></div></div>"
      );
    }
    return (
      '<div class="bar-row"' +
      tip +
      '><div class="bar-label"><span>' +
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

  function howToReadHtml(openOnly, options) {
    options = options || {};
    var axes = window.MindsetLens.axes.filter(function (axis) {
      if (openOnly === "closed") return !axis.open;
      return openOnly ? axis.open : true;
    });
    var titleKey = openOnly === "closed" ? "guide.closedHowTo" : "guide.howTo";
    var leadKey =
      openOnly === "closed" ? "guide.closedLead" : openOnly ? "guide.lead" : "guide.fullLead";
    var items = axes
      .map(function (axis) {
        return (
          "<li><strong>" +
          escapeHtml(i18n.pick(axis.label)) +
          "</strong> — " +
          escapeHtml(axisHint(axis) || i18n.pick(axis.lowLabel) + " ↔ " + i18n.pick(axis.highLabel)) +
          "</li>"
        );
      })
      .join("");
    var body =
      '<p class="hint">' +
      escapeHtml(t(leadKey)) +
      '</p><ul class="plain-list">' +
      items +
      '</ul><p class="hint">' +
      escapeHtml(t("common.notTest")) +
      "</p>";
    if (options.plain) return body;
    return (
      '<details class="how-to-read"><summary>' +
      escapeHtml(t(titleKey)) +
      "</summary>" +
      body +
      "</details>"
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
  function renderRadar(container, scores, ghost, options) {
    options = options || {};
    var compact = Boolean(options.compact);
    var keys = options.keys || window.MindsetReading.OPEN_KEYS;
    var wide = keys.length > 4;
    var complete = keys.every(function (key) {
      return scores[key] >= 0;
    });
    if (!complete) {
      container.innerHTML = "";
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var cx = compact ? 70 : wide ? 220 : 190;
    var cy = compact ? 70 : wide ? 160 : 155;
    var radius = compact ? 48 : wide ? 86 : 78;
    var ringScales = compact ? [0.5, 1] : [0.25, 0.5, 0.75, 1];
    var rings = ringScales
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
    var ghostShape =
      ghost &&
      keys.every(function (key) {
        return ghost[key] >= 0;
      })
        ? '<polygon class="radar-ghost" points="' +
          keys
            .map(function (key, index) {
              return radarPoint(cx, cy, radius, index, keys.length, ghost[key]).join(",");
            })
            .join(" ") +
          '"></polygon>'
        : "";
    var labels = compact
      ? ""
      : keys
          .map(function (key, index) {
            var angle = -Math.PI / 2 + (Math.PI * 2 * index) / keys.length;
            var cos = Math.cos(angle);
            var sin = Math.sin(angle);
            var gap = wide ? 18 : 42;
            var spot = [cx + cos * (radius + gap), cy + sin * (radius + gap)];
            var anchor = "middle";
            if (cos > 0.35) {
              anchor = "start";
              spot[1] += sin * 4;
            } else if (cos < -0.35) {
              anchor = "end";
              spot[1] += sin * 4;
            } else if (sin < 0) {
              spot[1] -= 4;
            } else {
              spot[1] += 12;
            }
            var axis = axisByKey(key);
            var tip = axisHint(axis);
            var words = String(i18n.pick(axis.label) || "").split(/\s+/);
            var lines = [];
            if (!wide && words.length > 2) {
              var mid = Math.ceil(words.length / 2);
              lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
            } else {
              lines = [words.join(" ")];
            }
            var textBody = lines
              .map(function (line, lineIndex) {
                return (
                  '<tspan x="' +
                  spot[0] +
                  '" dy="' +
                  (lineIndex === 0 ? "0" : "1.15em") +
                  '">' +
                  escapeHtml(line) +
                  "</tspan>"
                );
              })
              .join("");
            return (
              '<text class="radar-label" x="' +
              spot[0] +
              '" y="' +
              spot[1] +
              '" text-anchor="' +
              anchor +
              '">' +
              (tip ? "<title>" + escapeHtml(tip) + "</title>" : "") +
              textBody +
              "</text>"
            );
          })
          .join("");
    var vb = compact ? "0 0 140 140" : wide ? "0 0 440 320" : "0 0 380 330";
    container.innerHTML =
      '<svg class="radar' +
      (compact ? " radar-compact" : "") +
      (wide ? " radar-wide" : "") +
      '" viewBox="' +
      vb +
      '" role="img" aria-label="' +
      escapeHtml(t("common.approx")) +
      '">' +
      rings +
      spokes +
      ghostShape +
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

  function avatar(number, size) {
    return (
      '<span class="avatar' + (size ? " avatar-" + size : "") + '" aria-hidden="true">' + fishGlyph() + "</span>"
    );
  }

  function relativeWhen(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    var minutes = Math.round((Date.now() - date.getTime()) / 60000);
    var format = new Intl.RelativeTimeFormat(i18n.lang, { numeric: "auto" });
    if (minutes < 60) return format.format(-Math.max(0, minutes), "minute");
    if (minutes < 60 * 24) return format.format(-Math.round(minutes / 60), "hour");
    if (minutes < 60 * 24 * 30) return format.format(-Math.round(minutes / 1440), "day");
    return formatWhen(iso);
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

  function plainSummary(doc) {
    var raw = doc.blurb ? String(doc.blurb) : "";
    if (raw) {
      // Drop legacy guillemet quotes from older published blurbs.
      return raw
        .replace(/\s*«[^»]*»\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    var scores = window.MindsetReading.scoresOf(doc);
    return window.MindsetReading.summary(doc.id || doc.number, scores, i18n.lang).replace(/^\d+\.\s*/, "");
  }

  function badgeText(doc) {
    var items = [];
    if (doc && doc.ageBand) items.push(doc.ageBand);
    if (doc && doc.gender) items.push(t("gender." + doc.gender));
    if (doc && doc.country) items.push(i18n.countryName(doc.country));
    return items.join(" · ");
  }

  function isSimOwner(uid) {
    return /^sim[0-9]+$/.test(String(uid || ""));
  }

  function simChip(doc) {
    return doc && isSimOwner(doc.ownerUid) ? t("sim.badge") : "";
  }

  function entryFishClass(doc) {
    var kind = isSimOwner(doc.ownerUid) ? "is-sim" : "is-real";
    var fresh = doc.createdAt && doc.updatedAt && doc.createdAt !== doc.updatedAt ? " is-fresh" : "";
    return "entry-fish " + kind + fresh;
  }

  function showSimHelp(kind) {
    var real = kind === "real";
    var dialog = document.querySelector("#sim-help-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "sim-help-dialog";
      dialog.className = "modal";
      dialog.setAttribute("aria-labelledby", "sim-help-title");
      dialog.innerHTML =
        '<form method="dialog"><h2 id="sim-help-title"></h2><p id="sim-help-body"></p>' +
        '<div class="dialog-actions"><button class="btn btn-primary" value="close"></button></div></form>';
      document.body.appendChild(dialog);
      closeOnBackdrop(dialog);
    }
    dialog.querySelector("#sim-help-title").textContent = t(real ? "entry.humanTitle" : "sim.helpTitle");
    dialog.querySelector("#sim-help-body").textContent = t(real ? "entry.humanBody" : "sim.helpBody");
    dialog.querySelector(".btn-primary").textContent = t("common.close");
    dialog.showModal();
  }

  // Number + mini radar on the left; status fish pinned top-right (no aside column).
  function card(doc, options) {
    options = options || {};
    var id = String(doc.id || "");
    var preview = Boolean(options.preview);
    if (!preview && !/^\d+$/.test(id)) return "";
    var alias = options.alias || "";
    var chip = options.chip || "";
    var side = options.tag || (doc.updatedAt ? relativeWhen(doc.updatedAt) : "");
    var summary = plainSummary(doc);
    var meta = badgeText(doc);
    var foot =
      meta || side
        ? '<span class="entry-foot">' +
          (meta ? '<span class="entry-meta">' + escapeHtml(meta) + "</span>" : "") +
          (side ? '<span class="entry-side">' + escapeHtml(side) + "</span>" : "") +
          "</span>"
        : "";
    var numberLabel = /^\d+$/.test(id) ? id : "";
    var tag = preview ? "div" : "a";
    var open =
      "<" +
      tag +
      ' class="entry"' +
      (preview ? "" : ' href="' + profileHref(doc) + '"') +
      (/^\d+$/.test(id) ? ' data-id="' + escapeHtml(id) + '"' : "") +
      ">";
    return (
      open +
      '<span class="entry-status" aria-hidden="true">' +
      fishGlyph(entryFishClass(doc)) +
      "</span>" +
      (chip ? '<span class="entry-chip">' + escapeHtml(chip) + "</span>" : "") +
      '<span class="entry-id">' +
      (numberLabel
        ? '<span class="entry-id-top">' + mindsetMark(numberLabel, doc.ownerUid, "entry-number") + "</span>"
        : "") +
      '<span class="entry-radar" aria-hidden="true"></span></span>' +
      '<span class="entry-body">' +
      (doc.headline
        ? '<span class="entry-headline">' +
          escapeHtml(String(doc.headline).replace(/\.$/, "")) +
          "</span>"
        : "") +
      (alias ? '<span class="alias">@' + escapeHtml(alias) + "</span>" : "") +
      (summary ? '<span class="entry-summary">' + escapeHtml(summary) + "</span>" : "") +
      foot +
      "</span>" +
      "</" +
      tag +
      ">"
    );
  }

  function hydrateEntryRadars(container, rows) {
    if (!container || !rows || !rows.length) return;
    var byId = {};
    rows.forEach(function (doc) {
      byId[String(doc.id)] = doc;
    });
    container.querySelectorAll(".entry[data-id]").forEach(function (el) {
      var doc = byId[el.getAttribute("data-id")];
      var host = el.querySelector(".entry-radar");
      if (!doc || !host) return;
      renderRadar(host, window.MindsetReading.scoresOf(doc), null, { compact: true });
    });
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
    hydrateEntryRadars(container, rows);
  }

  var DASHES = ["", "5 3", "1.5 2.5", "7 2 1.5 2"];

  // How the four open readings moved across versions; one line style per reading.
  function renderTrend(container, versions, activeIndex) {
    var keys = window.MindsetReading.OPEN_KEYS;
    var width = 320;
    var height = 150;
    var pad = { left: 8, right: 8, top: 10, bottom: 18 };
    var count = versions.length;
    function x(index) {
      return count < 2 ? width / 2 : pad.left + ((width - pad.left - pad.right) * index) / (count - 1);
    }
    function y(value) {
      return pad.top + (height - pad.top - pad.bottom) * (1 - value / 100);
    }
    var lines = keys
      .map(function (key, keyIndex) {
        var points = versions
          .map(function (version, index) {
            var value = version[key];
            return typeof value === "number" && value >= 0 ? x(index).toFixed(1) + "," + y(value).toFixed(1) : null;
          })
          .filter(Boolean);
        if (!points.length) return "";
        return (
          '<polyline class="trend-line" points="' +
          points.join(" ") +
          '"' +
          (DASHES[keyIndex] ? ' stroke-dasharray="' + DASHES[keyIndex] + '"' : "") +
          "></polyline>"
        );
      })
      .join("");
    var marker =
      activeIndex >= 0
        ? '<line class="trend-now" x1="' + x(activeIndex) + '" x2="' + x(activeIndex) + '" y1="' + pad.top + '" y2="' + (height - pad.bottom) + '"></line>'
        : "";
    var legend = keys
      .map(function (key, keyIndex) {
        return (
          '<span class="trend-key"><svg viewBox="0 0 24 6" aria-hidden="true"><line x1="0" y1="3" x2="24" y2="3"' +
          (DASHES[keyIndex] ? ' stroke-dasharray="' + DASHES[keyIndex] + '"' : "") +
          "></line></svg>" +
          escapeHtml(i18n.pick(axisByKey(key).label)) +
          "</span>"
        );
      })
      .join("");
    container.innerHTML =
      '<svg class="trend" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' +
      escapeHtml(t("history.trend")) +
      '"><line class="trend-axis" x1="' + pad.left + '" x2="' + (width - pad.right) + '" y1="' + y(50) + '" y2="' + y(50) + '"></line>' +
      lines +
      marker +
      "</svg>" +
      '<div class="trend-legend">' + legend + "</div>";
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Eases between two score sets and calls draw on every frame.
  function tweenScores(from, to, draw) {
    if (!from || prefersReducedMotion()) {
      draw(to);
      return;
    }
    var start = performance.now();
    var duration = 420;
    function frame(now) {
      var progress = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = {};
      Object.keys(to).forEach(function (key) {
        var a = typeof from[key] === "number" && from[key] >= 0 ? from[key] : to[key];
        var b = to[key];
        current[key] = typeof b === "number" && b >= 0 ? Math.round(a + (b - a) * eased) : b;
      });
      draw(current);
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function textareaControl(field) {
    return (
      '<label class="field" for="' +
      field.key +
      '"><span>' +
      escapeHtml(i18n.pick(field.label)) +
      (field.plain ? ' <em class="field-plain">' + escapeHtml(i18n.pick(field.plain)) + "</em>" : "") +
      '</span><textarea id="' +
      field.key +
      '" name="' +
      field.key +
      '" rows="' +
      field.rows +
      '" maxlength="1200" placeholder="' +
      escapeHtml(i18n.pick(field.placeholder)) +
      '" aria-describedby="leak-' +
      field.key +
      '"></textarea><small data-count-for="' +
      field.key +
      '">0 / 1200</small><span class="leak" id="leak-' +
      field.key +
      '" role="status" hidden></span></label>'
    );
  }

  // Marks fields that could identify someone; copy lives in the wizard status strip.
  function renderLeaks(form, findingsByField) {
    window.MindsetLens.fields.forEach(function (field) {
      var node = form.querySelector("#leak-" + field.key);
      var input = form.querySelector("#" + field.key);
      if (!node) return;
      var findings = findingsByField[field.key] || [];
      var blocking = findings.some(function (item) {
        return item.severity === "block";
      });
      node.hidden = true;
      node.textContent = "";
      node.className = "leak" + (blocking ? " is-block" : "");
      if (input) input.setAttribute("aria-invalid", String(blocking));
    });
  }

  // One line for the actions strip: blocks beat warns; kinds are de-duplicated.
  function leakStatus(findingsByField) {
    var all = [];
    var blocking = false;
    Object.keys(findingsByField || {}).forEach(function (key) {
      (findingsByField[key] || []).forEach(function (item) {
        all.push(item);
        if (item.severity === "block") blocking = true;
      });
    });
    if (!all.length) return null;
    var kinds = all
      .map(function (item) {
        return t("privacy." + item.kind);
      })
      .filter(function (label, index, list) {
        return list.indexOf(label) === index;
      });
    return {
      message: t(blocking ? "privacy.block" : "privacy.warn", { what: kinds.join(", ") }),
      kind: blocking ? "error" : "warn"
    };
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

  // Asks which hidden side to show; resolves with the field key or null.
  function pickClosedField(options) {
    return new Promise(function (resolve) {
      var fields = window.MindsetLens.fields.filter(function (field) {
        return !field.open && options.privateDoc && options.privateDoc[field.key];
      });
      var dialog = document.createElement("dialog");
      dialog.className = "modal";
      var choices = fields.length
        ? '<fieldset class="choices"><legend class="visually-hidden">' +
          escapeHtml(t("profile.pick")) +
          "</legend>" +
          fields
            .map(function (field, index) {
              var text = String(options.privateDoc[field.key]);
              if (text.length > 140) text = text.slice(0, 137) + "…";
              return (
                '<label class="pick"><input type="radio" name="field" value="' +
                field.key +
                '"' +
                (index === 0 ? " checked" : "") +
                " /> <span><strong>" +
                escapeHtml(i18n.pick(field.label)) +
                '</strong><small class="hint">' +
                escapeHtml(text) +
                "</small></span></label>"
              );
            })
            .join("") +
          "</fieldset>"
        : '<p class="empty">' + escapeHtml(t("profile.noClosed")) + "</p>";
      dialog.innerHTML =
        '<form method="dialog"><h2>' +
        escapeHtml(options.title) +
        '</h2><p class="hint">' +
        escapeHtml(options.hint) +
        "</p>" +
        choices +
        '<div class="dialog-actions"><button class="btn" value="cancel">' +
        escapeHtml(t("common.cancel")) +
        "</button>" +
        (fields.length
          ? '<button class="btn btn-primary" value="confirm">' + escapeHtml(options.action) + "</button>"
          : "") +
        "</div></form>";
      document.body.appendChild(dialog);
      closeOnBackdrop(dialog);
      dialog.addEventListener("close", function () {
        var checked = dialog.querySelector('input[name="field"]:checked');
        var value = dialog.returnValue === "confirm" && checked ? checked.value : null;
        dialog.remove();
        resolve(value);
      });
      dialog.showModal();
    });
  }

  function loginHref() {
    return "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search);
  }

  function closeOnBackdrop(dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close("cancel");
    });
  }

  function pageLoadingEl() {
    return document.querySelector("#page-loading");
  }

  function placePageLoading() {
    var el = pageLoadingEl();
    if (!el) return;
    if (!document.body.classList.contains("is-page-loading")) {
      el.style.top = "";
      el.style.bottom = "";
      return;
    }
    var top = 0;
    var site = document.querySelector("header.top");
    if (site) top = site.getBoundingClientRect().bottom;
    document.querySelectorAll(".page-chrome, .head").forEach(function (node) {
      if (node.closest("[hidden]")) return;
      var style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return;
      var edge = node.getBoundingClientRect().bottom;
      if (edge > top) top = edge;
    });
    var bottom = 0;
    var bar = document.querySelector("#gamebar");
    if (bar && !bar.hidden) {
      bottom = Math.max(0, window.innerHeight - bar.getBoundingClientRect().top);
    }
    el.style.top = Math.max(0, Math.round(top)) + "px";
    el.style.bottom = Math.max(0, Math.round(bottom)) + "px";
  }

  function beginPageLoad() {
    document.body.classList.add("is-page-loading");
    // Reveal shell so the logo gate can fill page content under site chrome.
    ["#gated", "#profile"].forEach(function (sel) {
      var shell = document.querySelector(sel);
      if (shell) shell.hidden = false;
    });
    var el = pageLoadingEl();
    if (el) {
      el.hidden = false;
      el.setAttribute("aria-busy", "true");
    }
    placePageLoading();
  }

  async function endPageLoad() {
    await new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
    var el = pageLoadingEl();
    if (el) {
      el.hidden = true;
      el.setAttribute("aria-busy", "false");
    }
    document.body.classList.remove("is-page-loading");
    placePageLoading();
  }

  function mindsetMarkStatic(number, ownerUid, extraClass) {
    var sim = isSimOwner(ownerUid);
    var cls =
      "mindset-id mindset-id-static" +
      (sim ? " is-sim" : "") +
      (extraClass ? " " + extraClass : "");
    return '<span class="' + cls + '" aria-hidden="true">' + escapeHtml(String(number)) + "</span>";
  }

  function mindsetMark(number, ownerUid, extraClass) {
    var sim = isSimOwner(ownerUid);
    var cls = "mindset-id" + (extraClass ? " " + extraClass : "");
    return (
      '<span class="' +
      cls +
      '" role="button" tabindex="0" data-kind-help="' +
      (sim ? "sim" : "real") +
      '" aria-label="' +
      escapeHtml(t(sim ? "sim.helpTitle" : "entry.humanTitle")) +
      '"><span class="entry-sim' +
      (sim ? "" : " entry-real") +
      '">' +
      escapeHtml(t(sim ? "sim.badge" : "entry.real")) +
      "</span>" +
      escapeHtml(String(number)) +
      "</span>"
    );
  }

  // Page h1: mindset number, then an optional header — no dash between.
  function mindsetIdTitle(number, header, ownerUid, plain) {
    var id = plain ? mindsetMarkStatic(number, ownerUid) : mindsetMark(number, ownerUid);
    return header ? id + " " + escapeHtml(String(header)) : id;
  }

  // Owner chrome shared by me / lake / school / current: title, meta, tool icons.
  function paintOwnerHeader(opts) {
    opts = opts || {};
    var doc = opts.doc;
    if (!doc) return;
    var number = doc.id;
    var title = document.querySelector("#title");
    if (title) title.innerHTML = mindsetIdTitle(number, opts.header || "", doc.ownerUid, opts.plainMark);
    // Keep breadcrumb / document title as the page name (Ben, Göl, …), not the mindset id.
    if (opts.setCrumb !== false && opts.header) setCrumb(opts.header);

    var aliasLine = document.querySelector("#alias-line");
    if (aliasLine && opts.alias !== undefined) {
      var alias = opts.alias || "";
      aliasLine.textContent = alias ? "@" + alias : t("alias.missing");
      aliasLine.classList.toggle("is-missing", !alias);
    }

    var meta = document.querySelector("#meta");
    if (meta) {
      var when = formatWhen(doc.updatedAt);
      meta.textContent =
        t(doc.published ? "me.published" : "me.unpublished") + (when ? " · " + when : "");
    }

    var share = document.querySelector("#share");
    var edit = document.querySelector("#edit");
    var profileLink = document.querySelector("#profile-link");
    if (share) {
      share.innerHTML = icon("share");
      share.hidden = false;
    }
    if (edit) {
      edit.innerHTML = icon("edit");
      edit.href = "/new";
      edit.hidden = false;
    }
    if (profileLink) {
      profileLink.innerHTML = icon("preview");
      profileLink.href = "/i/" + number;
      profileLink.hidden = false;
    }
  }

  function clearOwnerHeader(pageTitle) {
    var title = document.querySelector("#title");
    if (title) title.textContent = pageTitle || "";
    var aliasLine = document.querySelector("#alias-line");
    if (aliasLine) {
      aliasLine.textContent = "";
      aliasLine.classList.remove("is-missing");
    }
    var meta = document.querySelector("#meta");
    if (meta) meta.textContent = "";
    ["#share", "#edit", "#profile-link"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.hidden = true;
    });
  }

  function shareMindset(doc, statusEl) {
    if (!doc) return;
    var url = window.location.origin + "/i/" + doc.id;
    var title = (doc.headline || t("common.mindset", { n: doc.id })) + titleSuffix();
    if (navigator.share) {
      navigator.share({ title: title, text: title, url: url }).catch(function (error) {
        if (error && error.name === "AbortError") return;
        setStatus(statusEl, t("profile.shareFailed"), "error");
      });
      return;
    }
    navigator.clipboard.writeText(url).then(
      function () {
        setStatus(statusEl, t("profile.copied"));
      },
      function () {
        setStatus(statusEl, url);
      }
    );
  }

  function bindHeaderTabs() {
    var stick = document.querySelector(".profile-stick");
    if (!stick) return;
    var list = stick.querySelector("[role='tablist']");
    if (!list) return;
    var tabs = [].slice.call(list.querySelectorAll("[role='tab']"));
    if (tabs.length < 2) return;
    var panes = tabs.map(function (tab) {
      var id = tab.getAttribute("aria-controls");
      return id ? document.getElementById(id) : null;
    });

    function slug(tab) {
      var id = tab.id || "";
      return id.indexOf("tab-") === 0 ? id.slice(4) : id;
    }

    function tabFromHash() {
      var hash = "";
      try {
        hash = decodeURIComponent((location.hash || "").replace(/^#/, ""));
      } catch (error) {
        hash = "";
      }
      if (!hash) return null;
      for (var i = 0; i < tabs.length; i++) {
        if (slug(tabs[i]) === hash) return tabs[i];
      }
      return null;
    }

    function writeHash(tab) {
      var name = slug(tab);
      if (!name) return;
      var next = "#" + name;
      if (location.hash === next) return;
      history.replaceState(null, "", next);
    }

    var suppressMotion = true;
    var fromSwipe = false;
    var pending = null;
    var finishSlide = null;

    function selectedTab() {
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].getAttribute("aria-selected") === "true") return tabs[i];
      }
      return null;
    }

    function revealTab(tab, keepFocus) {
      if (!keepFocus && document.activeElement && list.contains(document.activeElement) && document.activeElement.blur) {
        document.activeElement.blur();
      }
      var fade = list.closest(".profile-tabs-bar") ? 28 : 0;
      var tabRect = tab.getBoundingClientRect();
      var listRect = list.getBoundingClientRect();
      var target = list.scrollLeft;
      if (tabRect.left < listRect.left) target += tabRect.left - listRect.left;
      else if (tabRect.right > listRect.right - fade) target += tabRect.right - (listRect.right - fade);
      target = Math.max(0, target);
      if (Math.abs(target - list.scrollLeft) < 1) return;
      list.scrollTo({ left: target, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }

    function clearPin(pane) {
      pane.classList.remove("tab-slide-pin");
      pane.style.top = "";
      pane.style.left = "";
      pane.style.width = "";
      pane.style.transform = "";
      pane.style.transition = "";
    }

    function lockScroll() {
      var y = window.scrollY;
      function hold() {
        if (window.scrollY !== y) window.scrollTo(0, y);
      }
      window.addEventListener("scroll", hold);
      return function unlock() {
        window.removeEventListener("scroll", hold);
        if (window.scrollY !== y) window.scrollTo(0, y);
      };
    }

    function scrollContentToTop(pane) {
      if (!pane) return;
      var bar = stick.getBoundingClientRect().height;
      var y = pane.getBoundingClientRect().top + window.scrollY - bar;
      window.scrollTo(0, y < 0 ? 0 : y);
    }

    function slidePanes(outgoing, incoming, dir, box) {
      if (finishSlide) finishSlide();
      scrollContentToTop(incoming);
      var frame = incoming.getBoundingClientRect();
      if (frame.width) box = frame;
      var unlockScroll = lockScroll();
      outgoing.hidden = false;
      var hold = Math.max(outgoing.offsetHeight, incoming.offsetHeight);
      var spacer = document.createElement("div");
      spacer.style.height = hold + "px";
      incoming.parentNode.insertBefore(spacer, incoming);
      var outgoingMark = document.createComment("");
      outgoing.parentNode.insertBefore(outgoingMark, outgoing);
      var clip = document.createElement("div");
      clip.className = "tab-slide-clip";
      clip.style.top = box.top + "px";
      clip.style.left = box.left + "px";
      clip.style.width = box.width + "px";
      clip.style.height = Math.max(0, window.innerHeight - box.top) + "px";
      document.body.appendChild(clip);
      clip.appendChild(outgoing);
      clip.appendChild(incoming);
      function pin(pane, shift) {
        pane.classList.add("tab-slide-pin");
        pane.style.transition = "none";
        pane.style.transform = "translateX(" + shift + ")";
      }
      var enterFrom = dir > 0 ? "100%" : "-100%";
      var leaveTo = dir > 0 ? "-100%" : "100%";
      pin(outgoing, "0%");
      pin(incoming, enterFrom);
      incoming.getBoundingClientRect();
      var settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        finishSlide = null;
        var outgoingTab = tabs[panes.indexOf(outgoing)];
        if (!outgoingTab || outgoingTab.getAttribute("aria-selected") !== "true") outgoing.hidden = true;
        clearPin(outgoing);
        clearPin(incoming);
        if (outgoingMark.parentNode) {
          outgoingMark.parentNode.insertBefore(outgoing, outgoingMark);
          outgoingMark.parentNode.removeChild(outgoingMark);
        }
        if (spacer.parentNode) {
          spacer.parentNode.insertBefore(incoming, spacer);
          spacer.parentNode.removeChild(spacer);
        }
        if (clip.parentNode) clip.parentNode.removeChild(clip);
        unlockScroll();
      }
      finishSlide = finish;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (settled) return;
          outgoing.style.transition = "";
          incoming.style.transition = "";
          outgoing.style.transform = "translateX(" + leaveTo + ")";
          incoming.style.transform = "translateX(0)";
        });
      });
      var timer = setTimeout(finish, 500);
      incoming.addEventListener("transitionend", function onEnd(event) {
        if (event.target !== incoming || event.propertyName !== "transform") return;
        incoming.removeEventListener("transitionend", onEnd);
        clearTimeout(timer);
        finish();
      });
    }

    list.addEventListener(
      "click",
      function (event) {
        var tab = event.target.closest("[role='tab']");
        if (!tab || !list.contains(tab)) return;
        var from = selectedTab();
        var outgoing = from ? document.getElementById(from.getAttribute("aria-controls")) : null;
        var box = outgoing ? outgoing.getBoundingClientRect() : null;
        var dir = tabs.indexOf(tab) >= tabs.indexOf(from) ? 1 : -1;
        pending = {
          tab: tab,
          outgoing: outgoing,
          box: box,
          dir: dir,
          swipe: fromSwipe,
          skip: suppressMotion || prefersReducedMotion() || !outgoing || from === tab
        };
        writeHash(tab);
      },
      true
    );

    window.addEventListener("click", function () {
      if (!pending) return;
      var job = pending;
      pending = null;
      revealTab(job.tab, !job.swipe);
      if (!job.swipe) job.tab.focus({ preventScroll: true });
      var incoming = document.getElementById(job.tab.getAttribute("aria-controls"));
      if (job.skip) {
        if (!suppressMotion && incoming && incoming !== job.outgoing) scrollContentToTop(incoming);
        return;
      }
      if (!incoming || incoming === job.outgoing || !job.box) return;
      slidePanes(job.outgoing, incoming, job.dir, job.box);
    });

    window.addEventListener("hashchange", function () {
      var tab = tabFromHash();
      if (!tab || tab.hidden || tab.getAttribute("aria-selected") === "true") return;
      tab.click();
    });

    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(function () {
        var tab = tabFromHash();
        if (tab && !tab.hidden && tab.getAttribute("aria-selected") !== "true") tab.click();
        suppressMotion = false;
      }, 0);
    });

    var gesture = null;

    function paneOf(node) {
      var el = node && node.nodeType === 1 ? node : node && node.parentElement;
      while (el && el !== document.body) {
        if (panes.indexOf(el) !== -1) return el;
        el = el.parentElement;
      }
      return null;
    }

    document.addEventListener(
      "touchstart",
      function (event) {
        gesture = null;
        if (event.touches.length !== 1) return;
        if (document.querySelector("dialog[open]")) return;
        var target = event.target;
        if (target.closest && target.closest(".reading-slides, input, textarea, select")) return;
        var pane = paneOf(target);
        if (!pane || pane.hidden) return;
        var touch = event.touches[0];
        gesture = { x: touch.clientX, y: touch.clientY, target: target, time: Date.now() };
      },
      { passive: true }
    );

    document.addEventListener(
      "touchmove",
      function (event) {
        if (!gesture || !event.touches[0]) return;
        var dx = event.touches[0].clientX - gesture.x;
        var dy = event.touches[0].clientY - gesture.y;
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          event.preventDefault();
          gesture.axis = "x";
          return;
        }
        gesture = null;
      },
      { passive: false }
    );

    document.addEventListener(
      "touchcancel",
      function () {
        gesture = null;
      },
      { passive: true }
    );

    document.addEventListener(
      "touchend",
      function (event) {
        if (!gesture) return;
        var start = gesture;
        gesture = null;
        var touch = event.changedTouches && event.changedTouches[0];
        if (!touch) return;
        var dx = touch.clientX - start.x;
        var dy = touch.clientY - start.y;
        if (Date.now() - start.time > 420) return;
        if (start.target.closest && start.target.closest("#lake") && document.querySelector("#lake").getAttribute("data-panned") === "1") return;
        if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        var index = 0;
        tabs.forEach(function (tab, i) {
          if (tab.getAttribute("aria-selected") === "true") index = i;
        });
        var next = tabs[index + (dx < 0 ? 1 : -1)];
        if (!next || next.hidden) return;
        fromSwipe = true;
        next.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        fromSwipe = false;
      },
      { passive: true }
    );
  }

  window.MindsetUi = {
    escapeHtml: escapeHtml,
    fieldLabel: fieldLabel,
    fieldByKey: fieldByKey,
    icon: icon,
    iconNames: iconNames,
    mindsetMark: mindsetMark,
    mindsetMarkStatic: mindsetMarkStatic,
    mindsetIdTitle: mindsetIdTitle,
    paintOwnerHeader: paintOwnerHeader,
    clearOwnerHeader: clearOwnerHeader,
    shareMindset: shareMindset,
    fishGlyph: fishGlyph,
    fishMark: fishMark,
    FISH_PATH: FISH_PATH,
    isSimOwner: isSimOwner,
    simChip: simChip,
    showSimHelp: showSimHelp,
    formatWhen: formatWhen,
    relativeWhen: relativeWhen,
    plainSummary: plainSummary,
    badgeText: badgeText,
    renderTrend: renderTrend,
    tweenScores: tweenScores,
    prefersReducedMotion: prefersReducedMotion,
    errorText: errorText,
    setStatus: setStatus,
    axisByKey: axisByKey,
    renderBars: renderBars,
    renderRadar: renderRadar,
    howToReadHtml: howToReadHtml,
    axisHint: axisHint,
    renderOpenTexts: renderOpenTexts,
    avatar: avatar,
    badges: badges,
    card: card,
    renderCards: renderCards,
    hydrateEntryRadars: hydrateEntryRadars,
    renderForm: renderForm,
    renderLeaks: renderLeaks,
    leakStatus: leakStatus,
    renderDemoForm: renderDemoForm,
    demoOptions: demoOptions,
    collectDemo: collectDemo,
    fillDemo: fillDemo,
    collectTexts: collectTexts,
    fillTexts: fillTexts,
    updateCount: updateCount,
    loginHref: loginHref,
    closeOnBackdrop: closeOnBackdrop,
    beginPageLoad: beginPageLoad,
    endPageLoad: endPageLoad,
    pickClosedField: pickClosedField,
    setCrumb: setCrumb,
    requireAuth: requireAuth,
    titleSuffix: titleSuffix,
    brandLabel: brandLabel
  };

  mountShell();
  bindHeaderTabs();
})();

(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var math = window.MindsetReading;
  var i18n = window.MindsetI18n;
  var t = i18n.t;

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var aliasStatus = document.querySelector("#alias-status");
    var historyStatus = document.querySelector("#history-status");
    var aliasForm = document.querySelector("#alias-form");
    var aliasInput = document.querySelector("#alias");
    var aliasLine = document.querySelector("#alias-line");
    var dialog = document.querySelector("#delete-dialog");
    var howDialog = document.querySelector("#how-to-read-dialog");
    var session = null;
    var current = null;
    var currentAlias = "";
    var pendingDelete = "";

    ui.closeOnBackdrop(dialog);
    ui.closeOnBackdrop(howDialog);

    document.querySelector("#share").innerHTML = ui.icon("share");
    document.querySelector("#edit").innerHTML = ui.icon("edit");
    document.querySelector("#profile-link").innerHTML = ui.icon("preview");
    document.querySelector("#share").addEventListener("click", function () {
      if (!current) return;
      ui.shareMindset(current.publicDoc, status);
    });

    function renderClosedTexts(privateDoc) {
      document.querySelector("#closed-texts").innerHTML = window.MindsetLens.fields
        .filter(function (field) {
          return !field.open;
        })
        .map(function (field) {
          var value = (privateDoc && privateDoc[field.key]) || "";
          return (
            '<article class="post"><h3>' +
            ui.escapeHtml(i18n.pick(field.label)) +
            "</h3><p>" +
            (value ? ui.escapeHtml(value) : '<span class="hint">' + ui.escapeHtml(t("me.notWritten")) + "</span>") +
            "</p></article>"
          );
        })
        .join("");
    }

    function paintEntry(doc, scores) {
      var host = document.querySelector("#me-entry");
      host.innerHTML = ui.card(doc, { preview: true });
      var built = host.querySelector(".entry");
      if (built) {
        host.className = built.className;
        host.innerHTML = built.innerHTML;
        host.setAttribute("data-id", String(doc.id));
      }
      host.hidden = false;
      var radarHost = host.querySelector(".entry-radar");
      if (radarHost) ui.renderRadar(radarHost, scores, null, { compact: true });
    }

    function radarKeys() {
      return math.OPEN_KEYS.concat(math.CLOSED_KEYS);
    }

    // Match renderRadar: the chart only draws when every axis score is known.
    function hasRadarData(scores) {
      return radarKeys().every(function (key) {
        return typeof scores[key] === "number" && scores[key] >= 0;
      });
    }

    function syncRadarTab(scores) {
      var tab = document.querySelector("#tab-me-radar");
      var pane = document.querySelector("#pane-me-radar");
      var show = hasRadarData(scores);
      tab.hidden = !show;
      if (!show) {
        pane.hidden = true;
        if (tab.getAttribute("aria-selected") === "true") selectMeTab("open");
      } else {
        tab.hidden = false;
      }
    }

    function selectMeSection(name) {
      var panes = {
        preview: document.querySelector("#pane-me-preview"),
        school: document.querySelector("#pane-me-school"),
        current: document.querySelector("#pane-me-current"),
        prefs: document.querySelector("#pane-me-prefs")
      };
      var tabs = {
        preview: document.querySelector("#tab-me-preview"),
        school: document.querySelector("#tab-me-school"),
        current: document.querySelector("#tab-me-current"),
        prefs: document.querySelector("#tab-me-prefs")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        panes[key].hidden = !on;
        tabs[key].setAttribute("aria-selected", String(on));
      });
    }

    function selectMeTab(name) {
      var panes = {
        radar: document.querySelector("#pane-me-radar"),
        open: document.querySelector("#pane-me-open"),
        closed: document.querySelector("#pane-me-closed")
      };
      var tabs = {
        radar: document.querySelector("#tab-me-radar"),
        open: document.querySelector("#tab-me-open"),
        closed: document.querySelector("#tab-me-closed")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        panes[key].hidden = !on;
        tabs[key].setAttribute("aria-selected", String(on));
      });
    }

    function render(own) {
      current = own;
      document.querySelector("#empty").hidden = Boolean(own);
      document.querySelector("#owner").hidden = !own;
      document.querySelector("#page-header").hidden = !own;
      document.querySelector("#delete").hidden = !own;
      if (!own) return;
      var doc = own.publicDoc;
      ui.paintOwnerHeader({ doc: doc, header: t("me.title") });
      var scores = math.scoresOf(doc);
      var closed = math.scoresOf(own.privateDoc);
      math.CLOSED_KEYS.forEach(function (key) {
        scores[key] = closed[key];
      });
      paintEntry(doc, scores);
      syncRadarTab(scores);
      if (hasRadarData(scores)) {
        ui.renderRadar(document.querySelector("#me-radar"), scores, null, {
          keys: radarKeys()
        });
      } else {
        document.querySelector("#me-radar").innerHTML = "";
      }
      ui.renderBars(document.querySelector("#me-open"), scores, math.OPEN_KEYS);
      ui.renderBars(document.querySelector("#me-closed"), scores, math.CLOSED_KEYS);
      renderClosedTexts(own.privateDoc);
      var level = math.historyLevel(doc.history);
      document.querySelector('input[name="history"][value="' + level + '"]').checked = true;
    }

    function renderAlias(alias) {
      currentAlias = alias || "";
      aliasInput.value = currentAlias;
      aliasLine.textContent = currentAlias ? "@" + currentAlias : t("alias.missing");
      aliasLine.classList.toggle("is-missing", !currentAlias);
      if (!currentAlias) ui.setStatus(aliasStatus, t("alias.required"), "error");
    }

    async function renderCounts() {
      var results = await Promise.all([
        social.incoming(session).catch(function () { return []; }),
        social.members(session).catch(function () { return []; }),
        social.tailersOf(session).catch(function () { return []; }),
        social.trailOf(session).catch(function () { return []; })
      ]);
      var incoming = results[0].length;
      document.querySelector("#school-count").textContent =
        String(results[1].length) + (incoming ? " · " + t("me.requests", { n: incoming }) : "");
      document.querySelector("#current-count").textContent = t("me.currentCount", {
        a: results[2].length,
        b: results[3].length
      });
    }

    async function load(notice) {
      ui.beginPageLoad();
      ui.setStatus(status, "");
      try {
        session = await ui.requireAuth();
        if (!session) {
          document.querySelector("#account").hidden = true;
          document.querySelector("#page-header").hidden = true;
          return;
        }
        document.querySelector("#account").hidden = false;
        document.querySelector("#email").textContent = t("me.signedInAs", { email: session.email });
        var own = await store.findOwn(session.uid, session.idToken);
        render(own);
        if (own) {
          var entry = await social.aliasOf(own.publicDoc.id, session.idToken);
          renderAlias(entry && entry.alias);
          await renderCounts();
          document.querySelector("#root-link").hidden = own.publicDoc.number !== 1;
          store.ensureFirstVersion(own.publicDoc, session.idToken).catch(function () {});
        }
        ui.setStatus(status, notice ? t(notice) : "", notice ? "error" : "");
      } finally {
        await ui.endPageLoad();
      }
    }

    function fail(error) {
      ui.setStatus(status, ui.errorText(error), "error");
    }

    document.querySelector(".me-stick .depth-tabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-me-section]");
      if (!tab) return;
      selectMeSection(tab.getAttribute("data-me-section"));
    });

    document.querySelector(".preview-toolbar .depth-tabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-me-tab]");
      if (!tab) return;
      selectMeTab(tab.getAttribute("data-me-tab"));
    });

    document.querySelector("#how-to-read").addEventListener("click", function () {
      document.querySelector("#how-to-read-body").innerHTML = ui.howToReadHtml(false, { plain: true });
      howDialog.showModal();
    });

    aliasForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!current) return;
      ui.setStatus(aliasStatus, t("common.saving"));
      social
        .setAlias(session, current.publicDoc.id, aliasInput.value, currentAlias)
        .then(function (saved) {
          renderAlias(saved);
          ui.setStatus(aliasStatus, t("me.aliasSaved"));
        })
        .catch(function (error) {
          ui.setStatus(aliasStatus, ui.errorText(error), "error");
        });
    });

    document.querySelector("#history-choices").addEventListener("change", function (event) {
      if (!current || event.target.name !== "history") return;
      ui.setStatus(historyStatus, t("common.saving"));
      store
        .setHistory(session, event.target.value)
        .then(function (level) {
          current.publicDoc.history = level;
          ui.setStatus(historyStatus, t("history.saved." + level));
        })
        .catch(function (error) {
          ui.setStatus(historyStatus, ui.errorText(error), "error");
        });
    });

    document.querySelector("#sign-out").addEventListener("click", function () {
      window.MindsetAuth.signOut().then(function () {
        window.location.assign("/");
      });
    });

    function askDelete(kind) {
      pendingDelete = kind;
      var number = current ? current.publicDoc.id : "";
      document.querySelector("#delete-title").textContent = t(kind === "account" ? "me.deleteAccount" : "me.deleteMindset");
      document.querySelector("#delete-copy").textContent =
        kind === "account" ? t("me.deleteAccountCopy") : t("me.deleteMindsetCopy", { n: number });
      dialog.showModal();
    }

    document.querySelector("#delete").addEventListener("click", function () {
      askDelete("mindset");
    });
    document.querySelector("#delete-account").addEventListener("click", function () {
      askDelete("account");
    });

    dialog.addEventListener("close", function () {
      if (dialog.returnValue !== "confirm") return;
      ui.setStatus(status, t("me.deleting"));
      store
        .requireSession()
        .then(function (fresh) {
          session = fresh;
          return store.remove(session);
        })
        .then(function () {
          if (pendingDelete !== "account") return null;
          return window.MindsetAuth.deleteAccount();
        })
        .then(function () {
          window.location.assign("/");
        })
        .catch(function (error) {
          if (error && error.code === "auth/requires-recent-login") {
            ui.setStatus(status, t("me.recentLogin"), "error");
            return;
          }
          fail(error);
        });
    });

    load().catch(fail);
  });
})();

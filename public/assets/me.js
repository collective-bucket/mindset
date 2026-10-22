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
    var versions = [];
    var range = document.querySelector("#timeline-range");
    var versionDrawer = document.querySelector("#version-drawer");
    var versionList = document.querySelector("#version-list");
    var versionManage = document.querySelector("#version-manage");
    var deletingVersion = false;
    var openView = "radar";
    var closedView = "radar";

    ui.closeOnBackdrop(dialog);
    ui.closeOnBackdrop(howDialog);

    document.querySelector("#share").innerHTML = ui.icon("share");
    document.querySelector("#edit").innerHTML = ui.icon("edit");
    document.querySelector("#profile-link").innerHTML = ui.icon("preview");
    versionManage.innerHTML = ui.icon("manage");
    document.querySelectorAll("#me-preview-body .reading-switch [data-view='radar']").forEach(function (button) {
      button.innerHTML = ui.icon("radar");
    });
    document.querySelectorAll("#me-preview-body .reading-switch [data-view='bars']").forEach(function (button) {
      button.innerHTML = ui.icon("bars");
    });
    document.querySelector("#share").addEventListener("click", function () {
      if (!current) return;
      ui.shareMindset(current.publicDoc, status);
    });

    function renderTexts(container, doc, open) {
      container.innerHTML = window.MindsetLens.fields
        .filter(function (field) {
          return Boolean(field.open) === open;
        })
        .map(function (field) {
          var value = (doc && doc[field.key]) || "";
          var plain = field.plain ? i18n.pick(field.plain) : "";
          return (
            '<article class="post"><h3>' +
            ui.escapeHtml(i18n.pick(field.label)) +
            "</h3>" +
            (plain ? '<p class="field-plain">' + ui.escapeHtml(plain) + "</p>" : "") +
            "<p>" +
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

    function hasScores(scores, keys) {
      return keys.every(function (key) {
        return typeof scores[key] === "number" && scores[key] >= 0;
      });
    }

    function showReadingView(stage, name) {
      function viewOpen(viewName) {
        var button = stage.querySelector('.reading-switch [data-view="' + viewName + '"]');
        var panel = stage.querySelector('.reading-view[data-view="' + viewName + '"]');
        return Boolean(button && panel && !button.hidden);
      }
      var chosen = viewOpen(name) ? name : viewOpen("radar") ? "radar" : "bars";
      stage.querySelectorAll(".reading-switch [data-view]").forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.getAttribute("data-view") === chosen));
      });
      stage.querySelectorAll(".reading-view").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-view") !== chosen;
      });
      return chosen;
    }

    function paintStage(stage, radarId, barsId, scores, radarKeys, barKeys, view) {
      var ready = hasScores(scores, radarKeys);
      stage.querySelector('[data-view="radar"]').hidden = !ready;
      var radarHost = document.querySelector(radarId);
      if (ready) ui.renderRadar(radarHost, scores, null, { keys: radarKeys });
      else radarHost.innerHTML = "";
      ui.renderBars(document.querySelector(barsId), scores, barKeys);
      return showReadingView(stage, view);
    }

    function selectMeTab(name) {
      var panes = {
        open: document.querySelector("#pane-me-open"),
        closed: document.querySelector("#pane-me-closed")
      };
      var tabs = {
        open: document.querySelector("#tab-me-open"),
        closed: document.querySelector("#tab-me-closed")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        panes[key].hidden = !on;
        tabs[key].setAttribute("aria-selected", String(on));
      });
    }

    function selectMeSection(name) {
      var panes = {
        preview: document.querySelector("#pane-me-preview"),
        prefs: document.querySelector("#pane-me-prefs")
      };
      var tabs = {
        preview: document.querySelector("#tab-me-preview"),
        prefs: document.querySelector("#tab-me-prefs")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        panes[key].hidden = !on;
        tabs[key].setAttribute("aria-selected", String(on));
      });
    }

    function mixedScores(source) {
      var scores = math.scoresOf(source);
      var closed = math.scoresOf(current.privateDoc);
      math.CLOSED_KEYS.forEach(function (key) {
        scores[key] = closed[key];
      });
      return scores;
    }

    function paintPreview(source) {
      var scores = mixedScores(source);
      var cardDoc = source;
      if (source !== current.publicDoc) {
        cardDoc = Object.assign({}, source, {
          id: current.publicDoc.id,
          updatedAt: source.createdAt || current.publicDoc.updatedAt
        });
      }
      paintEntry(cardDoc, scores);
      openView = paintStage(
        document.querySelector("#me-open-stage"),
        "#me-open-radar",
        "#me-open-bars",
        scores,
        math.OPEN_KEYS,
        math.OPEN_KEYS,
        openView
      );
      closedView = paintStage(
        document.querySelector("#me-closed-stage"),
        "#me-closed-radar",
        "#me-closed-bars",
        scores,
        math.OPEN_KEYS.concat(math.CLOSED_KEYS),
        math.CLOSED_KEYS,
        closedView
      );
      renderTexts(document.querySelector("#open-texts"), source, true);
      renderTexts(document.querySelector("#closed-texts"), current.privateDoc, false);
    }

    function syncVersionManage() {
      versionManage.hidden = Boolean(session && session.actingAs);
    }

    function markVersionRow() {
      var currentIndex = String(range.value);
      versionList.querySelectorAll(".version-row").forEach(function (row) {
        row.classList.toggle("is-active", row.getAttribute("data-version-index") === currentIndex);
      });
    }

    function renderVersionList() {
      var currentIndex = Number(range.value);
      var html = "";
      for (var index = versions.length - 1; index >= 0; index -= 1) {
        var version = versions[index];
        html +=
          '<div class="version-row' +
          (index === currentIndex ? " is-active" : "") +
          '" data-version-index="' +
          index +
          '"><button type="button" class="version-open" data-version-view="' +
          index +
          '">' +
          ui.escapeHtml(ui.formatWhen(version.createdAt)) +
          '</button><button type="button" class="btn-icon version-delete" data-version-delete="' +
          ui.escapeHtml(version.id) +
          '" aria-label="' +
          ui.escapeHtml(t("me.delete")) +
          '">' +
          ui.icon("trash") +
          "</button></div>";
      }
      versionList.innerHTML = html;
    }

    function setDrawer(open) {
      versionDrawer.classList.toggle("is-open", open);
      versionManage.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) versionDrawer.removeAttribute("inert");
      else versionDrawer.setAttribute("inert", "");
      if (open) renderVersionList();
    }

    function showMeVersion(index) {
      var last = index === versions.length - 1;
      var source = last ? current.publicDoc : versions[index];
      var when = document.querySelector("#timeline-when");
      when.textContent = last ? t("history.now") : ui.formatWhen(versions[index].createdAt);
      document.querySelector("#timeline-count").textContent = t("history.position", {
        i: index + 1,
        n: versions.length
      });
      range.value = String(index);
      range.setAttribute("aria-valuetext", when.textContent);
      paintPreview(source);
      markVersionRow();
    }

    async function loadHistory(options) {
      options = options || {};
      var timeline = document.querySelector("#face-timeline");
      if (!current) return;
      try {
        versions = await store.versions(current.publicDoc.id, session.idToken);
      } catch (error) {
        versions = [];
      }
      if (versions.length < 2) {
        setDrawer(false);
        timeline.hidden = true;
        range.disabled = true;
        paintPreview(current.publicDoc);
        return;
      }
      var index = versions.length - 1;
      if (options.keepId) {
        versions.forEach(function (version, at) {
          if (version.id === options.keepId) index = at;
        });
      }
      timeline.hidden = false;
      range.max = String(versions.length - 1);
      range.value = String(index);
      range.disabled = false;
      showMeVersion(index);
      syncVersionManage();
      if (options.keepOpen) setDrawer(true);
    }

    async function deleteVersion(id) {
      if (deletingVersion || !session || session.actingAs || !current) return;
      deletingVersion = true;
      var viewing = versions[Number(range.value)];
      var keepId = viewing && viewing.id !== id ? viewing.id : "";
      try {
        await store.removeVersion(current.publicDoc.id, id, session.idToken);
        ui.setStatus(status, "");
        await loadHistory({ keepId: keepId, keepOpen: true });
      } catch (error) {
        ui.setStatus(status, ui.errorText(error), "error");
      } finally {
        deletingVersion = false;
      }
    }

    versionManage.addEventListener("click", function () {
      setDrawer(!versionDrawer.classList.contains("is-open"));
    });

    versionList.addEventListener("click", function (event) {
      var view = event.target.closest("[data-version-view]");
      if (view) {
        showMeVersion(Number(view.getAttribute("data-version-view")));
        return;
      }
      var remove = event.target.closest("[data-version-delete]");
      if (!remove) return;
      deleteVersion(remove.getAttribute("data-version-delete"));
    });

    range.addEventListener("input", function () {
      showMeVersion(Number(range.value));
    });

    function render(own) {
      current = own;
      var acting = Boolean(session && session.actingAs);
      var edit = document.querySelector("#edit");
      document.querySelector("#empty").hidden = true;
      document.querySelector("#owner").hidden = false;
      document.querySelector("#page-header").hidden = false;
      document.querySelector("#delete").hidden = !own || acting;
      document.querySelector("#delete-account").hidden = acting;
      document.querySelector(".head-meta").hidden = !own;
      document.querySelector("#me-nodata-preview").hidden = Boolean(own);
      document.querySelector("#me-nodata-prefs").hidden = Boolean(own);
      document.querySelector("#me-preview-body").hidden = !own;
      document.querySelector("#me-prefs-body").hidden = !own;
      if (edit) edit.hidden = acting;
      if (!own) {
        document.querySelector("#title").textContent = t("me.title");
        ui.setCrumb(t("me.title"));
        document.querySelector("#share").hidden = true;
        document.querySelector("#profile-link").hidden = true;
        if (edit) edit.href = "/new";
        return;
      }
      document.querySelector("#share").hidden = false;
      document.querySelector("#profile-link").hidden = false;
      var doc = own.publicDoc;
      ui.paintOwnerHeader({ doc: doc, header: t("me.title") });
      if (acting && edit) edit.hidden = true;
      paintPreview(doc);
      var level = math.historyLevel(doc.history);
      document.querySelector('input[name="history"][value="' + level + '"]').checked = true;
      syncVersionManage();
    }

    function renderAlias(alias) {
      currentAlias = alias || "";
      aliasInput.value = currentAlias;
      aliasLine.textContent = currentAlias ? "@" + currentAlias : t("alias.missing");
      aliasLine.classList.toggle("is-missing", !currentAlias);
      if (!currentAlias) ui.setStatus(aliasStatus, t("alias.required"), "error");
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
          document.querySelector("#root-link").hidden = own.publicDoc.number !== 1;
          await store.ensureFirstVersion(own.publicDoc, session.idToken).catch(function () {});
          await loadHistory();
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

    document.querySelectorAll("#me-preview-body .reading-stage").forEach(function (stage) {
      stage.querySelector(".reading-switch").addEventListener("click", function (event) {
        var button = event.target.closest("[data-view]");
        if (!button || button.hidden) return;
        var name = button.getAttribute("data-view");
        if (stage.id === "me-open-stage") openView = showReadingView(stage, name);
        else closedView = showReadingView(stage, name);
      });
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

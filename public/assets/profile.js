(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var db = window.MindsetFirestore;
  var math = window.MindsetReading;
  var i18n = window.MindsetI18n;
  var t = i18n.t;

  function parsePath() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    return { kind: parts[0] || "", key: decodeURIComponent(parts[1] || "").toLowerCase() };
  }

  async function fetchMindset(number, session) {
    try {
      var open = await db.get("mindsets/" + number);
      if (open) return open;
      return null;
    } catch (error) {
      if (!db.isPermission(error)) throw error;
    }
    if (!session) return { hidden: true };
    try {
      return (await db.get("mindsets/" + number, session.idToken)) || null;
    } catch (error) {
      if (db.isPermission(error)) return { hidden: true };
      throw error;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var actionStatus = document.querySelector("#action-status");
    var buttons = {
      tail: document.querySelector("#tail"),
      shine: document.querySelector("#shine"),
      distance: document.querySelector("#distance"),
      join: document.querySelector("#join"),
      accept: document.querySelector("#accept"),
      decline: document.querySelector("#decline"),
      withdraw: document.querySelector("#withdraw")
    };
    var ritual = document.querySelector("#ritual");
    var ritualBody = document.querySelector("#ritual-body");
    var ritualClosed = false;
    var shareButton = document.querySelector("#share");
    var range = document.querySelector("#timeline-range");
    var howDialog = document.querySelector("#how-to-read-dialog");
    var route = parsePath();
    var doc = null;
    var alias = "";
    var session = null;
    var state = { self: false };
    var ownRecord = null;
    var versions = [];
    var shownScores = null;
    var surfaceView = "radar";
    var deepView = "radar";

    ui.closeOnBackdrop(howDialog);

    function paintIcons() {
      shareButton.innerHTML = ui.icon("share");
      document.querySelector("#edit").innerHTML = ui.icon("edit");
      document.querySelector("#manage").innerHTML = ui.icon("profile");
      document.querySelectorAll(".reading-switch [data-view='radar']").forEach(function (button) {
        button.innerHTML = ui.icon("radar");
      });
      document.querySelectorAll(".reading-switch [data-view='bars']").forEach(function (button) {
        button.innerHTML = ui.icon("bars");
      });
      document.querySelectorAll(".reading-switch [data-view='trend']").forEach(function (button) {
        button.innerHTML = ui.icon("trend");
      });
      document.querySelector("#version-manage").innerHTML = ui.icon("manage");
    }
    paintIcons();

    var warning = sessionStorage.getItem("mindset-warning");
    if (warning) {
      sessionStorage.removeItem("mindset-warning");
      ui.setStatus(status, t(warning), "error");
    }

    shareButton.addEventListener("click", function () {
      var url = window.location.origin + "/i/" + doc.id;
      var title = (doc.headline || t("common.mindset", { n: doc.id })) + ui.titleSuffix();
      if (navigator.share) {
        navigator.share({ title: title, text: title, url: url }).catch(function (error) {
          if (error && error.name === "AbortError") return;
          ui.setStatus(actionStatus, t("profile.shareFailed"), "error");
        });
        return;
      }
      navigator.clipboard.writeText(url).then(
        function () {
          ui.setStatus(actionStatus, t("profile.copied"));
        },
        function () {
          ui.setStatus(actionStatus, url);
        }
      );
    });

    function hasRadarData(scores, keys) {
      return keys.every(function (key) {
        return typeof scores[key] === "number" && scores[key] >= 0;
      });
    }

    function viewButton(stage, name) {
      return stage.querySelector('.reading-switch [data-view="' + name + '"]');
    }

    function viewOpen(stage, name) {
      var button = viewButton(stage, name);
      var panel = stage.querySelector('.reading-view[data-view="' + name + '"]');
      return Boolean(button && panel && !button.hidden);
    }

    function showReadingView(stage, name) {
      var chosen = viewOpen(stage, name) ? name : viewOpen(stage, "radar") ? "radar" : "bars";
      stage.querySelectorAll(".reading-switch [data-view]").forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.getAttribute("data-view") === chosen));
      });
      stage.querySelectorAll(".reading-view").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-view") !== chosen;
      });
      return chosen;
    }

    function syncSurfaceRadarSlide(scores) {
      var stage = document.querySelector("#surface-stage");
      viewButton(stage, "radar").hidden = !hasRadarData(scores, math.OPEN_KEYS);
      surfaceView = showReadingView(stage, surfaceView);
    }

    function syncDeepRadarSlide(scores) {
      var stage = document.querySelector("#deep-stage");
      viewButton(stage, "radar").hidden = !hasRadarData(scores, math.OPEN_KEYS.concat(math.CLOSED_KEYS));
      deepView = showReadingView(stage, deepView);
    }

    function syncTrendButton() {
      var stage = document.querySelector("#surface-stage");
      viewButton(stage, "trend").hidden = versions.length < 2;
      surfaceView = showReadingView(stage, surfaceView);
    }

    document.querySelectorAll(".reading-stage").forEach(function (stage) {
      stage.querySelector(".reading-switch").addEventListener("click", function (event) {
        var button = event.target.closest("[data-view]");
        if (!button || button.hidden) return;
        var name = button.getAttribute("data-view");
        if (stage.id === "surface-stage") surfaceView = showReadingView(stage, name);
        else deepView = showReadingView(stage, name);
      });
    });

    function openHowTo() {
      var body = document.querySelector("#how-to-read-body");
      body.innerHTML = ui.howToReadHtml(false, { plain: true });
      howDialog.showModal();
    }

    document.querySelector("#how-to-read").addEventListener("click", openHowTo);

    function selectProfileTab(name) {
      var panes = {
        surface: document.querySelector("#pane-surface"),
        deep: document.querySelector("#pane-deep"),
        nearby: document.querySelector("#pane-nearby"),
        school: document.querySelector("#pane-school")
      };
      var tabs = {
        surface: document.querySelector("#tab-surface"),
        deep: document.querySelector("#tab-deep"),
        nearby: document.querySelector("#tab-nearby"),
        school: document.querySelector("#tab-school")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        panes[key].hidden = !on;
        tabs[key].setAttribute("aria-selected", String(on));
      });
    }

    document.querySelector(".depth-tabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-tab]");
      if (!tab) return;
      selectProfileTab(tab.getAttribute("data-tab"));
    });

    function renderAlias() {
      var node = document.querySelector("#alias");
      node.hidden = !alias;
      node.textContent = alias ? "@" + alias : "";
    }

    function renderSchoolChip() {
      var chip = document.querySelector("#in-school");
      chip.hidden = !(session && state.member && !state.self);
    }

    function drawReading(scores, ghost) {
      if (hasRadarData(scores, math.OPEN_KEYS)) {
        ui.renderRadar(document.querySelector("#radar-face"), scores, ghost);
      } else {
        document.querySelector("#radar-face").innerHTML = "";
      }
      ui.renderBars(document.querySelector("#face-bars"), scores, math.OPEN_KEYS);
    }

    function showReading(source, ghost) {
      var next = math.scoresOf(source);
      syncSurfaceRadarSlide(next);
      ui.tweenScores(shownScores, next, function (scores) {
        drawReading(scores, ghost);
      });
      shownScores = next;
    }

    function renderSurface(source, compareTo) {
      var html = window.MindsetLens.fields
        .filter(function (field) {
          return field.open && source[field.key];
        })
        .map(function (field) {
          var changed = compareTo && compareTo[field.key] !== source[field.key];
          var plain = field.plain ? i18n.pick(field.plain) : "";
          return (
            '<article class="post"><h3>' +
            ui.escapeHtml(i18n.pick(field.label)) +
            (changed ? ' <span class="tag">' + ui.escapeHtml(t("history.changedSince")) + "</span>" : "") +
            "</h3>" +
            (plain ? '<p class="field-plain">' + ui.escapeHtml(plain) + "</p>" : "") +
            "<p>" +
            ui.escapeHtml(source[field.key]) +
            "</p></article>"
          );
        })
        .join("");
      document.querySelector("#surface").innerHTML =
        html || '<p class="empty">' + ui.escapeHtml(t("feed.empty")) + "</p>";
    }

    function showProfile() {
      document.querySelector("#profile").hidden = false;
      document.querySelector("#title").innerHTML = ui.mindsetIdTitle(doc.id, "", doc.ownerUid);
      ui.setCrumb(String(doc.id));
      renderAlias();
      document.querySelector("#badges").textContent = ui.badgeText(doc);
      document.querySelector("#meta").textContent = ui.relativeWhen(doc.updatedAt);
      showReading(doc);
      renderSurface(doc);
      updateDeepAccess();
      if (doc.published === false) ui.setStatus(status, t("profile.onlyYou"));
    }

    function canSeeDeep() {
      return Boolean(session && (state.self || state.member));
    }

    function updateDeepAccess() {
      var locked = document.querySelector("#deep-locked");
      var content = document.querySelector("#deep-content");
      var ok = canSeeDeep();
      locked.hidden = ok;
      content.hidden = !ok;
      renderSchoolChip();
    }

    var versionDrawer = document.querySelector("#version-drawer");
    var versionList = document.querySelector("#version-list");
    var versionManage = document.querySelector("#version-manage");
    var deletingVersion = false;

    function syncVersionManage() {
      versionManage.hidden = !state.self;
    }

    function markVersionRow() {
      var current = String(range.value);
      versionList.querySelectorAll(".version-row").forEach(function (row) {
        row.classList.toggle("is-active", row.getAttribute("data-version-index") === current);
      });
    }

    function renderVersionList() {
      var current = Number(range.value);
      var html = "";
      for (var index = versions.length - 1; index >= 0; index -= 1) {
        var version = versions[index];
        html +=
          '<div class="version-row' +
          (index === current ? " is-active" : "") +
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

    function showVersion(index) {
      var version = versions[index];
      var last = index === versions.length - 1;
      var source = last ? doc : version;
      document.querySelector("#timeline-when").textContent = last
        ? t("history.now")
        : ui.formatWhen(version.createdAt);
      document.querySelector("#timeline-count").textContent = t("history.position", {
        i: index + 1,
        n: versions.length
      });
      range.setAttribute("aria-valuetext", document.querySelector("#timeline-when").textContent);
      showReading(source, last ? null : math.scoresOf(doc));
      renderSurface(source, last ? null : doc);
      ui.renderTrend(document.querySelector("#trend"), versions, index);
      markVersionRow();
    }

    function showLiveReading() {
      showReading(doc);
      renderSurface(doc);
    }

    async function loadHistory(options) {
      options = options || {};
      var timeline = document.querySelector("#face-timeline");
      try {
        versions = await store.versions(doc.id, session && session.idToken);
      } catch (error) {
        versions = [];
      }
      if (versions.length < 2) {
        setDrawer(false);
        timeline.hidden = true;
        range.disabled = true;
        if (!versions.length) document.querySelector("#trend").innerHTML = "";
        else ui.renderTrend(document.querySelector("#trend"), versions, 0);
        showLiveReading();
        syncTrendButton();
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
      showVersion(index);
      syncTrendButton();
      syncVersionManage();
      if (options.keepOpen) setDrawer(true);
    }

    async function deleteVersion(id) {
      if (deletingVersion || !session || !state.self) return;
      deletingVersion = true;
      var viewing = versions[Number(range.value)];
      var keepId = viewing && viewing.id !== id ? viewing.id : "";
      try {
        await store.removeVersion(doc.id, id, session.idToken);
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
        var index = Number(view.getAttribute("data-version-view"));
        range.value = String(index);
        showVersion(index);
        return;
      }
      var remove = event.target.closest("[data-version-delete]");
      if (!remove) return;
      deleteVersion(remove.getAttribute("data-version-delete"));
    });

    range.addEventListener("input", function () {
      showVersion(Number(range.value));
    });

    function liveGlint(glint) {
      return social.glintLive(glint) ? glint : null;
    }

    function postHtml(title, text, note) {
      return (
        '<article class="post"><h3>' +
        ui.escapeHtml(title) +
        (note ? ' <span class="tag">' + ui.escapeHtml(note) + "</span>" : "") +
        "</h3><p>" +
        ui.escapeHtml(text) +
        "</p></article>"
      );
    }

    function renderActions() {
      Object.keys(buttons).forEach(function (key) {
        buttons[key].hidden = true;
      });
      var notes = [];
      if (!session) {
        buttons.tail.hidden = false;
        buttons.tail.textContent = t("profile.tail");
        buttons.tail.className = "btn btn-compact btn-primary";
        buttons.tail.setAttribute("aria-pressed", "false");
      } else if (!state.self) {
        if (state.member) {
          // School badge lives next to share; keep ritual for handshake notes only.
        } else if (state.incoming) {
          buttons.accept.hidden = false;
          buttons.decline.hidden = false;
          var heard = liveGlint(state.myGlint);
          if (heard) {
            notes.push(
              '<p class="ritual-line">' +
                ui.escapeHtml(
                  t("profile.shown", { field: ui.fieldLabel(heard.field), date: ui.formatWhen(heard.expiresAt) })
                ) +
                "</p>"
            );
          }
        } else if (state.outgoing) {
          buttons.withdraw.hidden = false;
          notes.push('<p class="ritual-line"><strong>' + ui.escapeHtml(t("profile.requestSent")) + "</strong></p>");
        } else {
          buttons.tail.hidden = false;
          buttons.tail.textContent = t(state.iTail ? "profile.tailing" : "profile.tail");
          buttons.tail.className = "btn btn-compact" + (state.iTail ? "" : " btn-primary");
          buttons.tail.setAttribute("aria-pressed", String(Boolean(state.iTail)));
          var mine = liveGlint(state.myGlint);
          if (state.theyTail) {
            notes.push('<p class="ritual-line"><strong>' + ui.escapeHtml(t("profile.onYourTail")) + "</strong></p>");
          }
          if (mine) {
            buttons.withdraw.hidden = false;
            notes.push(
              '<p class="ritual-line">' +
                ui.escapeHtml(
                  t("profile.shown", { field: ui.fieldLabel(mine.field), date: ui.formatWhen(mine.expiresAt) })
                ) +
                "</p>"
            );
          } else if (state.theyTail) {
            buttons.shine.hidden = false;
          }
          var theirs = liveGlint(state.theirGlint);
          if (state.theyTail || mine || theirs) buttons.distance.hidden = false;
          if (theirs) {
            buttons.join.hidden = false;
            notes.push(
              '<div class="ritual-glint"><p class="hint">' +
                ui.escapeHtml(t("profile.theyShowed", { field: ui.fieldLabel(theirs.field) })) +
                " · " +
                ui.escapeHtml(t("profile.untilWhen", { date: ui.formatWhen(theirs.expiresAt) })) +
                "</p>" +
                postHtml(ui.fieldLabel(theirs.field), theirs.text) +
                "</div>"
            );
          }
        }
      }
      ritualBody.innerHTML = notes.join("");
      ritual.hidden = ritualClosed || !notes.length;
      renderSchoolChip();
      var actions = document.querySelector(".actions-primary");
      var anyAction = ["shine", "distance", "join", "accept", "decline", "withdraw"].some(function (key) {
        return !buttons[key].hidden;
      });
      actions.hidden = !anyAction;
    }

    function updateSameCurrent() {
      var node = document.querySelector("#same-current");
      node.hidden = true;
      if (!session || !ownRecord || !doc || state.self) return;
      var mine = ownRecord.publicDoc && ownRecord.publicDoc.bucket;
      var theirs = doc.bucket;
      if (!mine || !theirs) return;
      var nearby = math.neighborBuckets(mine);
      if (nearby.indexOf(theirs) >= 0 || mine === theirs) node.hidden = false;
    }

    async function refreshState() {
      state = await social.relation(session, doc.ownerUid);
      renderActions();
      updateSameCurrent();
      updateDeepAccess();
      await Promise.all([loadDeep(), loadSchoolTab(), loadAlias()]);
    }

    function settle(action) {
      Object.keys(buttons).forEach(function (key) {
        buttons[key].disabled = true;
      });
      return action
        .then(function () {
          ui.setStatus(actionStatus, "");
          return refreshState();
        })
        .catch(function (error) {
          ui.setStatus(actionStatus, ui.errorText(error), "error");
        })
        .finally(function () {
          Object.keys(buttons).forEach(function (key) {
            buttons[key].disabled = false;
          });
        });
    }

    function needOwn() {
      if (ownRecord && ownRecord.publicDoc) return true;
      ui.setStatus(actionStatus, t("profile.needsMindset"), "error");
      return false;
    }

    buttons.tail.addEventListener("click", function () {
      if (!session) {
        window.location.assign("/register?next=" + encodeURIComponent("/i/" + doc.id));
        return;
      }
      if (!ownRecord || !ownRecord.publicDoc) {
        window.location.assign("/me");
        return;
      }
      var tailing = !state.iTail;
      state.iTail = tailing;
      renderActions();
      var run = tailing
        ? social.tail(session, ownRecord.publicDoc.id, doc.ownerUid, doc.id)
        : social.untail(session, doc.ownerUid);
      run.catch(function (error) {
        state.iTail = !tailing;
        renderActions();
        ui.setStatus(actionStatus, ui.errorText(error), "error");
      });
    });

    buttons.shine.addEventListener("click", async function () {
      if (!needOwn()) return;
      var field = await ui.pickClosedField({
        title: t("profile.shineTitle"),
        hint: t("profile.shineHint"),
        action: t("profile.shineAction"),
        privateDoc: ownRecord.privateDoc
      });
      if (!field) return;
      settle(
        social.shine(session, ownRecord.publicDoc.id, doc.ownerUid, doc.id, field, ownRecord.privateDoc[field])
      );
    });

    document.querySelector("#ritual-close").addEventListener("click", function () {
      ritualClosed = true;
      ritual.hidden = true;
    });

    buttons.distance.addEventListener("click", function () {
      if (!needOwn()) return;
      settle(social.distance(session, ownRecord.publicDoc.id, doc.ownerUid));
    });

    buttons.join.addEventListener("click", async function () {
      if (!needOwn()) return;
      var field = await ui.pickClosedField({
        title: t("profile.joinTitle"),
        hint: t("profile.joinHint"),
        action: t("profile.joinSend"),
        privateDoc: ownRecord.privateDoc
      });
      if (!field) return;
      settle(
        social.requestSchool(
          session,
          ownRecord.publicDoc.id,
          doc.ownerUid,
          doc.id,
          field,
          ownRecord.privateDoc[field]
        )
      );
    });

    buttons.accept.addEventListener("click", function () {
      settle(social.accept(session, doc.ownerUid));
    });

    buttons.decline.addEventListener("click", function () {
      settle(social.decline(session, doc.ownerUid));
    });

    buttons.withdraw.addEventListener("click", function () {
      if (state.outgoing) settle(social.cancel(session, doc.ownerUid));
      else settle(social.withdrawGlint(session, doc.ownerUid));
    });

    async function loadAlias() {
      if (alias || !session || !(state.self || state.member)) return;
      var entry = await social.aliasOf(doc.id, session.idToken);
      if (entry && entry.alias) {
        alias = entry.alias;
        renderAlias();
      }
    }

    // Owner or school members see the deep radar and what each side showed.
    async function loadDeep() {
      updateDeepAccess();
      if (!canSeeDeep()) return;
      var deep = await social.deepReading(doc.id, session.idToken);
      var exchanged = state.self
        ? { theirGlint: null, theirSeal: null, myGlint: null, mySeal: null }
        : await social.exchanged(session, doc.ownerUid);
      var scores = math.scoresOf(doc);
      var note = document.querySelector("#deep-note");
      if (deep) {
        math.CLOSED_KEYS.forEach(function (key) {
          if (typeof deep[key] === "number") scores[key] = deep[key];
        });
      }
      note.hidden = Boolean(deep);
      syncDeepRadarSlide(scores);
      if (hasRadarData(scores, math.OPEN_KEYS.concat(math.CLOSED_KEYS))) {
        ui.renderRadar(document.querySelector("#deep-radar"), scores, null, {
          keys: math.OPEN_KEYS.concat(math.CLOSED_KEYS)
        });
      } else {
        document.querySelector("#deep-radar").innerHTML = "";
      }
      ui.renderBars(document.querySelector("#deep-bars"), scores, math.CLOSED_KEYS);
      if (state.self) {
        document.querySelector("#exchanged").innerHTML =
          '<p class="empty">' + ui.escapeHtml(t("profile.deepOwnHint")) + "</p>";
        return;
      }
      var shownByThem = [exchanged.theirGlint, exchanged.theirSeal].filter(Boolean);
      var shownByMe = [exchanged.myGlint, exchanged.mySeal].filter(Boolean);
      document.querySelector("#exchanged").innerHTML =
        shownByThem
          .map(function (row) {
            return postHtml(ui.fieldLabel(row.field), row.text, t("profile.theirs"));
          })
          .concat(
            shownByMe.map(function (row) {
              return postHtml(ui.fieldLabel(row.field), row.text, t("profile.yours"));
            })
          )
          .join("") || '<p class="empty">' + ui.escapeHtml(t("current.state.nothing")) + "</p>";
    }

    async function loadSocial() {
      if (!session) {
        renderActions();
        updateDeepAccess();
        return;
      }
      if (doc.ownerUid === session.uid) {
        document.querySelector("#edit").hidden = false;
        document.querySelector("#manage").hidden = false;
        state = { self: true };
        syncVersionManage();
        renderActions();
        updateSameCurrent();
        updateDeepAccess();
        await Promise.all([loadDeep(), loadAlias()]);
        return;
      }
      ownRecord = await store.findOwn(session.uid, session.idToken).catch(function () {
        return null;
      });
      await refreshState();
    }

    async function loadSimilar() {
      var rows = await store.similar(doc, { limit: 6 });
      if (rows.length) {
        ui.renderCards(document.querySelector("#similar"), rows);
      } else {
        document.querySelector("#similar").innerHTML =
          '<p class="empty">' + ui.escapeHtml(t("feed.empty")) + "</p>";
      }
    }

    async function loadSchoolTab() {
      var list = document.querySelector("#school-list");
      var empty = document.querySelector("#school-empty");
      list.innerHTML = "";
      empty.hidden = true;
      if (!session || !(state.self || state.member)) {
        empty.hidden = false;
        empty.textContent = t("profile.schoolTabEmpty");
        return;
      }
      try {
        var members = await social.membersOf(doc.ownerUid, session.idToken);
        if (!members.length) {
          empty.hidden = false;
          empty.textContent = t("profile.schoolTabSolo");
          return;
        }
        var numbers = members.map(function (row) {
          return Number(row.number);
        });
        var docs = await store.byNumbers(numbers, session.idToken);
        var aliases = {};
        await Promise.all(
          numbers.map(function (number) {
            return social.aliasOf(number, session.idToken).then(function (entry) {
              if (entry && entry.alias) aliases[number] = entry.alias;
            });
          })
        );
        var myNumber = ownRecord && ownRecord.publicDoc ? Number(ownRecord.publicDoc.id) : null;
        if (state.self && session) {
          try {
            var mine = await store.findOwn(session.uid, session.idToken);
            if (mine) myNumber = Number(mine.publicDoc.id);
          } catch (error) {}
        }
        ui.renderCards(list, docs, "feed.emptySchool", function (row) {
          var extra = { alias: aliases[row.id] };
          if (myNumber && Number(row.id) === myNumber) extra.chip = t("profile.you");
          return extra;
        });
      } catch (error) {
        empty.hidden = false;
        empty.textContent = t("profile.schoolTabEmpty");
      }
    }

    async function load() {
      ui.beginPageLoad();
      try {
        var number = "";
        if (route.kind === "i" && /^\d+$/.test(route.key)) {
          number = route.key;
        } else if (route.kind === "a" && social.ALIAS_PATTERN.test(route.key)) {
          session = await ui.requireAuth();
          if (!session) return;
          var entry = await social.resolveAlias(route.key, session.idToken);
          if (entry) {
            number = String(entry.number);
            alias = route.key;
          }
        }
        if (!number) {
          document.querySelector("#profile").hidden = true;
          ui.setStatus(status, t("common.notFound"), "error");
          return;
        }

        var found = await fetchMindset(number, session);
        if (found && found.hidden && !session) {
          session = await store.getOptionalSession();
          if (session) found = await fetchMindset(number, session);
        }
        if (!found) {
          document.querySelector("#profile").hidden = true;
          ui.setStatus(status, t("common.notFound"), "error");
          return;
        }
        if (found.hidden) {
          document.querySelector("#profile").hidden = true;
          ui.setStatus(status, t("profile.notPublished"));
          return;
        }
        doc = found;
        showProfile();
        if (!session) session = await store.getOptionalSession();
        await Promise.all([loadSocial(), loadSimilar(), loadHistory()]);
        await loadSchoolTab();
      } finally {
        await ui.endPageLoad();
      }
    }

    load().catch(function (error) {
      if (doc) return;
      document.querySelector("#profile").hidden = true;
      ui.setStatus(status, ui.errorText(error), "error");
    });
  });
})();

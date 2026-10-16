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
      join: document.querySelector("#join"),
      accept: document.querySelector("#accept"),
      decline: document.querySelector("#decline"),
      withdraw: document.querySelector("#withdraw")
    };
    var ritual = document.querySelector("#ritual");
    var shareButton = document.querySelector("#share");
    var range = document.querySelector("#timeline-range");
    var sheet = document.querySelector("#reading-sheet");
    var route = parsePath();
    var doc = null;
    var alias = "";
    var session = null;
    var state = { self: false };
    var ownRecord = null;
    var versions = [];
    var shownScores = null;

    ui.closeOnBackdrop(sheet);

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

    document.querySelector("#reading-slides").addEventListener("click", function (event) {
      var dot = event.target.closest("[data-slide-to]");
      if (dot) showFaceSlide(Number(dot.getAttribute("data-slide-to")));
    });
    (function () {
      var host = document.querySelector("#reading-slides");
      var startX = 0;
      host.addEventListener("touchstart", function (event) {
        if (event.changedTouches && event.changedTouches[0]) startX = event.changedTouches[0].clientX;
      }, { passive: true });
      host.addEventListener("touchend", function (event) {
        if (!event.changedTouches || !event.changedTouches[0]) return;
        var dx = event.changedTouches[0].clientX - startX;
        if (Math.abs(dx) < 40) return;
        showFaceSlide(dx < 0 ? 1 : 0);
      }, { passive: true });
    })();

    document.querySelector("#open-sheet").addEventListener("click", function () {
      sheet.showModal();
    });
    document.querySelector("#sheet-close").addEventListener("click", function () {
      sheet.close();
    });

    function renderAlias() {
      var node = document.querySelector("#alias");
      node.hidden = !alias;
      node.textContent = alias ? "@" + alias : "";
    }


    var faceSlide = 0;

    function showFaceSlide(index) {
      faceSlide = index === 1 ? 1 : 0;
      document.querySelectorAll("#reading-slides .slide").forEach(function (slide) {
        var on = Number(slide.getAttribute("data-slide")) === faceSlide;
        slide.hidden = !on;
        slide.classList.toggle("is-active", on);
      });
      document.querySelectorAll("#reading-slides .slide-dot").forEach(function (dot) {
        var on = Number(dot.getAttribute("data-slide-to")) === faceSlide;
        dot.classList.toggle("is-active", on);
        dot.setAttribute("aria-selected", String(on));
      });
    }

    function drawReading(scores, ghost) {
      ui.renderRadar(document.querySelector("#radar-face"), scores, ghost);
      ui.renderBars(document.querySelector("#face-bars"), scores, math.OPEN_KEYS);
      ui.renderRadar(document.querySelector("#radar"), scores, ghost);
      ui.renderBars(document.querySelector("#bars"), scores, math.OPEN_KEYS);
    }

    function showReading(source, ghost) {
      var next = math.scoresOf(source);
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

    // Locked teasers only — closed text never enters the DOM.
    function renderBottom() {
      var lock =
        '<span class="locked-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>';
      document.querySelector("#bottom").innerHTML = window.MindsetLens.fields
        .filter(function (field) {
          return !field.open;
        })
        .map(function (field) {
          var plain = field.plain ? i18n.pick(field.plain) : "";
          return (
            '<article class="locked-field">' +
            lock +
            "<div><h3>" +
            ui.escapeHtml(i18n.pick(field.label)) +
            "</h3>" +
            (plain ? '<p class="field-plain">' + ui.escapeHtml(plain) + "</p>" : "") +
            '<p class="hint">' +
            ui.escapeHtml(t("profile.lockedUntilSchool")) +
            '</p><div class="locked-blur" aria-hidden="true"><span></span><span></span><span></span></div></div></article>'
          );
        })
        .join("");
    }

    function renderTailHint() {
      var hint = document.querySelector("#tail-hint");
      var show = !buttons.tail.hidden && !state.self;
      hint.hidden = !show;
    }

    function showProfile() {
      document.querySelector("#profile").hidden = false;
      document.querySelector("#title").textContent = "#" + doc.id;
      ui.setCrumb(String(doc.id));
      renderAlias();
      document.querySelector("#badges").textContent = ui.badgeText(doc);
      document.querySelector("#meta").textContent = ui.relativeWhen(doc.updatedAt);
      var guide = document.querySelector("#reading-guide");
      if (guide && !guide.dataset.ready) {
        guide.innerHTML = ui.howToReadHtml(true);
        guide.dataset.ready = "1";
      }
      showReading(doc);
      renderSurface(doc);
      renderBottom();
      if (doc.published === false) ui.setStatus(status, t("profile.onlyYou"));
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
      document.querySelector("#timeline-note").textContent = last ? "" : t("history.ghost");
      ui.renderTrend(document.querySelector("#trend"), versions, index);
    }

    async function loadHistory() {
      try {
        versions = await store.versions(doc.id, session && session.idToken);
      } catch (error) {
        versions = [];
      }
      if (!versions.length) return;
      document.querySelector("#timeline").hidden = false;
      range.max = String(versions.length - 1);
      range.value = range.max;
      range.disabled = versions.length < 2;
      if (versions.length < 2) {
        ui.renderTrend(document.querySelector("#trend"), versions, 0);
        document.querySelector("#timeline-when").textContent = t("history.now");
        document.querySelector("#timeline-note").textContent = t("history.single");
        return;
      }
      showVersion(versions.length - 1);
    }

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
        buttons.tail.className = "btn btn-primary";
        buttons.tail.setAttribute("aria-pressed", "false");
      } else if (!state.self) {
        if (state.member) {
          notes.push('<p class="ritual-line"><strong>' + ui.escapeHtml(t("profile.inSchool")) + "</strong></p>");
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
          buttons.tail.className = "btn " + (state.iTail ? "" : "btn-primary");
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
      ritual.innerHTML = notes.join("");
      ritual.hidden = !notes.length;
      renderTailHint();
    }

    function needLogin() {
      window.location.assign(ui.loginHref());
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
      if (!session) return needLogin();
      if (!needOwn()) return;
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

    function selectTab(name) {
      var nearby = name === "nearby";
      document.querySelector("#tab-nearby").setAttribute("aria-selected", String(nearby));
      document.querySelector("#tab-school").setAttribute("aria-selected", String(!nearby));
      document.querySelector("#pane-nearby").hidden = !nearby;
      document.querySelector("#pane-school").hidden = nearby;
    }

    document.querySelector("#tab-nearby").addEventListener("click", function () {
      selectTab("nearby");
    });
    document.querySelector("#tab-school").addEventListener("click", function () {
      selectTab("school");
    });

    async function loadAlias() {
      if (alias || !session || !(state.self || state.member)) return;
      var entry = await social.aliasOf(doc.id, session.idToken);
      if (entry && entry.alias) {
        alias = entry.alias;
        renderAlias();
      }
    }

    // A school sees the full radar and what each side showed.
    async function loadDeep() {
      var section = document.querySelector("#deep");
      section.hidden = true;
      if (!session || !state.member) return;
      var deep = await social.deepReading(doc.id, session.idToken);
      var exchanged = await social.exchanged(session, doc.ownerUid);
      var scores = math.scoresOf(doc);
      var note = document.querySelector("#deep-note");
      if (deep) {
        math.CLOSED_KEYS.forEach(function (key) {
          if (typeof deep[key] === "number") scores[key] = deep[key];
        });
      }
      section.hidden = false;
      note.hidden = Boolean(deep);
      ui.renderRadar(document.querySelector("#deep-radar"), scores, null, {
        keys: math.OPEN_KEYS.concat(math.CLOSED_KEYS)
      });
      ui.renderBars(document.querySelector("#deep-bars"), scores, math.CLOSED_KEYS);
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
        return;
      }
      if (doc.ownerUid === session.uid) {
        document.querySelector("#edit").hidden = false;
        document.querySelector("#manage").hidden = false;
        state = { self: true };
        renderActions();
        updateSameCurrent();
        await loadAlias();
        return;
      }
      ownRecord = await store.findOwn(session.uid, session.idToken).catch(function () {
        return null;
      });
      await refreshState();
    }

    async function loadSimilar() {
      var rows = await store.similar(doc, { limit: 6 });
      document.querySelector("#similar-section").hidden = false;
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
        var members = await social.members(session);
        var others = members.filter(function (row) {
          return Number(row.number) !== Number(doc.id);
        });
        if (!others.length) {
          empty.hidden = false;
          empty.textContent = t("profile.schoolTabSolo");
          return;
        }
        var numbers = others.map(function (row) {
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
        ui.renderCards(list, docs, "feed.emptySchool", function (row) {
          return { alias: aliases[row.id] };
        });
      } catch (error) {
        empty.hidden = false;
      }
    }

    async function load() {
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
        ui.setStatus(status, t("common.notFound"), "error");
        return;
      }

      var found = await fetchMindset(number, session);
      if (found && found.hidden && !session) {
        session = await store.getOptionalSession();
        if (session) found = await fetchMindset(number, session);
      }
      if (!found) {
        ui.setStatus(status, t("common.notFound"), "error");
        return;
      }
      if (found.hidden) {
        ui.setStatus(status, t("profile.notPublished"));
        return;
      }
      doc = found;
      showProfile();
      if (!session) session = await store.getOptionalSession();
      await Promise.all([loadSocial(), loadSimilar(), loadHistory()]);
      await loadSchoolTab();
    }

    load().catch(function (error) {
      if (doc) return;
      ui.setStatus(status, ui.errorText(error), "error");
    });
  });
})();

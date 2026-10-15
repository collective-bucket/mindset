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
    var followButton = document.querySelector("#follow");
    var tribeButton = document.querySelector("#tribe");
    var shareButton = document.querySelector("#share");
    var inviteForm = document.querySelector("#invite-form");
    var inviteInput = document.querySelector("#invite-alias");
    var range = document.querySelector("#timeline-range");
    var route = parsePath();
    var doc = null;
    var alias = "";
    var session = null;
    var following = false;
    var relation = "none";
    var versions = [];
    var shownScores = null;

    var warning = sessionStorage.getItem("mindset-warning");
    if (warning) {
      sessionStorage.removeItem("mindset-warning");
      ui.setStatus(status, t(warning), "error");
    }

    // Only the number travels outside; aliases stay inside the tribe.
    shareButton.addEventListener("click", function () {
      var url = window.location.origin + "/i/" + doc.id;
      var title = t("common.mindset", { n: doc.id });
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

    function renderAlias() {
      var node = document.querySelector("#alias");
      node.hidden = !alias;
      node.textContent = alias ? "@" + alias : "";
    }

    function drawReading(scores, ghost) {
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

    function renderTexts(source, compareTo) {
      document.querySelector("#texts").innerHTML = window.MindsetLens.fields
        .filter(function (field) {
          return field.open && source[field.key];
        })
        .map(function (field) {
          var changed = compareTo && compareTo[field.key] !== source[field.key];
          return (
            '<article class="post"><h3>' +
            ui.escapeHtml(i18n.pick(field.label)) +
            (changed ? ' <span class="tag">' + ui.escapeHtml(t("history.changedSince")) + "</span>" : "") +
            "</h3><p>" +
            ui.escapeHtml(source[field.key]) +
            "</p></article>"
          );
        })
        .join("");
    }

    function showProfile() {
      document.querySelector("#profile").hidden = false;
      document.querySelector("#title").textContent = doc.id;
      document.title = t("common.mindset", { n: doc.id }) + " · mindset";
      renderAlias();
      document.querySelector("#badges").textContent = ui.badgeText(doc);
      document.querySelector("#meta").textContent = ui.relativeWhen(doc.updatedAt);
      document.querySelector("#summary").textContent = ui.plainSummary(doc);
      showReading(doc);
      renderTexts(doc);
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
      document.querySelector("#summary").textContent = ui.plainSummary(Object.assign({ id: doc.id }, source));
      showReading(source, last ? null : math.scoresOf(doc));
      renderTexts(source, last ? null : doc);
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

    function renderFollow() {
      followButton.hidden = false;
      followButton.textContent = t(following ? "profile.following" : "profile.follow");
      followButton.className = "btn " + (following ? "" : "btn-primary");
      followButton.setAttribute("aria-pressed", String(following));
    }

    function renderTribe() {
      tribeButton.hidden = false;
      var key = {
        none: "profile.addTribe",
        outgoing: "profile.requested",
        incoming: "profile.accept",
        member: "profile.inTribe"
      }[relation];
      tribeButton.textContent = t(key);
      tribeButton.disabled = relation === "member";
      tribeButton.className = "btn " + (relation === "incoming" ? "btn-primary" : "");
    }

    function needLogin() {
      window.location.assign(ui.loginHref());
    }

    followButton.addEventListener("click", function () {
      if (!session) return needLogin();
      following = !following;
      renderFollow();
      var action = following ? social.follow(session, doc.id) : social.unfollow(session, doc.id);
      action.catch(function (error) {
        following = !following;
        renderFollow();
        ui.setStatus(actionStatus, ui.errorText(error), "error");
      });
    });

    function settle(action) {
      tribeButton.disabled = true;
      return action
        .then(function () {
          ui.setStatus(actionStatus, "");
        })
        .catch(function (error) {
          ui.setStatus(actionStatus, ui.errorText(error), "error");
        })
        .finally(renderTribe);
    }

    tribeButton.addEventListener("click", function () {
      if (!session) return needLogin();
      if (relation === "incoming") {
        settle(
          social.accept(session, doc.ownerUid).then(function () {
            relation = "member";
          })
        );
      } else if (relation === "outgoing") {
        settle(
          social.cancel(session, doc.ownerUid).then(function () {
            relation = "none";
          })
        );
      } else if (relation === "none") {
        inviteForm.hidden = false;
        inviteInput.focus();
      }
    });

    document.querySelector("#invite-cancel").addEventListener("click", function () {
      inviteForm.hidden = true;
      tribeButton.focus();
    });

    inviteForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var typed = inviteInput.value;
      settle(
        store.findOwn(session.uid, session.idToken).then(function (own) {
          if (!own) {
            throw Object.assign(new Error("needs mindset"), { i18n: "profile.tribeNeedsMindset" });
          }
          return social.invite(session, own.publicDoc.id, doc.ownerUid, doc.id, typed).then(function () {
            relation = "outgoing";
            inviteForm.hidden = true;
            inviteInput.value = "";
          });
        })
      );
    });

    async function loadSocial() {
      if (!session) {
        renderFollow();
        renderTribe();
        return;
      }
      if (doc.ownerUid === session.uid) {
        document.querySelector("#edit").hidden = false;
        document.querySelector("#manage").hidden = false;
      } else {
        following = await social.isFollowing(session, doc.id);
        renderFollow();
        relation = await social.relation(session, doc.ownerUid);
        renderTribe();
      }
      if (!alias) {
        var entry = await social.aliasOf(doc.id, session.idToken);
        if (entry && entry.alias) {
          alias = entry.alias;
          renderAlias();
        }
      }
    }

    async function loadSimilar() {
      var rows = await store.similar(doc, { limit: 6 });
      if (!rows.length) return;
      document.querySelector("#similar-section").hidden = false;
      ui.renderCards(document.querySelector("#similar"), rows);
    }

    async function load() {
      var number = "";
      if (route.kind === "i" && /^\d+$/.test(route.key)) {
        number = route.key;
      } else if (route.kind === "a" && social.ALIAS_PATTERN.test(route.key)) {
        session = await store.getOptionalSession();
        var entry = await social.resolveAlias(route.key, session && session.idToken);
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
    }

    load().catch(function (error) {
      if (doc) return;
      ui.setStatus(status, ui.errorText(error), "error");
    });
  });
})();

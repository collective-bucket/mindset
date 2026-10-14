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
    var route = parsePath();
    var doc = null;
    var alias = "";
    var session = null;
    var following = false;
    var relation = "none";

    var warning = sessionStorage.getItem("mindset-warning");
    if (warning) {
      sessionStorage.removeItem("mindset-warning");
      ui.setStatus(status, t(warning), "error");
    }

    function shareUrl() {
      var base = window.location.origin;
      if (doc && doc.alias) return base + "/a/" + doc.alias;
      return base + "/i/" + doc.id;
    }

    shareButton.addEventListener("click", function () {
      var url = shareUrl();
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
      if (alias) document.title = "@" + alias + " · mindset";
    }

    function showProfile() {
      var scores = math.scoresOf(doc);
      document.querySelector("#profile").hidden = false;
      document.querySelector("#avatar").innerHTML = ui.avatar(doc.id, "lg");
      document.querySelector("#title").textContent = t("common.mindset", { n: doc.id });
      document.title = t("common.mindset", { n: doc.id }) + " · mindset";
      if (!alias && doc.alias) alias = doc.alias;
      renderAlias();
      document.querySelector("#badges").innerHTML = ui.badges(doc);
      var when = ui.formatWhen(doc.updatedAt);
      document.querySelector("#meta").textContent =
        t("common.approx") + (when ? " · " + t("common.lastRead", { date: when }) : "");
      document.querySelector("#summary").textContent = math.summary(doc.id, scores, i18n.lang);
      ui.renderRadar(document.querySelector("#radar"), scores);
      ui.renderBars(document.querySelector("#bars"), scores, math.OPEN_KEYS);
      ui.renderOpenTexts(document.querySelector("#texts"), doc);
      if (doc.published === false) ui.setStatus(status, t("profile.onlyYou"));
    }

    function renderFollow() {
      followButton.hidden = false;
      followButton.textContent = t(following ? "profile.following" : "profile.follow");
      followButton.className = "btn " + (following ? "btn-ghost" : "btn-primary");
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
      tribeButton.className = "btn " + (relation === "incoming" ? "btn-primary" : "btn-ghost");
    }

    function needLogin() {
      window.location.assign(ui.loginHref());
    }

    followButton.addEventListener("click", function () {
      if (!session) return needLogin();
      followButton.disabled = true;
      var action = following ? social.unfollow(session, doc.id) : social.follow(session, doc.id);
      action
        .then(function () {
          following = !following;
          renderFollow();
        })
        .catch(function (error) {
          ui.setStatus(actionStatus, ui.errorText(error), "error");
        })
        .finally(function () {
          followButton.disabled = false;
        });
    });

    tribeButton.addEventListener("click", function () {
      if (!session) return needLogin();
      tribeButton.disabled = true;
      var action;
      if (relation === "incoming") {
        action = social.accept(session, doc.ownerUid).then(function () {
          relation = "member";
        });
      } else if (relation === "outgoing") {
        action = social.cancel(session, doc.ownerUid).then(function () {
          relation = "none";
        });
      } else {
        action = store.findOwn(session.uid, session.idToken).then(function (own) {
          if (!own) {
            var error = new Error("needs mindset");
            error.i18n = "profile.tribeNeedsMindset";
            throw error;
          }
          return social.invite(session, own.publicDoc.id, doc.ownerUid, doc.id).then(function () {
            relation = "outgoing";
          });
        });
      }
      action
        .then(function () {
          ui.setStatus(actionStatus, "");
          renderTribe();
        })
        .catch(function (error) {
          ui.setStatus(actionStatus, ui.errorText(error), "error");
          renderTribe();
        });
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
      await Promise.all([loadSocial(), loadSimilar()]);
    }

    load().catch(function (error) {
      if (doc) return;
      ui.setStatus(status, ui.errorText(error), "error");
    });
  });
})();

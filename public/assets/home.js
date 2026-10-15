(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var t = window.MindsetI18n.t;

  var LIMIT = 12;

  function byUpdated(left, right) {
    return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
  }

  function changeTag(doc) {
    return t(doc.createdAt === doc.updatedAt ? "flow.new" : "flow.changed") + " · " + ui.relativeWhen(doc.updatedAt);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#feed-status");

    async function aliasMap(numbers, token) {
      var map = {};
      await Promise.all(
        numbers.map(function (number) {
          return social.aliasOf(number, token).then(function (entry) {
            if (entry && entry.alias) map[number] = entry.alias;
          });
        })
      );
      return map;
    }

    async function load() {
      var session = await ui.requireAuth();
      if (!session) return;
      document.querySelector("#hero-art").innerHTML = ui.icon("scene");
      ui.setStatus(status, t("common.loading"));
      var own = await store.findOwn(session.uid, session.idToken).catch(function () { return null; });
      document.querySelector("#hero").hidden = Boolean(own);
      if (own) {
        document.querySelector("#mine-head").hidden = false;
        document.querySelector("#mine").textContent = t("flow.youAre", { n: own.publicDoc.id });
      }

      var seen = {};
      if (own) seen[own.publicDoc.id] = true;

      if (session) {
        var lists = await Promise.all([
          social.members(session).catch(function () { return []; }),
          social.followingNumbers(session).catch(function () { return []; })
        ]);
        var members = lists[0];
        var tribeNumbers = members.map(function (row) { return Number(row.number); });
        var sinceByNumber = {};
        members.forEach(function (row) {
          sinceByNumber[row.number] = row.since;
        });
        var netNumbers = lists[1].filter(function (number) {
          return tribeNumbers.indexOf(Number(number)) < 0;
        });
        var docs = await store.byNumbers(tribeNumbers.concat(netNumbers), session.idToken).catch(function () { return []; });
        var aliases = tribeNumbers.length ? await aliasMap(tribeNumbers, session.idToken) : {};
        var tribeDocs = docs.filter(function (doc) { return tribeNumbers.indexOf(Number(doc.id)) >= 0; }).sort(byUpdated);
        var netDocs = docs.filter(function (doc) { return netNumbers.indexOf(Number(doc.id)) >= 0; }).sort(byUpdated);

        if (tribeNumbers.length) {
          document.querySelector("#tribe-section").hidden = false;
          ui.renderCards(document.querySelector("#tribe-feed"), tribeDocs.slice(0, LIMIT), "feed.emptyTribe", function (doc) {
            var since = sinceByNumber[doc.id];
            var joinedLater = since && since > doc.updatedAt;
            return {
              alias: aliases[doc.id],
              tag: joinedLater ? t("flow.joined") + " · " + ui.relativeWhen(since) : changeTag(doc)
            };
          });
        }
        if (netNumbers.length) {
          document.querySelector("#net-section").hidden = false;
          ui.renderCards(document.querySelector("#net-feed"), netDocs.slice(0, LIMIT), "feed.emptyFollowing", function (doc) {
            return { tag: changeTag(doc) };
          });
        }
        tribeNumbers.concat(netNumbers).forEach(function (number) {
          seen[number] = true;
        });
      }

      var recent = await store.recent(40, session && session.idToken);
      var everyone = recent.filter(function (doc) {
        return !seen[doc.id];
      });
      ui.renderCards(document.querySelector("#everyone-feed"), everyone.slice(0, 20), "feed.empty", function (doc) {
        return { tag: changeTag(doc) };
      });
      ui.setStatus(status, "");
    }

    load().catch(function (error) {
      var hero = document.querySelector("#hero");
      if (hero && !document.querySelector("#gated").hidden) hero.hidden = false;
      ui.setStatus(status, ui.errorText(error), "error");
    });
  });
})();

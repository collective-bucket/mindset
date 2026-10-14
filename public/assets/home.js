(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var t = window.MindsetI18n.t;

  document.addEventListener("DOMContentLoaded", function () {
    var feed = document.querySelector("#feed");
    var status = document.querySelector("#feed-status");
    var tabs = document.querySelectorAll("[data-feed]");
    var session = null;
    var own = null;
    var cache = {};
    var current = "latest";

    async function numbersFor(kind) {
      if (kind === "following") return social.followingNumbers(session);
      var rows = await social.members(session);
      return rows.map(function (row) {
        return row.number;
      });
    }

    async function rowsFor(kind) {
      if (kind === "latest") return store.listPublic({});
      if (!session) return null;
      var numbers = await numbersFor(kind);
      return numbers.length ? store.byNumbers(numbers, session.idToken) : [];
    }

    function show(kind) {
      current = kind;
      tabs.forEach(function (tab) {
        tab.setAttribute("aria-selected", String(tab.getAttribute("data-feed") === kind));
      });
      if (kind !== "latest" && !session) {
        feed.innerHTML =
          '<p class="empty"><a href="' + ui.loginHref() + '">' + ui.escapeHtml(t("feed.signInFor")) + "</a></p>";
        ui.setStatus(status, "");
        return;
      }
      if (cache[kind]) {
        render(kind, cache[kind]);
        return;
      }
      feed.innerHTML = "";
      ui.setStatus(status, t("common.loading"));
      rowsFor(kind)
        .then(function (rows) {
          cache[kind] = rows || [];
          if (current === kind) render(kind, cache[kind]);
          ui.setStatus(status, "");
        })
        .catch(function (error) {
          ui.setStatus(status, ui.errorText(error), "error");
        });
    }

    function render(kind, rows) {
      var empty = { latest: "feed.empty", following: "feed.emptyFollowing", tribe: "feed.emptyTribe" }[kind];
      ui.renderCards(feed, rows, empty);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        show(tab.getAttribute("data-feed"));
      });
    });

    async function loadSimilar() {
      var exclude = {};
      var follows = await social.followingNumbers(session);
      var tribe = await social.members(session);
      follows.forEach(function (number) {
        exclude[number] = true;
      });
      tribe.forEach(function (row) {
        exclude[row.number] = true;
      });
      var rows = await store.similar(own.publicDoc, { exclude: exclude, limit: 6 });
      if (!rows.length) return;
      document.querySelector("#similar-section").hidden = false;
      ui.renderCards(document.querySelector("#similar"), rows);
    }

    store
      .getOptionalSession()
      .then(function (next) {
        session = next;
        return session ? store.findOwn(session.uid, session.idToken) : null;
      })
      .then(function (found) {
        own = found;
        document.querySelector("#hero").hidden = Boolean(own);
        if (own) {
          var number = own.publicDoc.id;
          var mine = document.querySelector("#mine");
          var link =
            '<a href="/i/' + number + '">' + ui.escapeHtml(t("common.mindset", { n: number })) + "</a>";
          mine.innerHTML = ui.escapeHtml(t("home.yours", { link: "\u0000" })).replace("\u0000", link);
          mine.hidden = false;
          return loadSimilar();
        }
        return null;
      })
      .catch(function () {
        document.querySelector("#hero").hidden = false;
      });

    show("latest");
  });
})();

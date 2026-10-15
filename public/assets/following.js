(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var t = window.MindsetI18n.t;

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var list = document.querySelector("#following");
    var session = null;

    function row(number, doc) {
      return (
        '<div class="person" data-number="' +
        number +
        '"><a class="person-link" href="/i/' +
        number +
        '">' +
        ui.avatar(number, "sm") +
        "<span><strong>" +
        ui.escapeHtml(number) +
        "</strong>" +
        (doc ? '<small class="hint">' + ui.escapeHtml(ui.plainSummary(doc)) + "</small>" : "") +
        '</span></a><span class="person-actions"><button type="button" class="btn btn-small" data-unfollow>' +
        ui.escapeHtml(t("following.unfollow")) +
        "</button></span></div>"
      );
    }

    async function load() {
      ui.setStatus(status, t("common.loading"));
      var numbers = await social.followingNumbers(session);
      var docs = numbers.length ? await store.byNumbers(numbers, session.idToken) : [];
      var byId = {};
      docs.forEach(function (doc) {
        byId[doc.id] = doc;
      });
      list.innerHTML = numbers.length
        ? numbers
            .sort(function (left, right) {
              return right - left;
            })
            .map(function (number) {
              return row(number, byId[number]);
            })
            .join("")
        : '<p class="empty">' + ui.escapeHtml(t("feed.emptyFollowing")) + "</p>";
      ui.setStatus(status, "");
    }

    list.addEventListener("click", function (event) {
      var button = event.target.closest("[data-unfollow]");
      if (!button) return;
      var number = button.closest("[data-number]").getAttribute("data-number");
      button.disabled = true;
      social
        .unfollow(session, number)
        .then(load)
        .catch(function (error) {
          button.disabled = false;
          ui.setStatus(status, ui.errorText(error), "error");
        });
    });

    store.getOptionalSession().then(function (next) {
      session = next;
      if (!session) {
        document.querySelector("#login-link").href = ui.loginHref();
        document.querySelector("#login-hint").hidden = false;
        return;
      }
      load().catch(function (error) {
        ui.setStatus(status, ui.errorText(error), "error");
      });
    });
  });
})();

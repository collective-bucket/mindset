(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var t = window.MindsetI18n.t;

  function personRow(number, alias, uid, actions) {
    return (
      '<div class="person" data-uid="' +
      ui.escapeHtml(uid) +
      '"><a class="person-link" href="/i/' +
      number +
      '">' +
      ui.avatar(number, "sm") +
      "<span><strong>" +
      ui.escapeHtml(t("common.mindset", { n: number })) +
      "</strong>" +
      (alias ? '<small class="alias">@' + ui.escapeHtml(alias) + "</small>" : "") +
      '</span></a><span class="person-actions">' +
      actions
        .map(function (action) {
          return (
            '<button type="button" class="btn btn-small ' +
            (action.primary ? "btn-primary" : "btn-ghost") +
            '" data-action="' +
            action.id +
            '">' +
            ui.escapeHtml(t(action.label)) +
            "</button>"
          );
        })
        .join("") +
      "</span></div>"
    );
  }

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

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var session = null;

    function fill(container, rows, actions) {
      if (!rows.length) {
        container.innerHTML = '<p class="empty">' + ui.escapeHtml(t("tribe.none")) + "</p>";
        return;
      }
      container.innerHTML = rows
        .map(function (row) {
          return personRow(row.number, row.alias, row.uid, actions);
        })
        .join("");
    }

    async function load() {
      ui.setStatus(status, t("common.loading"));
      var results = await Promise.all([
        social.incoming(session),
        social.outgoing(session),
        social.members(session)
      ]);
      var incoming = results[0].map(function (row) {
        return { uid: row.from, number: row.fromNumber };
      });
      var outgoing = results[1].map(function (row) {
        return { uid: row.to, number: row.toNumber };
      });
      var members = results[2].map(function (row) {
        return { uid: row.uid || row.id, number: row.number };
      });
      var aliases = await aliasMap(
        incoming.concat(outgoing, members).map(function (row) {
          return row.number;
        }),
        session.idToken
      );
      [incoming, outgoing, members].forEach(function (list) {
        list.forEach(function (row) {
          row.alias = aliases[row.number] || "";
        });
      });
      fill(document.querySelector("#incoming"), incoming, [
        { id: "accept", label: "tribe.accept", primary: true },
        { id: "decline", label: "tribe.decline" }
      ]);
      fill(document.querySelector("#members"), members, [{ id: "remove", label: "tribe.remove" }]);
      fill(document.querySelector("#outgoing"), outgoing, [{ id: "cancel", label: "tribe.cancel" }]);
      document.querySelector("#tribe-body").hidden = false;
      ui.setStatus(status, "");
    }

    document.querySelector("#tribe-body").addEventListener("click", function (event) {
      var button = event.target.closest("[data-action]");
      if (!button) return;
      var uid = button.closest("[data-uid]").getAttribute("data-uid");
      var action = button.getAttribute("data-action");
      var run = {
        accept: social.accept,
        decline: social.decline,
        cancel: social.cancel,
        remove: social.leave
      }[action];
      button.disabled = true;
      run(session, uid)
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

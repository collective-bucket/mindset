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
      ui.escapeHtml(number) +
      "</strong>" +
      (alias ? '<small class="alias">@' + ui.escapeHtml(alias) + "</small>" : "") +
      '</span></a><span class="person-actions">' +
      actions
        .map(function (action) {
          return (
            '<button type="button" class="btn btn-small ' +
            (action.primary ? "btn-primary" : "") +
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
    var ownDoc = null;

    function selectSchoolSection(name) {
      var panes = {
        welcome: document.querySelector("#pane-school-welcome"),
        incoming: document.querySelector("#pane-school-incoming"),
        members: document.querySelector("#pane-school-members"),
        outgoing: document.querySelector("#pane-school-outgoing")
      };
      var tabs = {
        welcome: document.querySelector("#tab-school-welcome"),
        incoming: document.querySelector("#tab-school-incoming"),
        members: document.querySelector("#tab-school-members"),
        outgoing: document.querySelector("#tab-school-outgoing")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        panes[key].hidden = !on;
        tabs[key].setAttribute("aria-selected", String(on));
      });
    }

    document.querySelector("#share").addEventListener("click", function () {
      ui.shareMindset(ownDoc, status);
    });

    document.querySelector(".school-stick .depth-tabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-school-section]");
      if (!tab) return;
      selectSchoolSection(tab.getAttribute("data-school-section"));
    });

    function fill(container, rows, actions) {
      if (!rows.length) {
        container.innerHTML = '<p class="empty">' + ui.escapeHtml(t("school.none")) + "</p>";
        return;
      }
      container.innerHTML = rows
        .map(function (row) {
          return personRow(row.number, row.alias, row.uid, actions);
        })
        .join("");
    }

    async function load(options) {
      var gate = !(options && options.soft);
      if (gate) ui.beginPageLoad();
      try {
        ui.setStatus(status, t("common.loading"));
        var own = await store.findOwn(session.uid, session.idToken).catch(function () {
          return null;
        });
        ownDoc = own && own.publicDoc;
        if (ownDoc) {
          var aliasEntry = await social.aliasOf(ownDoc.id, session.idToken).catch(function () {
            return null;
          });
          ui.paintOwnerHeader({
            doc: ownDoc,
            header: t("school.title"),
            alias: aliasEntry && aliasEntry.alias
          });
        } else {
          ui.clearOwnerHeader(t("school.title"));
        }
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
          { id: "accept", label: "school.accept", primary: true },
          { id: "decline", label: "school.decline" }
        ]);
        fill(document.querySelector("#members"), members, [{ id: "remove", label: "school.remove" }]);
        fill(document.querySelector("#outgoing"), outgoing, [{ id: "cancel", label: "school.cancel" }]);
        ui.setStatus(status, "");
      } finally {
        if (gate) await ui.endPageLoad();
      }
    }

    document.querySelector("#school-body").addEventListener("click", function (event) {
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
        .then(function () {
          return load({ soft: true });
        })
        .catch(function (error) {
          button.disabled = false;
          ui.setStatus(status, ui.errorText(error), "error");
        });
    });

    selectSchoolSection("welcome");
    ui.requireAuth().then(function (next) {
      session = next;
      if (!session) {
        ui.endPageLoad();
        return;
      }
      load().catch(function (error) {
        ui.setStatus(status, ui.errorText(error), "error");
      });
    });
  });
})();

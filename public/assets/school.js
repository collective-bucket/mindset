(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var notices = window.MindsetNotices;
  var t = window.MindsetI18n.t;

  function personChip(tool) {
    if (!tool || !tool.label || !tool.id) return "";
    return (
      '<button type="button" class="btn btn-small' +
      (tool.open ? " btn-primary" : "") +
      '" data-action="' +
      tool.id +
      '">' +
      ui.escapeHtml(tool.label) +
      "</button>"
    );
  }

  function statusChip(tool) {
    if (!tool || !tool.label) return "";
    return '<span class="chip person-status">' + ui.escapeHtml(tool.label) + "</span>";
  }

  function memberSpan(since) {
    var date = new Date(since);
    if (Number.isNaN(date.getTime())) return "";
    var days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days < 1) return t("school.memberToday");
    if (days === 1) return t("school.memberForOne");
    return t("school.memberFor", { n: days });
  }

  function personRow(number, alias, uid, actions, since, copy) {
    var href = "/i/" + ui.escapeHtml(number);
    var statuses = [];
    var tools = [];
    (actions || []).forEach(function (action) {
      tools.push({
        id: action.id,
        label: t(action.label),
        open: Boolean(action.primary)
      });
    });
    var when = since ? ui.formatWhen(since) : "";
    var span = since ? memberSpan(since) : "";
    var meta =
      span || when
        ? '<p class="head-meta person-meta">' +
          (span ? "<span>" + ui.escapeHtml(span) + "</span>" : "") +
          (when ? "<span>" + ui.escapeHtml(when) + "</span>" : "") +
          "</p>"
        : "";
    var headline = copy && copy.headline ? copy.headline : "";
    var blurb = copy && copy.blurb ? copy.blurb : "";
    var body = copy
      ? headline
        ? '<p class="head-meta"><span class="alias">' +
          ui.escapeHtml(headline) +
          "</span></p>" +
          (blurb
            ? '<p class="head-meta person-meta"><span>' + ui.escapeHtml(blurb) + "</span></p>"
            : "")
        : '<strong class="person-title">#' + ui.escapeHtml(number) + "</strong>"
      : (alias
          ? '<p class="head-meta"><span class="alias">@' + ui.escapeHtml(alias) + "</span></p>"
          : '<strong class="person-title">#' + ui.escapeHtml(number) + "</strong>") + meta;
    return (
      '<div class="person" data-uid="' +
      ui.escapeHtml(uid) +
      '">' +
      '<a class="person-hit" href="' +
      href +
      '" tabindex="-1" aria-hidden="true"></a>' +
      ui.mindsetMarkStatic(number, uid, "person-id") +
      '<div class="person-body">' +
      body +
      (statuses.length
        ? '<div class="person-statuses">' + statuses.map(statusChip).join("") + "</div>"
        : "") +
      "</div>" +
      (tools.length ? '<div class="person-tools">' + tools.map(personChip).join("") + "</div>" : "") +
      "</div>"
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
        incoming: document.querySelector("#pane-school-incoming"),
        members: document.querySelector("#pane-school-members"),
        outgoing: document.querySelector("#pane-school-outgoing")
      };
      var tabs = {
        incoming: document.querySelector("#tab-school-incoming"),
        members: document.querySelector("#tab-school-members"),
        outgoing: document.querySelector("#tab-school-outgoing")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        panes[key].hidden = !on;
        tabs[key].setAttribute("aria-selected", String(on));
      });
      if (notices) {
        if (name === "incoming") notices.markSeen("schoolRequest");
        if (name === "members") notices.markSeen("schoolMember");
        if (name === "outgoing") notices.markSeen("requestDeclined");
      }
    }

    document.querySelector("#share").addEventListener("click", function () {
      ui.shareMindset(ownDoc, status);
    });

    document.querySelector(".school-stick .depth-tabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-school-section]");
      if (!tab) return;
      selectSchoolSection(tab.getAttribute("data-school-section"));
    });

    var tabsHelp = document.querySelector("#tabs-help-dialog");
    document.querySelector("#tabs-help").addEventListener("click", function () {
      document.querySelector("#tabs-help-body").innerHTML = String(t("guide.schoolBody") || "")
        .split(/\n+/)
        .filter(Boolean)
        .map(function (line) {
          return "<p>" + ui.escapeHtml(line) + "</p>";
        })
        .join("");
      tabsHelp.showModal();
    });
    if (ui.closeOnBackdrop) ui.closeOnBackdrop(tabsHelp);

    function fill(container, rows, actions, request, emptyKey) {
      if (!rows.length) {
        container.innerHTML = '<p class="empty">' + ui.escapeHtml(t(emptyKey)) + "</p>";
        return;
      }
      container.innerHTML = rows
        .map(function (row) {
          return personRow(
            row.number,
            row.alias,
            row.uid,
            actions,
            row.since,
            request ? { headline: row.headline, blurb: row.blurb } : null
          );
        })
        .join("");
    }

    function requestCopy(doc) {
      var headline = doc && doc.headline ? String(doc.headline).replace(/\.$/, "") : "";
      var blurb = doc ? ui.plainSummary(doc) : "";
      if (!headline && blurb) {
        headline = blurb;
        blurb = "";
      }
      if (blurb === headline) blurb = "";
      return { headline: headline, blurb: blurb };
    }

    async function load(options) {
      var gate = !(options && options.soft);
      if (gate) ui.beginPageLoad();
      try {
        if (gate) ui.setStatus(status, t("common.loading"));
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
            alias: aliasEntry && aliasEntry.alias,
            plainMark: true
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
          return { uid: row.uid || row.id, number: row.number, since: row.since };
        });
        var incomingDocs = incoming.length
          ? await store.byNumbers(
              incoming.map(function (row) {
                return row.number;
              }),
              session.idToken
            ).catch(function () {
              return [];
            })
          : [];
        var byNumber = {};
        incomingDocs.forEach(function (doc) {
          byNumber[String(doc.number)] = doc;
        });
        incoming.forEach(function (row) {
          var copy = requestCopy(byNumber[String(row.number)]);
          row.headline = copy.headline;
          row.blurb = copy.blurb;
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
        ], true, "school.incomingEmpty");
        fill(document.querySelector("#members"), members, [{ id: "remove", label: "school.remove" }], false, "school.membersEmpty");
        fill(document.querySelector("#outgoing"), outgoing, [{ id: "cancel", label: "school.cancel" }], false, "school.outgoingEmpty");
        ui.setStatus(status, "");
        if (notices) notices.refresh(session).catch(function () {});
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

    selectSchoolSection("members");
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

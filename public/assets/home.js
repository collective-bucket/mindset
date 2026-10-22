(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var notices = window.MindsetNotices;
  var reading = window.MindsetReading;
  var i18n = window.MindsetI18n;
  var t = i18n.t;

  var ROW_LIMIT = 40;

  function changeTag(doc) {
    return t(doc.createdAt === doc.updatedAt ? "current.new" : "current.changed") + " · " + ui.relativeWhen(doc.updatedAt);
  }

  function personChip(tool) {
    if (!tool || !tool.label || !tool.id) return "";
    return (
      '<button type="button" class="btn-icon" data-action="' +
      tool.id +
      '" aria-label="' +
      ui.escapeHtml(tool.label) +
      '">' +
      ui.icon(tool.id) +
      "</button>"
    );
  }

  function statusChip(tool) {
    if (!tool || !tool.label) return "";
    return '<span class="chip person-status">' + ui.escapeHtml(tool.label) + "</span>";
  }

  function personRow(row, doc, tools) {
    var title = doc && doc.headline ? String(doc.headline).replace(/\.$/, "") : "";
    var blurb = doc ? ui.plainSummary(doc) : "";
    if (!title && blurb) {
      title = blurb;
      blurb = "";
    }
    var statuses = [];
    var actions = [];
    (tools || []).forEach(function (tool) {
      if (tool.id) actions.push(tool);
      else statuses.push(tool);
    });
    var href = "/i/" + ui.escapeHtml(row.number);
    return (
      '<div class="person" data-uid="' +
      ui.escapeHtml(row.uid) +
      '" data-number="' +
      ui.escapeHtml(row.number) +
      '">' +
      '<a class="person-hit" href="' +
      href +
      '" tabindex="-1" aria-hidden="true"></a>' +
      ui.mindsetMark(row.number, row.uid, "person-id") +
      '<div class="person-body">' +
      (title ? '<strong class="person-title">' + ui.escapeHtml(title) + "</strong>" : "") +
      (blurb ? '<small class="person-blurb">' + ui.escapeHtml(blurb) + "</small>" : "") +
      (statuses.length
        ? '<div class="person-statuses">' + statuses.map(statusChip).join("") + "</div>"
        : "") +
      "</div>" +
      (actions.length ? '<div class="person-tools">' + actions.map(personChip).join("") + "</div>" : "") +
      "</div>"
    );
  }

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#feed-status");
    var session = null;
    var own = null;

    function quiet(promise) {
      return promise.catch(function () {
        return [];
      });
    }

    function showLanding() {
      document.querySelector("#auth-wall").hidden = true;
      document.querySelector("#gated").hidden = true;
      document.querySelector("#landing").hidden = false;
      document.querySelector("#gamebar").hidden = true;
      ui.setCrumb("");
      document.title = t("brand.name");
      var login = document.querySelector('#landing [data-auth-login]');
      if (login) login.setAttribute("href", ui.loginHref());
    }

    function selectCurrentSection(name) {
      var panes = {
        everyone: document.querySelector("#pane-current-everyone"),
        ontail: document.querySelector("#pane-current-ontail"),
        trail: document.querySelector("#pane-current-trail")
      };
      var tabs = {
        everyone: document.querySelector("#tab-current-everyone"),
        ontail: document.querySelector("#tab-current-ontail"),
        trail: document.querySelector("#tab-current-trail")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        panes[key].hidden = !on;
        tabs[key].setAttribute("aria-selected", String(on));
      });
      if (notices) {
        if (name === "ontail") {
          notices.markSeen("onTail");
          notices.markSeen("requestWithdrawn");
          notices.markSeen("distanced");
        }
        if (name === "trail") notices.markSeen("trailGlint");
      }
    }

    function openLookup(event) {
      event.preventDefault();
      var form = event.currentTarget;
      var input = form.querySelector("input");
      var raw = String(input.value || "").trim();
      var lookupStatus = document.querySelector("#lookup-status");
      if (!raw) return;
      var number = reading.parseNumber(raw);
      if (!number) {
        ui.setStatus(lookupStatus, t("landing.lookupBad"), "error");
        input.focus();
        return;
      }
      ui.setStatus(lookupStatus, "");
      window.location.href = "/i/" + number;
    }

    var lookupForm = document.querySelector("#lookup");
    if (lookupForm) lookupForm.addEventListener("submit", openLookup);

    document.querySelector(".current-stick .depth-tabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-current-section]");
      if (!tab) return;
      selectCurrentSection(tab.getAttribute("data-current-section"));
    });

    var helpDialog = document.querySelector("#current-help-dialog");
    if (helpDialog) {
      document.querySelector("#gated").addEventListener("click", function (event) {
        if (event.target.closest("#tabs-help")) {
          document.querySelector("#current-help-title").textContent = t("guide.current");
          document.querySelector("#current-help-body").innerHTML = String(t("guide.currentBody") || "")
            .split(/\n+/)
            .filter(Boolean)
            .map(function (line) {
              return "<p>" + ui.escapeHtml(line) + "</p>";
            })
            .join("");
          helpDialog.showModal();
        }
      });
      if (ui.closeOnBackdrop) ui.closeOnBackdrop(helpDialog);
    }

    document.querySelector("#share").addEventListener("click", function () {
      if (!own) return;
      ui.shareMindset(own.publicDoc, status);
    });

    async function load() {
      session = await store.getOptionalSession();
      if (!session) {
        showLanding();
        return;
      }
      document.querySelector("#landing").hidden = true;
      document.querySelector("#auth-wall").hidden = true;
      document.querySelector("#gated").hidden = false;
      document.querySelector("#gamebar").hidden = false;
      ui.setCrumb(t("current.title"));
      ui.setStatus(status, t("common.loading"));
      own = await store.findOwn(session.uid, session.idToken).catch(function () {
        return null;
      });
      if (own) {
        var aliasEntry = await social.aliasOf(own.publicDoc.id, session.idToken).catch(function () {
          return null;
        });
        ui.paintOwnerHeader({
          doc: own.publicDoc,
          header: t("current.title"),
          alias: aliasEntry && aliasEntry.alias
        });
      } else {
        ui.clearOwnerHeader(t("current.title"));
      }

      var seen = {};
      if (own) seen[own.publicDoc.id] = true;

      var lists = await Promise.all([
        quiet(social.tailersOf(session)),
        quiet(social.trailOf(session)),
        quiet(social.myGlints(session)),
        quiet(social.members(session)),
        quiet(social.incoming(session)),
        quiet(social.outgoing(session))
      ]);
      var members = lists[3];
      var memberUids = {};
      var schoolNumbers = members.map(function (row) {
        memberUids[row.uid || row.id] = true;
        return Number(row.number);
      });

      var onTail = lists[0]
        .filter(function (row) {
          return !memberUids[row.from];
        })
        .slice(0, ROW_LIMIT)
        .map(function (row) {
          return { uid: row.from, number: row.fromNumber };
        });
      var trail = lists[1]
        .filter(function (row) {
          return !memberUids[row.to];
        })
        .slice(0, ROW_LIMIT)
        .map(function (row) {
          return { uid: row.to, number: row.toNumber };
        });
      var myLive = {};
      lists[2].forEach(function (glint) {
        if (social.glintLive(glint)) myLive[glint.to] = glint;
      });
      var requestedUids = {};
      lists[5].forEach(function (row) {
        requestedUids[row.to] = true;
      });
      var incomingCount = lists[4].length;
      document.querySelector("#requests-nav").hidden = !incomingCount;
      document.querySelector("#requests-count").textContent = t("current.requests", { n: incomingCount });

      var theirGlints = {};
      await Promise.all(
        trail.map(function (row) {
          return social
            .glintFrom(session, row.uid)
            .then(function (glint) {
              if (social.glintLive(glint)) theirGlints[row.uid] = glint;
            })
            .catch(function () {});
        })
      );

      var numbers = onTail.concat(trail).map(function (row) {
        return Number(row.number);
      });
      var docs = numbers.length ? await store.byNumbers(numbers, session.idToken).catch(function () { return []; }) : [];
      var byId = {};
      docs.forEach(function (doc) {
        byId[doc.id] = doc;
      });

      var onTailHost = document.querySelector("#ontail");
      onTailHost.innerHTML = onTail.length
        ? onTail
            .map(function (row) {
              var live = myLive[row.uid];
              var tools = live
                ? [
                    { label: t("current.status.shown") + " · " + ui.formatWhen(live.expiresAt) },
                    { id: "withdraw", label: t("profile.withdraw") }
                  ]
                : [
                    { id: "shine", label: t("profile.shine"), open: true },
                    { id: "dismiss", label: t("current.dismiss") }
                  ];
              return personRow(row, byId[row.number], tools);
            })
            .join("")
        : '<p class="empty">' + ui.escapeHtml(t("feed.emptyOnTail")) + "</p>";

      var trailHost = document.querySelector("#trail");
      trailHost.innerHTML = trail.length
        ? trail
            .map(function (row) {
              var tools = [{ id: "stop", label: t("current.stop") }];
              var glint = theirGlints[row.uid];
              var stamp = glint ? String(glint.createdAt || glint.expiresAt || row.uid) : "";
              var passed = glint && notices && notices.isPassedGlint(session.uid, row.uid, stamp);
              if (requestedUids[row.uid]) {
                tools = [
                  { label: t("current.status.requested") },
                  { id: "stop", label: t("current.stop") }
                ];
              } else if (glint && !passed) {
                tools = [
                  { label: t("current.status.theyShowed") },
                  { id: "review", label: t("current.reviewGlint"), open: true },
                  { id: "stop", label: t("current.stop") }
                ];
              }
              return personRow(row, byId[row.number], tools);
            })
            .join("")
        : '<p class="empty">' + ui.escapeHtml(t("feed.emptyTrail")) + "</p>";

      onTail.concat(trail).forEach(function (row) {
        seen[row.number] = true;
      });
      schoolNumbers.forEach(function (number) {
        seen[number] = true;
      });

      var recent = await store.recent(40, session.idToken);
      var everyone = recent.filter(function (doc) {
        return !seen[doc.id];
      });
      ui.renderCards(document.querySelector("#everyone-feed"), everyone.slice(0, 20), "feed.empty", function (doc) {
        return { tag: changeTag(doc) };
      });
      ui.setStatus(status, "");
      if (notices) notices.refresh(session).catch(function () {});
    }

    function fail(error) {
      ui.setStatus(status, ui.errorText(error), "error");
    }

    async function shine(uid, number) {
      if (!own || !own.privateDoc) {
        ui.setStatus(status, t("profile.needsMindset"), "error");
        return;
      }
      var field = await ui.pickClosedField({
        title: t("profile.shineTitle"),
        hint: t("profile.shineHint"),
        action: t("profile.shineAction"),
        privateDoc: own.privateDoc
      });
      if (!field) return;
      await social.shine(session, own.publicDoc.id, uid, number, field, own.privateDoc[field]);
    }

    async function joinFromGlint(uid, number) {
      var glint = await social.glintFrom(session, uid).catch(function () {
        return null;
      });
      if (!social.glintLive(glint)) return;
      if (!own || !own.privateDoc) {
        ui.setStatus(status, t("profile.needsMindset"), "error");
        return;
      }
      var field = await ui.pickClosedField({
        title: t("profile.joinTitle"),
        hint: t("profile.joinHint"),
        action: t("profile.joinSend"),
        privateDoc: own.privateDoc
      });
      if (!field) return;
      await social.requestSchool(session, own.publicDoc.id, uid, number, field, own.privateDoc[field]);
      await load();
    }

    document.querySelector("#gated").addEventListener("click", function (event) {
      var node = event.target.closest("[data-action]");
      if (!node) return;
      var row = node.closest("[data-uid]");
      var uid = row.getAttribute("data-uid");
      var number = row.getAttribute("data-number");
      var action = node.getAttribute("data-action");
      if (action === "review") {
        joinFromGlint(uid, number).catch(fail);
        return;
      }
      node.disabled = true;
      var run;
      if (action === "shine") run = shine(uid, number);
      else if (action === "withdraw") run = social.withdrawGlint(session, uid);
      else if (action === "dismiss") run = social.dismissTail(session, uid);
      else if (action === "stop") run = social.untail(session, uid);
      else return;
      run.then(load).catch(function (error) {
        node.disabled = false;
        fail(error);
      });
    });

    selectCurrentSection("everyone");
    ui.beginPageLoad();
    load()
      .catch(fail)
      .finally(function () {
        return ui.endPageLoad();
      });
  });
})();

(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var reading = window.MindsetReading;
  var i18n = window.MindsetI18n;
  var t = i18n.t;

  var ROW_LIMIT = 40;

  function changeTag(doc) {
    return t(doc.createdAt === doc.updatedAt ? "current.new" : "current.changed") + " · " + ui.relativeWhen(doc.updatedAt);
  }

  function button(action) {
    return (
      '<button type="button" class="btn btn-small' +
      (action.primary ? " btn-primary" : "") +
      '" data-action="' +
      action.id +
      '">' +
      ui.escapeHtml(action.label) +
      "</button>"
    );
  }

  function personRow(row, doc, chip, actions) {
    var line = doc ? doc.headline || ui.plainSummary(doc) : "";
    return (
      '<div class="person" data-uid="' +
      ui.escapeHtml(row.uid) +
      '" data-number="' +
      ui.escapeHtml(row.number) +
      '"><a class="person-link" href="/i/' +
      ui.escapeHtml(row.number) +
      '">' +
      ui.avatar(row.number, "sm") +
      "<span><strong>" +
      ui.escapeHtml(row.number) +
      "</strong>" +
      (line ? '<small class="hint">' + ui.escapeHtml(line) + "</small>" : "") +
      (chip ? '<small class="chip">' + ui.escapeHtml(chip) + "</small>" : "") +
      '</span></a><span class="person-actions">' +
      actions.map(button).join("") +
      "</span></div>"
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
        welcome: document.querySelector("#pane-current-welcome"),
        ontail: document.querySelector("#pane-current-ontail"),
        trail: document.querySelector("#pane-current-trail"),
        everyone: document.querySelector("#pane-current-everyone")
      };
      var tabs = {
        welcome: document.querySelector("#tab-current-welcome"),
        ontail: document.querySelector("#tab-current-ontail"),
        trail: document.querySelector("#tab-current-trail"),
        everyone: document.querySelector("#tab-current-everyone")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        panes[key].hidden = !on;
        tabs[key].setAttribute("aria-selected", String(on));
      });
    }

    function openLookup(event) {
      event.preventDefault();
      var form = event.currentTarget;
      var input = form.querySelector("input");
      var raw = String(input.value || "").trim();
      var lookupStatus = document.querySelector(
        form.id === "current-lookup" ? "#current-lookup-status" : "#lookup-status"
      );
      if (!raw) {
        ui.setStatus(lookupStatus, "");
        window.location.href = "/i/1";
        return;
      }
      var number = reading.parseNumber(raw);
      if (!number) {
        ui.setStatus(lookupStatus, t("landing.lookupBad"), "error");
        input.focus();
        return;
      }
      ui.setStatus(lookupStatus, "");
      window.location.href = "/i/" + number;
    }

    document.querySelector("#lookup").addEventListener("submit", openLookup);
    document.querySelector("#current-lookup").addEventListener("submit", openLookup);

    document.querySelector(".current-stick .depth-tabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-current-section]");
      if (!tab) return;
      selectCurrentSection(tab.getAttribute("data-current-section"));
    });

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
      document.querySelector("#hero-art").innerHTML = ui.icon("lake");
      ui.setStatus(status, t("common.loading"));
      own = await store.findOwn(session.uid, session.idToken).catch(function () {
        return null;
      });
      document.querySelector("#hero").hidden = Boolean(own);
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
              return personRow(
                row,
                byId[row.number],
                live ? t("current.status.shown") + " · " + ui.formatWhen(live.expiresAt) : "",
                live
                  ? [{ id: "withdraw", label: t("profile.withdraw") }]
                  : [
                      { id: "shine", label: t("profile.shine"), primary: true },
                      { id: "dismiss", label: t("current.dismiss") }
                    ]
              );
            })
            .join("")
        : '<p class="empty">' + ui.escapeHtml(t("feed.emptyOnTail")) + "</p>";

      var trailHost = document.querySelector("#trail");
      trailHost.innerHTML = trail.length
        ? trail
            .map(function (row) {
              var chip = "";
              if (requestedUids[row.uid]) chip = t("current.status.requested");
              else if (theirGlints[row.uid]) chip = t("current.status.theyShowed");
              return personRow(row, byId[row.number], chip, [{ id: "stop", label: t("current.stop") }]);
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

    document.querySelector("#gated").addEventListener("click", function (event) {
      var node = event.target.closest("[data-action]");
      if (!node) return;
      var row = node.closest("[data-uid]");
      var uid = row.getAttribute("data-uid");
      var number = row.getAttribute("data-number");
      var action = node.getAttribute("data-action");
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
      .catch(function (error) {
        var hero = document.querySelector("#hero");
        if (hero && !document.querySelector("#gated").hidden) hero.hidden = false;
        fail(error);
      })
      .finally(function () {
        return ui.endPageLoad();
      });
  });
})();

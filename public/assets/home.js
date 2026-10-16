(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var i18n = window.MindsetI18n;
  var t = i18n.t;

  var LIMIT = 12;
  var ROW_LIMIT = 40;

  function byUpdated(left, right) {
    return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
  }

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

    function quiet(promise) {
      return promise.catch(function () {
        return [];
      });
    }

    async function load() {
      session = await ui.requireAuth();
      if (!session) return;
      document.querySelector("#hero-art").innerHTML = ui.icon("lake");
      ui.setStatus(status, t("common.loading"));
      own = await store.findOwn(session.uid, session.idToken).catch(function () {
        return null;
      });
      document.querySelector("#hero").hidden = Boolean(own);
      if (own) {
        document.querySelector("#mine-head").hidden = false;
        document.querySelector("#mine").textContent = t("current.youAre", { n: own.publicDoc.id });
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
      var sinceByNumber = {};
      members.forEach(function (row) {
        sinceByNumber[row.number] = row.since;
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

      var numbers = onTail
        .concat(trail)
        .map(function (row) {
          return Number(row.number);
        })
        .concat(schoolNumbers);
      var docs = numbers.length ? await store.byNumbers(numbers, session.idToken).catch(function () { return []; }) : [];
      var byId = {};
      docs.forEach(function (doc) {
        byId[doc.id] = doc;
      });

      var onTailHost = document.querySelector("#ontail");
      document.querySelector("#ontail-section").hidden = false;
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
      document.querySelector("#trail-section").hidden = false;
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

      if (schoolNumbers.length) {
        var aliases = await aliasMap(schoolNumbers, session.idToken);
        var schoolDocs = docs
          .filter(function (doc) {
            return schoolNumbers.indexOf(Number(doc.id)) >= 0;
          })
          .sort(byUpdated);
        document.querySelector("#school-section").hidden = false;
        ui.renderCards(document.querySelector("#school-feed"), schoolDocs.slice(0, LIMIT), "feed.emptySchool", function (doc) {
          var since = sinceByNumber[doc.id];
          var joinedLater = since && since > doc.updatedAt;
          return {
            alias: aliases[doc.id],
            tag: joinedLater ? t("current.joined") + " · " + ui.relativeWhen(since) : changeTag(doc)
          };
        });
      }

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

    load().catch(function (error) {
      var hero = document.querySelector("#hero");
      if (hero && !document.querySelector("#gated").hidden) hero.hidden = false;
      fail(error);
    });
  });
})();

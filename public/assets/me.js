(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var math = window.MindsetReading;
  var i18n = window.MindsetI18n;
  var t = i18n.t;

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var aliasStatus = document.querySelector("#alias-status");
    var aliasForm = document.querySelector("#alias-form");
    var aliasInput = document.querySelector("#alias");
    var aliasRemove = document.querySelector("#alias-remove");
    var dialog = document.querySelector("#delete-dialog");
    var session = null;
    var current = null;
    var currentAlias = "";
    var pendingDelete = "";

    ui.closeOnBackdrop(dialog);

    function renderClosedTexts(privateDoc) {
      document.querySelector("#closed-texts").innerHTML = window.MindsetLens.fields
        .filter(function (field) {
          return !field.open;
        })
        .map(function (field) {
          var value = (privateDoc && privateDoc[field.key]) || "";
          return (
            '<article class="post"><h3>' +
            ui.escapeHtml(i18n.pick(field.label)) +
            "</h3><p>" +
            (value ? ui.escapeHtml(value) : '<span class="hint">' + ui.escapeHtml(t("me.notWritten")) + "</span>") +
            "</p></article>"
          );
        })
        .join("");
    }

    function render(own) {
      current = own;
      document.querySelector("#empty").hidden = Boolean(own);
      document.querySelector("#owner").hidden = !own;
      document.querySelector("#delete").hidden = !own;
      if (!own) return;
      var doc = own.publicDoc;
      var number = doc.id;
      document.querySelector("#avatar").innerHTML = ui.avatar(number, "lg");
      document.querySelector("#title").textContent = t("common.mindset", { n: number });
      var when = ui.formatWhen(doc.updatedAt);
      document.querySelector("#meta").textContent =
        t(doc.published ? "me.published" : "me.unpublished") +
        (when ? " · " + t("common.lastRead", { date: when }) : "");
      var scores = math.scoresOf(doc);
      var closed = math.scoresOf(own.privateDoc);
      math.CLOSED_KEYS.forEach(function (key) {
        scores[key] = closed[key];
      });
      document.querySelector("#summary").textContent = math.summary(number, scores, i18n.lang);
      ui.renderRadar(document.querySelector("#radar"), scores);
      ui.renderBars(document.querySelector("#open-bars"), scores, math.OPEN_KEYS);
      ui.renderBars(document.querySelector("#closed-bars"), scores, math.CLOSED_KEYS);
      renderClosedTexts(own.privateDoc);
      document.querySelector("#toggle-publish").textContent = t(doc.published ? "me.unpublish" : "me.publish");
      document.querySelector("#profile-link").href = "/i/" + number;
    }

    function renderAlias(entry) {
      currentAlias = (entry && entry.alias) || "";
      aliasInput.value = currentAlias;
      var visibility = (entry && entry.visibility) || "tribe";
      aliasForm.querySelector('input[value="' + visibility + '"]').checked = true;
      aliasRemove.hidden = !currentAlias;
    }

    async function load(notice) {
      ui.setStatus(status, t("common.loading"));
      session = await store.getOptionalSession();
      if (!session) {
        document.querySelector("#signed-out").hidden = false;
        document.querySelector("#account").hidden = true;
        ui.setStatus(status, "");
        return;
      }
      document.querySelector("#account").hidden = false;
      document.querySelector("#email").textContent = t("me.signedInAs", { email: session.email });
      var own = await store.findOwn(session.uid, session.idToken);
      render(own);
      if (own) renderAlias(await social.aliasOf(own.publicDoc.id, session.idToken));
      ui.setStatus(status, notice ? t(notice) : "", notice ? "error" : "");
    }

    function fail(error) {
      ui.setStatus(status, ui.errorText(error), "error");
    }

    document.querySelector("#toggle-publish").addEventListener("click", function () {
      if (!current) return;
      ui.setStatus(status, t("common.saving"));
      store
        .setPublished(session, current.publicDoc.published !== true)
        .then(function (result) {
          return load(result.warning ? "create.publishWarning" : "");
        })
        .catch(fail);
    });

    aliasForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!current) {
        ui.setStatus(aliasStatus, t("me.aliasNeedsMindset"), "error");
        return;
      }
      var visibility = aliasForm.querySelector('input[name="visibility"]:checked').value;
      ui.setStatus(aliasStatus, t("common.saving"));
      social
        .setAlias(session, current.publicDoc.id, aliasInput.value, visibility, currentAlias)
        .then(function (saved) {
          renderAlias({ alias: saved, visibility: visibility });
          ui.setStatus(aliasStatus, t("me.aliasSaved"));
        })
        .catch(function (error) {
          ui.setStatus(aliasStatus, ui.errorText(error), "error");
        });
    });

    aliasRemove.addEventListener("click", function () {
      if (!current || !currentAlias) return;
      social
        .removeAlias(session, current.publicDoc.id, currentAlias)
        .then(function () {
          renderAlias(null);
          ui.setStatus(aliasStatus, t("me.aliasRemoved"));
        })
        .catch(function (error) {
          ui.setStatus(aliasStatus, ui.errorText(error), "error");
        });
    });

    document.querySelector("#sign-out").addEventListener("click", function () {
      window.MindsetAuth.signOut().then(function () {
        window.location.assign("/");
      });
    });

    function askDelete(kind) {
      pendingDelete = kind;
      var number = current ? current.publicDoc.id : "";
      document.querySelector("#delete-title").textContent = t(kind === "account" ? "me.deleteAccount" : "me.deleteMindset");
      document.querySelector("#delete-copy").textContent =
        kind === "account" ? t("me.deleteAccountCopy") : t("me.deleteMindsetCopy", { n: number });
      dialog.showModal();
    }

    document.querySelector("#delete").addEventListener("click", function () {
      askDelete("mindset");
    });
    document.querySelector("#delete-account").addEventListener("click", function () {
      askDelete("account");
    });

    dialog.addEventListener("close", function () {
      if (dialog.returnValue !== "confirm") return;
      ui.setStatus(status, t("me.deleting"));
      store
        .requireSession()
        .then(function (fresh) {
          session = fresh;
          return store.remove(session);
        })
        .then(function () {
          if (pendingDelete !== "account") return null;
          return window.MindsetAuth.deleteAccount();
        })
        .then(function () {
          window.location.assign("/");
        })
        .catch(function (error) {
          if (error && error.code === "auth/requires-recent-login") {
            ui.setStatus(status, t("me.recentLogin"), "error");
            return;
          }
          fail(error);
        });
    });

    load().catch(fail);
  });
})();

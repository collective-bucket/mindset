(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var owner = document.querySelector("#owner");
    var dialog = document.querySelector("#delete-dialog");
    var session = null;
    var current = null;

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close("cancel");
    });

    function render(own) {
      current = own;
      if (!own) {
        owner.hidden = true;
        window.MindsetUi.setStatus(status, "");
        document.querySelector("#empty").hidden = false;
        return;
      }
      document.querySelector("#empty").hidden = true;
      owner.hidden = false;
      var number = own.publicDoc.id;
      document.querySelector("#title").textContent = number + ". mindset";
      var when = window.MindsetUi.formatWhen(own.publicDoc.updatedAt);
      document.querySelector("#meta").textContent =
        (own.publicDoc.published ? "Yayında" : "Yayında değil") +
        (when ? " · son okuma " + when : "");
      var scores = window.MindsetReading.scoresOf(own.publicDoc);
      var closed = window.MindsetReading.scoresOf(own.privateDoc);
      window.MindsetReading.CLOSED_KEYS.forEach(function (key) {
        scores[key] = closed[key];
      });
      document.querySelector("#summary").textContent =
        window.MindsetReading.summary(number, scores);
      window.MindsetUi.renderRadar(document.querySelector("#radar"), scores);
      window.MindsetUi.renderBars(
        document.querySelector("#open-bars"),
        scores,
        window.MindsetReading.OPEN_KEYS
      );
      window.MindsetUi.renderBars(
        document.querySelector("#closed-bars"),
        scores,
        window.MindsetReading.CLOSED_KEYS
      );
      window.MindsetUi.renderOpenTexts(document.querySelector("#open-texts"), own.publicDoc);
      document.querySelector("#closed-texts").innerHTML = window.MindsetLens.fields
        .filter(function (field) {
          return !field.open;
        })
        .map(function (field) {
          var value = (own.privateDoc && own.privateDoc[field.key]) || "";
          return (
            "<section class=\"text-block\"><h3>" +
            window.MindsetUi.escapeHtml(field.label) +
            "</h3><p>" +
            (value
              ? window.MindsetUi.escapeHtml(value)
              : "<span class=\"hint\">Yazılmamış</span>") +
            "</p></section>"
          );
        })
        .join("");
      var toggle = document.querySelector("#toggle-publish");
      toggle.textContent = own.publicDoc.published ? "Yayından kaldır" : "Yayınla";
      document.querySelector("#profile-link").href = "/m/" + number;
      document.querySelector("#delete-copy").textContent =
        number +
        ". mindset silinsin mi? Açık metin, kapalı metin ve okumalar da silinir.";
    }

    function load(notice) {
      window.MindsetUi.setStatus(status, "Yükleniyor");
      window.MindsetStore.getOptionalSession()
        .then(function (next) {
          session = next;
          if (!session) {
            owner.hidden = true;
            document.querySelector("#empty").hidden = true;
            document.querySelector("#login-link").href = window.MindsetStore.loginUrl();
            document.querySelector("#login-hint").hidden = false;
            window.MindsetUi.setStatus(status, "");
            return null;
          }
          document.querySelector("#login-hint").hidden = true;
          return window.MindsetStore.findOwn(session.uid, session.idToken);
        })
        .then(function (own) {
          if (!session) return;
          render(own);
          window.MindsetUi.setStatus(status, notice || "", notice ? "error" : "");
        })
        .catch(function (error) {
          window.MindsetUi.setStatus(status, error.message || "Açılamadı.", "error");
        });
    }

    document.querySelector("#toggle-publish").addEventListener("click", function () {
      if (!current) return;
      var next = current.publicDoc.published !== true;
      window.MindsetUi.setStatus(status, "Kaydediliyor");
      window.MindsetStore.setPublished(session, next)
        .then(function (result) {
          load(result.warning || "");
        })
        .catch(function (error) {
          window.MindsetUi.setStatus(status, error.message || "Kaydedilemedi.", "error");
        });
    });

    document.querySelector("#delete").addEventListener("click", function () {
      dialog.showModal();
    });

    dialog.addEventListener("close", function () {
      if (dialog.returnValue !== "confirm") return;
      window.MindsetUi.setStatus(status, "Siliniyor");
      window.MindsetStore.remove(session)
        .then(function () {
          window.location.assign("/");
        })
        .catch(function (error) {
          window.MindsetUi.setStatus(status, error.message || "Silinemedi.", "error");
        });
    });

    load();
  });
})();

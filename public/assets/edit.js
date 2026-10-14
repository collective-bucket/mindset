(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.querySelector("#mindset-form");
    var status = document.querySelector("#form-status");
    var loginHint = document.querySelector("#login-hint");
    var loginLink = document.querySelector("#login-link");
    var preview = document.querySelector("#preview");
    var dialog = document.querySelector("#publish-dialog");
    var readButton = document.querySelector("#read");
    var publishButton = document.querySelector("#publish");
    var reading = null;
    var dirty = true;
    var existingNumber = null;

    window.MindsetUi.renderForm(
      document.querySelector("#open-fields"),
      document.querySelector("#closed-fields")
    );

    function watchCounts() {
      window.MindsetLens.fields.forEach(function (field) {
        window.MindsetUi.updateCount(form, field.key);
      });
    }

    form.addEventListener("input", function (event) {
      dirty = true;
      reading = null;
      preview.hidden = true;
      if (event.target && event.target.id) {
        window.MindsetUi.updateCount(form, event.target.id);
      }
    });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close("cancel");
    });

    function showPreview(scores) {
      var label = existingNumber || "Önizleme";
      document.querySelector("#preview-summary").textContent =
        window.MindsetReading.summary(label, scores);
      window.MindsetUi.renderRadar(document.querySelector("#preview-radar"), scores);
      window.MindsetUi.renderBars(
        document.querySelector("#preview-open"),
        scores,
        window.MindsetReading.OPEN_KEYS
      );
      window.MindsetUi.renderBars(
        document.querySelector("#preview-closed"),
        scores,
        window.MindsetReading.CLOSED_KEYS
      );
      preview.hidden = false;
    }

    async function runRead() {
      var texts = window.MindsetUi.collectTexts(form);
      readButton.disabled = true;
      publishButton.disabled = true;
      window.MindsetUi.setStatus(status, "Okunuyor");
      reading = await window.MindsetScore.read(texts, function (message) {
        window.MindsetUi.setStatus(status, message);
      });
      dirty = false;
      showPreview(reading);
      window.MindsetUi.setStatus(status, "Yaklaşık okuma hazır. İstersen yayınla.");
      return texts;
    }

    readButton.addEventListener("click", function () {
      loginHint.hidden = true;
      runRead()
        .catch(function (error) {
          window.MindsetUi.setStatus(
            status,
            error.message || "Okuma yapılamadı.",
            "error"
          );
        })
        .finally(function () {
          readButton.disabled = false;
          publishButton.disabled = false;
        });
    });

    publishButton.addEventListener("click", function () {
      loginHint.hidden = true;
      publishButton.disabled = true;
      var prepare = !reading || dirty ? runRead() : Promise.resolve(window.MindsetUi.collectTexts(form));
      prepare
        .then(function () {
          dialog.showModal();
        })
        .catch(function (error) {
          window.MindsetUi.setStatus(status, error.message || "Okuma yapılamadı.", "error");
        })
        .finally(function () {
          publishButton.disabled = false;
        });
    });

    dialog.addEventListener("close", function () {
      if (dialog.returnValue !== "confirm" || !reading) return;
      var texts;
      try {
        texts = window.MindsetUi.collectTexts(form);
      } catch (error) {
        window.MindsetUi.setStatus(status, error.message, "error");
        return;
      }
      publishButton.disabled = true;
      window.MindsetUi.setStatus(status, "Kaydediliyor");
      window.MindsetStore.requireSession()
        .then(function (session) {
          return window.MindsetStore.publish(session, texts, reading);
        })
        .then(function (result) {
          if (result.warning) sessionStorage.setItem("mindset-warning", result.warning);
          window.location.assign("/m/" + result.number);
        })
        .catch(function (error) {
          publishButton.disabled = false;
          window.MindsetUi.setStatus(status, error.message || "Kaydedilemedi.", "error");
          if (/giriş/i.test(error.message || "")) {
            loginLink.href = window.MindsetStore.loginUrl();
            loginHint.hidden = false;
          }
        });
    });

    window.MindsetStore.getOptionalSession()
      .then(function (session) {
        if (!session) return null;
        return window.MindsetStore.findOwn(session.uid, session.idToken);
      })
      .then(function (own) {
        if (!own) return;
        existingNumber = own.publicDoc.id;
        document.querySelector("h1").textContent = existingNumber + ". mindset";
        window.MindsetUi.fillTexts(form, {
          currentPosition: own.publicDoc.currentPosition || "",
          personalCode: own.publicDoc.personalCode || "",
          selfNarrative: own.publicDoc.selfNarrative || "",
          unsayableAttitude: (own.privateDoc && own.privateDoc.unsayableAttitude) || "",
          desireScript: (own.privateDoc && own.privateDoc.desireScript) || "",
          disownedSelf: (own.privateDoc && own.privateDoc.disownedSelf) || ""
        });
        var scores = window.MindsetReading.scoresOf(own.publicDoc);
        var closed = window.MindsetReading.scoresOf(own.privateDoc);
        window.MindsetReading.CLOSED_KEYS.forEach(function (key) {
          scores[key] = closed[key];
        });
        reading = scores;
        dirty = false;
        showPreview(scores);
        window.MindsetUi.setStatus(status, "Son okuma yüklendi. Metin değişirse yeniden okunur.");
      })
      .catch(function (error) {
        window.MindsetUi.setStatus(status, error.message || "Mindset yüklenemedi.", "error");
      });

    watchCounts();
  });
})();

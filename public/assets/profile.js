(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var parts = window.location.pathname.split("/").filter(Boolean);
    var number = parts[0] === "m" ? parts[1] : "";
    var warning = sessionStorage.getItem("mindset-warning");
    if (warning) {
      sessionStorage.removeItem("mindset-warning");
      window.MindsetUi.setStatus(status, warning, "error");
    }

    if (!/^\d+$/.test(number)) {
      window.MindsetUi.setStatus(status, "Bu numara yok.", "error");
      return;
    }

    var copyButton = document.querySelector("#copy-link");
    var shareButton = document.querySelector("#share-link");
    var shareUrl = window.location.origin + "/m/" + number;
    if (navigator.share) shareButton.hidden = false;

    function shareData() {
      return {
        title: number + ". mindset",
        text: number + ". mindset",
        url: shareUrl
      };
    }

    copyButton.addEventListener("click", function () {
      navigator.clipboard.writeText(shareUrl).then(
        function () {
          window.MindsetUi.setStatus(status, "Link kopyalandı.");
        },
        function () {
          window.MindsetUi.setStatus(status, shareUrl);
        }
      );
    });

    shareButton.addEventListener("click", function () {
      navigator.share(shareData()).catch(function (error) {
        if (error && error.name === "AbortError") return;
        window.MindsetUi.setStatus(status, "Paylaşım açılamadı.", "error");
      });
    });

    function showProfile(doc, session) {
      document.querySelector("#title").textContent = doc.id + ". mindset";
      document.title = doc.id + ". mindset";
      var when = window.MindsetUi.formatWhen(doc.updatedAt);
      document.querySelector("#meta").textContent =
        "Yaklaşık okuma" + (when ? " · son okuma " + when : "");
      var scores = window.MindsetReading.scoresOf(doc);
      document.querySelector("#summary").textContent =
        window.MindsetReading.summary(doc.id, scores);
      window.MindsetUi.renderRadar(document.querySelector("#radar"), scores);
      window.MindsetUi.renderBars(
        document.querySelector("#bars"),
        scores,
        window.MindsetReading.OPEN_KEYS
      );
      window.MindsetUi.renderOpenTexts(document.querySelector("#texts"), doc);
      document.querySelector("#share-actions").hidden = false;
      if (session && doc.ownerUid === session.uid) {
        document.querySelector("#owner-link").hidden = false;
      }
      if (doc.published === false) {
        window.MindsetUi.setStatus(status, "Bu mindset yayında değil. Yalnız sen görürsün.");
      }
    }

    var loaded = null;

    window.MindsetFirestore.getDocument("mindsets", number)
      .then(function (doc) {
        if (!doc) {
          window.MindsetUi.setStatus(status, "Bu numara yok.", "error");
          return null;
        }
        loaded = doc;
        showProfile(doc, null);
        return window.MindsetStore.getOptionalSession();
      })
      .then(function (session) {
        if (session && loaded && loaded.ownerUid === session.uid) {
          document.querySelector("#owner-link").hidden = false;
        }
      })
      .catch(function (error) {
        if (loaded) return;
        if (!window.MindsetUi.isPermission(error)) {
          window.MindsetUi.setStatus(status, error.message || "Profil açılamadı.", "error");
          return;
        }
        window.MindsetUi.setStatus(status, "Bu mindset yayında değil.");
        window.MindsetStore.getOptionalSession()
          .then(function (session) {
            if (!session) return null;
            return window.MindsetFirestore.getDocument("mindsets", number, session.idToken);
          })
          .then(function (doc) {
            if (!doc) return;
            showProfile(doc, { uid: doc.ownerUid });
            if (doc.published !== false) window.MindsetUi.setStatus(status, "");
          })
          .catch(function () {
            window.MindsetUi.setStatus(status, "Bu mindset yayında değil.");
          });
      });
  });
})();

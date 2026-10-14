(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var mine = document.querySelector("#mine");

    window.MindsetStore.getOptionalSession()
      .then(function (session) {
        if (!session) return null;
        return window.MindsetStore.findOwn(session.uid, session.idToken);
      })
      .then(function (own) {
        if (!own || !mine) return;
        var number = String(own.publicDoc.id || "");
        if (!/^\d+$/.test(number)) return;
        mine.hidden = false;
        mine.innerHTML =
          "Senin numaran <a href=\"/m/" +
          number +
          "\">" +
          number +
          ". mindset</a>.";
      })
      .catch(function () {
        if (mine) mine.hidden = true;
      });
  });
})();

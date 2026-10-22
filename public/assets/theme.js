(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var ui = window.MindsetUi;
    var names = ui.iconNames();
    document.querySelector("#theme-icons").innerHTML = names
      .map(function (name) {
        return (
          '<figure class="theme-swatch"><span class="btn-icon">' +
          ui.icon(name) +
          "</span><code>" +
          ui.escapeHtml(name) +
          "</code></figure>"
        );
      })
      .join("");
    document.querySelector("#theme-icon-btn").innerHTML = ui.icon("share");
    document.querySelector("#theme-icon-pressed").innerHTML = ui.icon("waves");
  });
})();

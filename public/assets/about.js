(function () {
  "use strict";

  var ui = window.MindsetUi;
  var i18n = window.MindsetI18n;

  function fillFields(id, open) {
    var list = document.querySelector(id);
    if (!list) return;
    list.innerHTML = window.MindsetLens.fields
      .filter(function (field) {
        return Boolean(field.open) === open;
      })
      .map(function (field) {
        return (
          "<li><strong>" +
          ui.escapeHtml(i18n.pick(field.label)) +
          '</strong> <span class="hint">— ' +
          ui.escapeHtml(i18n.pick(field.plain || field.label)) +
          "</span></li>"
        );
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    fillFields("#about-open-fields", true);
    fillFields("#about-closed-fields", false);
    window.MindsetStore.getOptionalSession().then(function (session) {
      var bar = document.querySelector("#gamebar");
      if (bar) bar.hidden = !session;
    });
  });
})();

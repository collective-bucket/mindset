(function () {
  "use strict";

  var ui = window.MindsetUi;
  var t = window.MindsetI18n.t;

  var ERRORS = {
    "auth/invalid-credential": "auth.err.invalid",
    "auth/invalid-login-credentials": "auth.err.invalid",
    "auth/wrong-password": "auth.err.invalid",
    "auth/user-not-found": "auth.err.invalid",
    "auth/email-already-in-use": "auth.err.exists",
    "auth/weak-password": "auth.err.weak",
    "auth/invalid-email": "auth.err.email",
    "auth/missing-email": "auth.err.email",
    "auth/missing-password": "auth.err.invalid",
    "auth/popup-closed-by-user": "auth.err.popup",
    "auth/cancelled-popup-request": "auth.err.popup",
    "auth/too-many-requests": "auth.err.many",
    "auth/network-request-failed": "auth.err.network",
    "auth/unauthorized-domain": "auth.err.domain",
    "auth/unauthorized-continue-uri": "auth.err.domain"
  };

  function safeNext() {
    var next = new URLSearchParams(window.location.search).get("next") || "";
    if (!/^\/(?!\/)/.test(next) || /^\/(login|register|forgot)\b/.test(next)) return "/me";
    return next;
  }

  function authReady() {
    if (window.MindsetAuth) return Promise.resolve(window.MindsetAuth);
    return new Promise(function (resolve) {
      window.addEventListener("mindset-auth", function () {
        resolve(window.MindsetAuth);
      }, { once: true });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    var form = document.querySelector("#auth-form");
    var status = document.querySelector("#auth-status");
    var google = document.querySelector("#google");
    var adult = document.querySelector("#adult");
    var next = safeNext();

    document.querySelectorAll("[data-keep-next]").forEach(function (link) {
      if (next !== "/me") link.href = link.getAttribute("href") + "?next=" + encodeURIComponent(next);
    });

    function busy(on) {
      form.querySelectorAll("input, button").forEach(function (node) {
        node.disabled = on;
      });
      if (google) google.disabled = on;
    }

    function fail(error) {
      busy(false);
      var key = ERRORS[error && error.code];
      ui.setStatus(status, key ? t(key) : (error && error.message) || t("common.error"), "error");
    }

    function done() {
      window.location.replace(next);
    }

    function adultOk() {
      if (!adult || adult.checked) return true;
      ui.setStatus(status, t("auth.adultRequired"), "error");
      adult.focus();
      return false;
    }

    authReady().then(function (auth) {
      auth.ready.then(function (user) {
        if (user && page !== "forgot") done();
      });
    });

    if (google) {
      google.addEventListener("click", function () {
        if (!adultOk()) return;
        busy(true);
        ui.setStatus(status, "");
        authReady()
          .then(function (auth) {
            return auth.google();
          })
          .then(function (result) {
            if (result) done();
          })
          .catch(fail);
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = form.querySelector("#email").value.trim();
      var passwordInput = form.querySelector("#password");
      var password = passwordInput ? passwordInput.value : "";
      if (page === "register" && !adultOk()) return;
      busy(true);
      ui.setStatus(status, "");
      authReady()
        .then(function (auth) {
          if (page === "forgot") {
            return auth.reset(email).then(function () {
              busy(false);
              ui.setStatus(status, t("auth.resetSent"));
            });
          }
          var action = page === "register" ? auth.register : auth.signIn;
          return action(email, password).then(done);
        })
        .catch(function (error) {
          if (page === "forgot" && error && error.code === "auth/user-not-found") {
            busy(false);
            ui.setStatus(status, t("auth.resetSent"));
            return;
          }
          fail(error);
        });
    });
  });
})();

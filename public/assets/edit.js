(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var privacy = window.MindsetPrivacy;
  var math = window.MindsetReading;
  var demo = window.MindsetDemographics;
  var i18n = window.MindsetI18n;
  var t = i18n.t;

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.querySelector("#mindset-form");
    var status = document.querySelector("#form-status");
    var loginHint = document.querySelector("#login-hint");
    var dialog = document.querySelector("#publish-dialog");
    var readButton = document.querySelector("#read");
    var publishButton = document.querySelector("#publish");
    var nextButton = document.querySelector("#next");
    var backButton = document.querySelector("#back");
    var aliasSection = document.querySelector("#alias-section");
    var aliasInput = document.querySelector("#alias");
    var suggestBox = document.querySelector("#demo-suggest");
    var suggestText = document.querySelector("#demo-suggest-text");
    var suggestApply = document.querySelector("#demo-suggest-apply");
    var reading = null;
    var dirty = true;
    var existingNumber = null;
    var needsAlias = true;
    var findings = {};
    var step = 1;
    var pendingSuggest = null;

    ui.renderForm(document.querySelector("#open-fields"), document.querySelector("#closed-fields"));
    ui.renderDemoForm(document.querySelector("#demo-fields"));
    document.querySelector("#preview-guide").innerHTML = ui.howToReadHtml(true);
    ui.closeOnBackdrop(dialog);
    document.querySelector("#login-link").href = ui.loginHref();

    function isTextField(id) {
      return window.MindsetLens.fields.some(function (field) {
        return field.key === id;
      });
    }

    function scanField(id) {
      var input = form.querySelector("#" + id);
      var found = privacy.scan(input ? input.value : "");
      if (found.length) findings[id] = found;
      else delete findings[id];
      ui.renderLeaks(form, findings);
    }

    form.addEventListener("input", function (event) {
      var id = event.target && event.target.id;
      if (!isTextField(id)) return;
      dirty = true;
      reading = null;
      ui.updateCount(form, id);
      scanField(id);
    });

    function firstBlockingField() {
      return window.MindsetLens.fields.find(function (field) {
        return privacy.blocks(findings[field.key] || []);
      });
    }

    function guardPrivacy() {
      window.MindsetLens.fields.forEach(function (field) {
        scanField(field.key);
      });
      var blocking = firstBlockingField();
      if (!blocking) return true;
      ui.setStatus(status, t("privacy.blocked"), "error");
      var input = form.querySelector("#" + blocking.key);
      if (input) input.focus();
      return false;
    }

    async function checkAlias() {
      if (!needsAlias) return "";
      var value = social.cleanAlias(aliasInput.value);
      if (!social.ALIAS_PATTERN.test(value)) {
        aliasInput.focus();
        throw Object.assign(new Error("alias"), { i18n: "me.aliasInvalid" });
      }
      var session = await store.getOptionalSession();
      if (session && !(await social.aliasFree(value, session))) {
        aliasInput.focus();
        throw Object.assign(new Error("alias"), { i18n: "me.aliasTaken" });
      }
      return value;
    }

    function showPreview(scores) {
      var texts = ui.collectTexts(form);
      var label = existingNumber || t("common.preview");
      var headline = math.deriveHeadline(texts);
      var blurb = math.deriveBlurb(label, texts, scores, i18n.lang);
      var headlineNode = document.querySelector("#preview-headline");
      headlineNode.textContent = headline;
      headlineNode.hidden = !headline;
      document.querySelector("#preview-summary").textContent = blurb;
      ui.renderRadar(document.querySelector("#preview-radar"), scores);
      ui.renderBars(document.querySelector("#preview-open"), scores, math.OPEN_KEYS);
      ui.renderBars(document.querySelector("#preview-closed"), scores, math.CLOSED_KEYS);
    }

    async function runRead() {
      var texts = ui.collectTexts(form);
      readButton.disabled = true;
      publishButton.disabled = true;
      ui.setStatus(status, t("create.reading"));
      reading = await window.MindsetScore.read(texts, function (message) {
        ui.setStatus(status, message);
      });
      dirty = false;
      showPreview(reading);
      ui.setStatus(status, t("create.ready"));
      return texts;
    }

    function refreshSuggest() {
      var texts = {};
      try {
        texts = ui.collectTexts(form);
      } catch (error) {
        texts = {};
      }
      var joined = [texts.currentPosition, texts.personalCode, texts.selfNarrative].join("\n");
      var suggested = demo.suggestFromText(joined);
      var current = ui.collectDemo(form);
      var parts = [];
      pendingSuggest = {};
      ["ageBand", "gender", "country", "city"].forEach(function (key) {
        if (suggested[key] && !current[key]) {
          pendingSuggest[key] = suggested[key];
          if (key === "gender") parts.push(t("gender." + suggested[key]));
          else if (key === "country") parts.push(i18n.countryName(suggested[key]));
          else parts.push(suggested[key]);
        }
      });
      if (!parts.length) {
        suggestBox.hidden = true;
        pendingSuggest = null;
        return;
      }
      suggestText.textContent = t("create.suggest", { what: parts.join(" · ") });
      suggestBox.hidden = false;
    }

    suggestApply.addEventListener("click", function () {
      if (!pendingSuggest) return;
      var current = ui.collectDemo(form);
      ui.fillDemo(form, Object.assign({}, current, pendingSuggest));
      suggestBox.hidden = true;
      pendingSuggest = null;
    });

    function go(next) {
      step = next;
      form.querySelectorAll(".wizard-pane").forEach(function (pane) {
        pane.hidden = Number(pane.getAttribute("data-step")) !== step;
      });
      document.querySelectorAll(".wizard-step").forEach(function (button) {
        var n = Number(button.getAttribute("data-go"));
        button.classList.toggle("is-active", n === step);
        if (n === step) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      });
      backButton.hidden = step === 1;
      nextButton.hidden = step === 3;
      readButton.hidden = step !== 3;
      publishButton.hidden = step !== 3;
      if (step === 2) refreshSuggest();
      if (step === 3 && reading && !dirty) showPreview(reading);
      window.scrollTo(0, 0);
    }

    document.querySelectorAll("[data-go]").forEach(function (button) {
      button.addEventListener("click", function () {
        go(Number(button.getAttribute("data-go")));
      });
    });

    backButton.addEventListener("click", function () {
      go(Math.max(1, step - 1));
    });

    nextButton.addEventListener("click", function () {
      if (step === 1) {
        if (!guardPrivacy()) return;
        try {
          ui.collectTexts(form);
        } catch (error) {
          ui.setStatus(status, ui.errorText(error), "error");
          return;
        }
        checkAlias()
          .then(function () {
            ui.setStatus(status, "");
            go(2);
          })
          .catch(function (error) {
            ui.setStatus(status, ui.errorText(error), "error");
          });
        return;
      }
      go(Math.min(3, step + 1));
    });

    readButton.addEventListener("click", function () {
      loginHint.hidden = true;
      if (!guardPrivacy()) return;
      runRead()
        .catch(function (error) {
          ui.setStatus(status, ui.errorText(error, "error.read_failed"), "error");
        })
        .finally(function () {
          readButton.disabled = false;
          publishButton.disabled = false;
        });
    });

    publishButton.addEventListener("click", function () {
      loginHint.hidden = true;
      if (!guardPrivacy()) return;
      publishButton.disabled = true;
      checkAlias()
        .then(function () {
          return !reading || dirty ? runRead() : ui.collectTexts(form);
        })
        .then(function () {
          dialog.showModal();
        })
        .catch(function (error) {
          ui.setStatus(status, ui.errorText(error, "error.read_failed"), "error");
        })
        .finally(function () {
          readButton.disabled = false;
          publishButton.disabled = false;
        });
    });

    dialog.addEventListener("close", function () {
      if (dialog.returnValue !== "confirm" || !reading) return;
      var texts;
      try {
        texts = ui.collectTexts(form);
      } catch (error) {
        ui.setStatus(status, ui.errorText(error), "error");
        return;
      }
      if (!guardPrivacy()) return;
      var demoValues = ui.collectDemo(form);
      var alias = needsAlias ? social.cleanAlias(aliasInput.value) : "";
      publishButton.disabled = true;
      ui.setStatus(status, t("common.saving"));
      store
        .requireSession()
        .then(function (session) {
          return store.publish(session, texts, reading, demoValues, alias);
        })
        .then(function (result) {
          if (result.aliasError) sessionStorage.setItem("mindset-warning", "create.aliasWarning");
          else if (result.warning) sessionStorage.setItem("mindset-warning", "create.publishWarning");
          window.location.assign("/i/" + result.number);
        })
        .catch(function (error) {
          publishButton.disabled = false;
          ui.setStatus(status, ui.errorText(error, "error.save_failed"), "error");
          if (error && error.code === "login_required") loginHint.hidden = false;
        });
    });

    function setNeedsAlias(value) {
      needsAlias = value;
      aliasSection.hidden = !value;
      aliasInput.required = value;
    }

    store
      .getOptionalSession()
      .then(async function (session) {
        if (!session) return;
        var own = await store.findOwn(session.uid, session.idToken);
        if (!own) return;
        existingNumber = own.publicDoc.id;
        var entry = await social.aliasOf(existingNumber, session.idToken);
        setNeedsAlias(!(entry && entry.alias));
        document.querySelector("#heading").textContent = t("create.edit", { n: existingNumber });
        var privateDoc = own.privateDoc || {};
        ui.fillTexts(form, {
          currentPosition: own.publicDoc.currentPosition,
          personalCode: own.publicDoc.personalCode,
          selfNarrative: own.publicDoc.selfNarrative,
          unsayableAttitude: privateDoc.unsayableAttitude,
          desireScript: privateDoc.desireScript,
          disownedSelf: privateDoc.disownedSelf
        });
        ui.fillDemo(form, math.demoOf(own.publicDoc, own.privateDoc));
        window.MindsetLens.fields.forEach(function (field) {
          scanField(field.key);
        });
        var scores = math.scoresOf(own.publicDoc);
        var closed = math.scoresOf(own.privateDoc);
        math.CLOSED_KEYS.forEach(function (key) {
          scores[key] = closed[key];
        });
        if (own.publicDoc.lens === window.MindsetLens.version) {
          reading = scores;
          dirty = false;
        }
        showPreview(scores);
        ui.setStatus(status, t("create.loaded"));
      })
      .catch(function (error) {
        ui.setStatus(status, ui.errorText(error), "error");
      });

    setNeedsAlias(true);
    go(1);
    window.MindsetLens.fields.forEach(function (field) {
      ui.updateCount(form, field.key);
    });
  });
})();

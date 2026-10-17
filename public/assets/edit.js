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
    var step = 0;
    var pendingSuggest = null;
    var pendingHistory = "none";
    var historyPanel = document.querySelector("#publish-history");
    var historyChoices = document.querySelector("#publish-history-choices");
    var startButton = document.querySelector("#start");
    var stepsNav = document.querySelector(".wizard-steps");
    var statusBase = { message: "", kind: "", readingHelp: false };
    var statusLine = document.querySelector("#form-status-line");
    var readingWhat = document.querySelector("#reading-what");

    ui.requireAuth().then(function (session) {
      if (!session) return;
      boot(session);
    });

    function paintStatus() {
      if (statusBase.message) {
        status.textContent = statusBase.message;
        status.className = "status" + (statusBase.kind ? " " + statusBase.kind : "");
        if (statusLine) statusLine.hidden = false;
        if (readingWhat) readingWhat.hidden = !statusBase.readingHelp;
        return;
      }
      var leak = ui.leakStatus(findings);
      if (leak) {
        status.textContent = leak.message;
        status.className = "status " + leak.kind;
        if (statusLine) statusLine.hidden = false;
        if (readingWhat) readingWhat.hidden = true;
        return;
      }
      status.textContent = "";
      status.className = "status";
      if (statusLine) statusLine.hidden = true;
      if (readingWhat) readingWhat.hidden = true;
    }

    function setFormStatus(message, kind, options) {
      statusBase = {
        message: message || "",
        kind: kind || "",
        readingHelp: Boolean(options && options.readingHelp)
      };
      paintStatus();
    }

    function boot(session) {
    ui.renderForm(document.querySelector("#open-fields"), document.querySelector("#closed-fields"));
    ui.renderDemoForm(document.querySelector("#demo-fields"));
    wireEnterHints();
    ui.closeOnBackdrop(dialog);
    var howDialog = document.querySelector("#how-to-read-dialog");
    if (howDialog) ui.closeOnBackdrop(howDialog);
    var whatReadingDialog = document.querySelector("#what-is-reading-dialog");
    if (whatReadingDialog) ui.closeOnBackdrop(whatReadingDialog);
    var howButton = document.querySelector("#preview-how-to");
    document.querySelector("#login-link").href = ui.loginHref();
    if (readingWhat && whatReadingDialog) {
      readingWhat.addEventListener("click", function () {
        whatReadingDialog.showModal();
      });
    }

    function selectPreviewTab(name) {
      var panes = {
        radar: document.querySelector("#pane-preview-radar"),
        open: document.querySelector("#pane-preview-open"),
        closed: document.querySelector("#pane-preview-closed")
      };
      var tabs = {
        radar: document.querySelector("#tab-preview-radar"),
        open: document.querySelector("#tab-preview-open"),
        closed: document.querySelector("#tab-preview-closed")
      };
      Object.keys(panes).forEach(function (key) {
        var on = key === name;
        if (panes[key]) panes[key].hidden = !on;
        if (tabs[key]) tabs[key].setAttribute("aria-selected", String(on));
      });
    }

    var previewTabs = document.querySelector(".preview-toolbar .depth-tabs");
    if (previewTabs) {
      previewTabs.addEventListener("click", function (event) {
        var tab = event.target.closest("[data-preview-tab]");
        if (!tab) return;
        selectPreviewTab(tab.getAttribute("data-preview-tab"));
      });
    }

    if (howButton && howDialog) {
      howButton.addEventListener("click", function () {
        document.querySelector("#how-to-read-body").innerHTML = ui.howToReadHtml(false, { plain: true });
        howDialog.showModal();
      });
    }

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
      paintStatus();
    }

    form.addEventListener("input", function (event) {
      var id = event.target && event.target.id;
      if (!isTextField(id)) return;
      dirty = true;
      reading = null;
      ui.updateCount(form, id);
      scanField(id);
    });

    var advancingField = false;

    function isMobileWizard() {
      return window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
    }

    function orderedFocusFields() {
      var list = window.MindsetLens.fields
        .map(function (field) {
          return form.querySelector("#" + field.key);
        })
        .filter(Boolean);
      if (aliasInput && !aliasSection.hidden) list.push(aliasInput);
      return list;
    }

    function wireEnterHints() {
      var list = orderedFocusFields();
      list.forEach(function (el, index) {
        el.setAttribute("enterkeyhint", index < list.length - 1 ? "next" : "done");
      });
    }

    function focusNextField(from) {
      var list = orderedFocusFields();
      var index = list.indexOf(from);
      if (index < 0 || index >= list.length - 1) return false;
      advancingField = true;
      list[index + 1].focus();
      window.setTimeout(function () {
        advancingField = false;
      }, 0);
      return true;
    }

    // Native field height on mobile. Only advance when the user finishes a field (Next / Return).
    form.addEventListener("focusout", function (event) {
      var el = event.target;
      if (!el || !isMobileWizard() || step !== 1) return;
      if (advancingField) return;
      if (event.relatedTarget) return;
      if (el.getAttribute("enterkeyhint") !== "next") return;
      if (el.tagName === "TEXTAREA" && isTextField(el.id)) {
        focusNextField(el);
        return;
      }
      if (el === aliasInput) focusNextField(el);
    });

    form.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.shiftKey) return;
      var el = event.target;
      if (!el || !isMobileWizard() || step !== 1) return;
      if (el.tagName === "TEXTAREA" && isTextField(el.id) && el.getAttribute("enterkeyhint") === "next") {
        event.preventDefault();
        focusNextField(el);
        return;
      }
      if (el === aliasInput && el.getAttribute("enterkeyhint") === "next") {
        event.preventDefault();
        focusNextField(el);
      }
    });

    form.addEventListener("beforeinput", function (event) {
      if (!isMobileWizard() || step !== 1) return;
      if (event.inputType !== "insertLineBreak" && event.inputType !== "insertParagraph") return;
      if (event.shiftKey) return;
      var el = event.target;
      if (!el || el.tagName !== "TEXTAREA" || !isTextField(el.id)) return;
      if (el.getAttribute("enterkeyhint") !== "next") return;
      event.preventDefault();
      focusNextField(el);
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
      paintStatus();
      if (statusLine && statusLine.hidden) setFormStatus(t("privacy.blocked"), "error");
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

    function showPreviewPending() {
      var host = document.querySelector("#preview-entry");
      host.hidden = false;
      host.className = "entry entry-pending";
      host.removeAttribute("data-id");
      host.innerHTML =
        '<p class="preview-pending" role="status">' + ui.escapeHtml(t("create.reading")) + "</p>";
      var radar = document.querySelector("#preview-radar");
      var open = document.querySelector("#preview-open");
      var closed = document.querySelector("#preview-closed");
      if (radar) {
        radar.innerHTML =
          '<p class="hint preview-pending" role="status">' + ui.escapeHtml(t("create.reading")) + "</p>";
      }
      if (open) open.innerHTML = "";
      if (closed) closed.innerHTML = "";
    }

    function showPreview(scores) {
      var texts = ui.collectTexts(form);
      var demo = ui.collectDemo(form);
      var label = existingNumber || t("common.preview");
      var headline = math.deriveHeadline(texts);
      var blurb = math.deriveBlurb(label, texts, scores, i18n.lang);
      var previewDoc = {
        id: existingNumber || "",
        ownerUid: session && session.uid,
        headline: headline,
        blurb: blurb,
        personalCode: texts.personalCode,
        currentPosition: texts.currentPosition,
        agency: scores.agency,
        communion: scores.communion,
        codeClarity: scores.codeClarity,
        redemption: scores.redemption,
        ageBand: demo.ageBand,
        gender: demo.gender,
        country: demo.country,
        createdAt: existingNumber ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      var host = document.querySelector("#preview-entry");
      host.innerHTML = ui.card(previewDoc, {
        preview: true,
        tag: existingNumber ? "" : t("common.preview")
      });
      // card() returns a full .entry root; unwrap into the host.
      var built = host.querySelector(".entry");
      if (built) {
        host.className = built.className;
        host.innerHTML = built.innerHTML;
        if (existingNumber) host.setAttribute("data-id", String(existingNumber));
        else host.removeAttribute("data-id");
      }
      host.hidden = false;
      var radarHost = host.querySelector(".entry-radar");
      if (radarHost) ui.renderRadar(radarHost, scores, null, { compact: true });
      ui.renderRadar(document.querySelector("#preview-radar"), scores, null, {
        keys: math.OPEN_KEYS.concat(math.CLOSED_KEYS)
      });
      ui.renderBars(document.querySelector("#preview-open"), scores, math.OPEN_KEYS);
      ui.renderBars(document.querySelector("#preview-closed"), scores, math.CLOSED_KEYS);
    }

    async function runRead() {
      var texts = ui.collectTexts(form);
      publishButton.disabled = true;
      showPreviewPending();
      setFormStatus(t("create.reading"));
      reading = await window.MindsetScore.read(texts, function (message) {
        setFormStatus(message || t("create.reading"));
      });
      dirty = false;
      showPreview(reading);
      setFormStatus(t("create.ready"));
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
      if (next === 3 && !guardPrivacy()) next = 1;
      step = next;
      form.querySelectorAll(".wizard-pane").forEach(function (pane) {
        pane.hidden = Number(pane.getAttribute("data-step")) !== step;
      });
      if (stepsNav) stepsNav.hidden = step === 0;
      document.querySelectorAll(".wizard-step").forEach(function (button) {
        var n = Number(button.getAttribute("data-go"));
        button.classList.toggle("is-active", n === step);
        if (n === step) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      });
      if (startButton) startButton.hidden = step !== 0;
      backButton.hidden = step < 1;
      nextButton.hidden = step === 0 || step === 3;
      publishButton.hidden = step !== 3;
      if (step === 2) refreshSuggest();
      if (step === 3) {
        loginHint.hidden = true;
        if (reading && !dirty) {
          showPreview(reading);
        } else {
          runRead().catch(function (error) {
            setFormStatus(ui.errorText(error, "error.read_failed"), "error");
          }).finally(function () {
            publishButton.disabled = false;
          });
        }
      }
      window.scrollTo(0, 0);
    }

    document.querySelectorAll("[data-go]").forEach(function (button) {
      button.addEventListener("click", function () {
        var n = Number(button.getAttribute("data-go"));
        if (n >= 1 && n <= 3) go(n);
      });
    });

    if (startButton) {
      startButton.addEventListener("click", function () {
        go(1);
      });
    }

    backButton.addEventListener("click", function () {
      go(Math.max(0, step - 1));
    });

    nextButton.addEventListener("click", function () {
      if (step === 1) {
        if (!guardPrivacy()) return;
        try {
          ui.collectTexts(form);
        } catch (error) {
          setFormStatus(ui.errorText(error), "error");
          return;
        }
        checkAlias()
          .then(function () {
            setFormStatus("");
            go(2);
          })
          .catch(function (error) {
            setFormStatus(ui.errorText(error), "error");
          });
        return;
      }
      go(Math.min(3, step + 1));
    });

    function syncPublishHistoryUi() {
      pendingHistory = math.historyLevel(pendingHistory);
      if (historyPanel) historyPanel.open = true;
      if (!historyChoices) return;
      var current = historyChoices.querySelector(
        'input[name="publish-history"][value="' + pendingHistory + '"]'
      );
      if (current) current.checked = true;
      else {
        pendingHistory = "none";
        var fallback = historyChoices.querySelector('input[name="publish-history"][value="none"]');
        if (fallback) fallback.checked = true;
      }
    }

    if (historyChoices) {
      historyChoices.addEventListener("change", function (event) {
        if (event.target.name !== "publish-history") return;
        var level = math.historyLevel(event.target.value);
        var previous = pendingHistory;
        pendingHistory = level;
        if (!existingNumber) return;
        store
          .setHistory(session, level)
          .then(function (saved) {
            pendingHistory = saved;
          })
          .catch(function () {
            pendingHistory = previous;
            var revert = historyChoices.querySelector(
              'input[name="publish-history"][value="' + previous + '"]'
            );
            if (revert) revert.checked = true;
          });
      });
    }

    publishButton.addEventListener("click", function () {
      loginHint.hidden = true;
      if (!guardPrivacy()) return;
      publishButton.disabled = true;
      checkAlias()
        .then(function () {
          return !reading || dirty ? runRead() : ui.collectTexts(form);
        })
        .then(function () {
          syncPublishHistoryUi();
          dialog.showModal();
        })
        .catch(function (error) {
          setFormStatus(ui.errorText(error, "error.read_failed"), "error");
        })
        .finally(function () {
          publishButton.disabled = false;
        });
    });

    dialog.addEventListener("close", function () {
      if (dialog.returnValue !== "confirm" || !reading) return;
      var texts;
      try {
        texts = ui.collectTexts(form);
      } catch (error) {
        setFormStatus(ui.errorText(error), "error");
        return;
      }
      if (!guardPrivacy()) return;
      var demoValues = ui.collectDemo(form);
      var alias = needsAlias ? social.cleanAlias(aliasInput.value) : "";
      publishButton.disabled = true;
      setFormStatus(t("common.saving"));
      store
        .requireSession()
        .then(function (session) {
          return store.publish(session, texts, reading, demoValues, alias, pendingHistory);
        })
        .then(function (result) {
          if (result.aliasError) sessionStorage.setItem("mindset-warning", "create.aliasWarning");
          else if (result.warning) sessionStorage.setItem("mindset-warning", "create.publishWarning");
          window.location.assign("/i/" + result.number);
        })
        .catch(function (error) {
          publishButton.disabled = false;
          setFormStatus(ui.errorText(error, "error.save_failed"), "error");
          if (error && error.code === "login_required") loginHint.hidden = false;
        });
    });

    function setNeedsAlias(value) {
      needsAlias = value;
      aliasSection.hidden = !value;
      aliasInput.required = value;
      wireEnterHints();
    }

    store
      .findOwn(session.uid, session.idToken)
      .then(async function (own) {
        if (!own) return;
        existingNumber = own.publicDoc.id;
        pendingHistory = math.historyLevel(own.publicDoc.history);
        var entry = await social.aliasOf(existingNumber, session.idToken);
        setNeedsAlias(!(entry && entry.alias));
        document.querySelector("#heading").textContent = t("create.edit");
        ui.setCrumb(t("create.edit"));
        var editMeta = document.querySelector("#edit-meta");
        if (editMeta) {
          editMeta.removeAttribute("data-i18n");
          editMeta.textContent =
            "#" +
            existingNumber +
            (own.publicDoc.updatedAt ? " · " + ui.relativeWhen(own.publicDoc.updatedAt) : "");
        }
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
        setFormStatus(t("create.loaded"), "", { readingHelp: true });
      })
      .catch(function (error) {
        setFormStatus(ui.errorText(error), "error");
      });

    setNeedsAlias(true);
    go(0);
    window.MindsetLens.fields.forEach(function (field) {
      ui.updateCount(form, field.key);
    });
    } // boot
  });
})();

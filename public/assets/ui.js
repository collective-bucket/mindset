(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function axisByKey(key) {
    return window.MindsetLens.axes.find(function (axis) {
      return axis.key === key;
    });
  }

  function formatWhen(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function setStatus(element, message, kind) {
    if (!element) return;
    element.textContent = message || "";
    element.className = "status" + (kind ? " " + kind : "");
    element.hidden = !message;
  }

  function bar(axis, score) {
    var unknown = typeof score !== "number" || score < 0;
    if (unknown) {
      return (
        '<div class="bar-row is-unknown">' +
        '<div class="bar-label"><span>' +
        escapeHtml(axis.label) +
        "</span><span>belirsiz</span></div></div>"
      );
    }
    return (
      '<div class="bar-row">' +
      '<div class="bar-label"><span>' +
      escapeHtml(axis.label) +
      "</span><span>" +
      score +
      "</span></div>" +
      '<div class="bar-track"><div class="bar-fill" style="width:' +
      score +
      '%"></div></div>' +
      '<div class="bar-poles"><span>' +
      escapeHtml(axis.lowLabel) +
      "</span><span>" +
      escapeHtml(axis.highLabel) +
      "</span></div></div>"
    );
  }

  function renderBars(container, scores, keys) {
    container.innerHTML = keys
      .map(function (key) {
        return bar(axisByKey(key), scores[key]);
      })
      .join("");
  }

  function radarPoint(cx, cy, radius, index, count, value) {
    var angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    var span = radius * (Math.max(0, value) / 100);
    return [cx + Math.cos(angle) * span, cy + Math.sin(angle) * span];
  }

  function renderRadar(container, scores) {
    var keys = window.MindsetReading.OPEN_KEYS;
    var known = keys.filter(function (key) {
      return scores[key] >= 0;
    });
    if (known.length < keys.length) {
      container.innerHTML = "";
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var cx = 160;
    var cy = 150;
    var radius = 88;
    var rings = [0.25, 0.5, 0.75, 1]
      .map(function (scale) {
        var points = keys
          .map(function (key, index) {
            return radarPoint(cx, cy, radius * scale, index, keys.length, 100).join(",");
          })
          .join(" ");
        return '<polygon class="radar-ring" points="' + points + '"></polygon>';
      })
      .join("");
    var spokes = keys
      .map(function (key, index) {
        var end = radarPoint(cx, cy, radius, index, keys.length, 100);
        return (
          '<line class="radar-spoke" x1="' +
          cx +
          '" y1="' +
          cy +
          '" x2="' +
          end[0] +
          '" y2="' +
          end[1] +
          '"></line>'
        );
      })
      .join("");
    var shape = keys
      .map(function (key, index) {
        var value = scores[key] >= 0 ? scores[key] : 0;
        return radarPoint(cx, cy, radius, index, keys.length, value).join(",");
      })
      .join(" ");
    var labels = keys
      .map(function (key, index) {
        var axis = axisByKey(key);
        var spot = radarPoint(cx, cy, radius + 28, index, keys.length, 100);
        var anchor = "middle";
        if (spot[0] < cx - 20) anchor = "end";
        if (spot[0] > cx + 20) anchor = "start";
        return (
          '<text class="radar-label" x="' +
          spot[0] +
          '" y="' +
          spot[1] +
          '" text-anchor="' +
          anchor +
          '">' +
          escapeHtml(axis.label) +
          "</text>"
        );
      })
      .join("");
    container.innerHTML =
      '<svg class="radar" viewBox="0 0 320 300" role="img" aria-label="Açık okuma">' +
      rings +
      spokes +
      '<polygon class="radar-shape" points="' +
      shape +
      '"></polygon>' +
      labels +
      "</svg>";
  }

  function renderOpenTexts(container, doc) {
    var html = window.MindsetLens.fields
      .filter(function (field) {
        return field.open && doc[field.key];
      })
      .map(function (field) {
        return (
          '<section class="text-block"><h2>' +
          escapeHtml(field.label) +
          "</h2><p>" +
          escapeHtml(doc[field.key]) +
          "</p></section>"
        );
      })
      .join("");
    container.innerHTML = html;
  }

  function fieldControl(field) {
    return (
      '<label class="field" for="' +
      field.key +
      '"><span>' +
      escapeHtml(field.label) +
      '</span><textarea id="' +
      field.key +
      '" name="' +
      field.key +
      '" rows="' +
      field.rows +
      '" maxlength="1200" placeholder="' +
      escapeHtml(field.placeholder) +
      '"></textarea><small data-count-for="' +
      field.key +
      '">0 / 1200</small></label>'
    );
  }

  function renderForm(openHost, closedHost) {
    var open = window.MindsetLens.fields.filter(function (field) {
      return field.open;
    });
    var closed = window.MindsetLens.fields.filter(function (field) {
      return !field.open;
    });
    openHost.innerHTML = open.map(fieldControl).join("");
    closedHost.innerHTML = closed.map(fieldControl).join("");
  }

  function collectTexts(form) {
    var raw = {};
    window.MindsetLens.fields.forEach(function (field) {
      var input = form.querySelector("#" + field.key);
      raw[field.key] = input ? input.value : "";
    });
    return window.MindsetReading.normalizeTexts(raw);
  }

  function fillTexts(form, texts) {
    window.MindsetLens.fields.forEach(function (field) {
      var input = form.querySelector("#" + field.key);
      if (input) input.value = (texts && texts[field.key]) || "";
      updateCount(form, field.key);
    });
  }

  function updateCount(form, key) {
    var input = form.querySelector("#" + key);
    var count = form.querySelector('[data-count-for="' + key + '"]');
    if (!input || !count) return;
    count.textContent = input.value.length + " / 1200";
  }

  function isPermission(error) {
    return /permission/i.test(String((error && error.message) || ""));
  }

  window.MindsetUi = {
    escapeHtml: escapeHtml,
    formatWhen: formatWhen,
    setStatus: setStatus,
    renderBars: renderBars,
    renderRadar: renderRadar,
    renderOpenTexts: renderOpenTexts,
    renderForm: renderForm,
    collectTexts: collectTexts,
    fillTexts: fillTexts,
    updateCount: updateCount,
    isPermission: isPermission
  };
})();

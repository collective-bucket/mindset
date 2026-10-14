(function () {
  "use strict";

  function renderHistogram(container, stats) {
    var axes = window.MindsetLens.axes.filter(function (axis) {
      return axis.open;
    });
    if (!stats || !stats.axes) {
      container.innerHTML = "<p class=\"hint\">Henüz dağılım yok.</p>";
      return;
    }
    container.innerHTML = axes
      .map(function (axis) {
        var buckets = stats.axes[axis.key] || {};
        var counts = ["b0", "b1", "b2", "b3", "b4"].map(function (key) {
          return Number(buckets[key] || 0);
        });
        var max = Math.max.apply(null, counts.concat([1]));
        var bars = counts
          .map(function (count, index) {
            var height = Math.round((count / max) * 100);
            return (
              '<div class="hist-col"><div class="hist-bar" style="height:' +
              height +
              '%"></div><span>' +
              index * 20 +
              "</span><small>" +
              count +
              "</small></div>"
            );
          })
          .join("");
        return (
          '<div class="hist"><h3>' +
          window.MindsetUi.escapeHtml(axis.label) +
          '</h3><div class="hist-bars">' +
          bars +
          "</div></div>"
        );
      })
      .join("");
  }

  function renderCards(container, rows) {
    if (!rows.length) {
      container.innerHTML = "<p class=\"hint\">Bu süzgece uyan mindset yok.</p>";
      return;
    }
    container.innerHTML = rows
      .map(function (doc) {
        var scores = window.MindsetReading.scoresOf(doc);
        var bits = window.MindsetReading.OPEN_KEYS.map(function (key) {
          var axis = window.MindsetLens.axes.find(function (item) {
            return item.key === key;
          });
          var value = scores[key] >= 0 ? scores[key] : "belirsiz";
          return window.MindsetUi.escapeHtml(axis.label) + " " + value;
        }).join(" · ");
        if (!/^\d+$/.test(String(doc.id || ""))) return "";
        return (
          '<a class="card" href="/m/' +
          doc.id +
          '"><strong>' +
          doc.id +
          ". mindset</strong><span>" +
          bits +
          "</span></a>"
        );
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var axisSelect = document.querySelector("#axis");
    var minSelect = document.querySelector("#min");
    var results = document.querySelector("#results");
    var histogram = document.querySelector("#histogram");

    window.MindsetLens.axes
      .filter(function (axis) {
        return axis.open;
      })
      .forEach(function (axis) {
        var option = document.createElement("option");
        option.value = axis.key;
        option.textContent = axis.label;
        axisSelect.appendChild(option);
      });

    function load() {
      var axis = axisSelect.value;
      if (axis && window.MindsetReading.OPEN_KEYS.indexOf(axis) < 0) axis = "";
      minSelect.disabled = !axis;
      var min = Number(minSelect.value || 0);
      window.MindsetUi.setStatus(status, "Yükleniyor");
      window.MindsetStore.listPublic(axis, min)
        .then(function (rows) {
          renderCards(results, rows);
          window.MindsetUi.setStatus(status, "");
        })
        .catch(function (error) {
          results.innerHTML = "";
          var message = window.MindsetUi.isPermission(error)
            ? "Liste şu an okunamıyor."
            : error.message || "Liste açılamadı.";
          window.MindsetUi.setStatus(status, message, "error");
        });
    }

    axisSelect.addEventListener("change", load);
    minSelect.addEventListener("change", load);

    window.MindsetFirestore.getDocument("stats", "public")
      .then(function (stats) {
        renderHistogram(histogram, stats);
      })
      .catch(function () {
        histogram.innerHTML = "<p class=\"hint\">Dağılım açılamadı.</p>";
      });

    load();
  });
})();

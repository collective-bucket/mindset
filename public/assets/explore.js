(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var math = window.MindsetReading;
  var demo = window.MindsetDemographics;
  var i18n = window.MindsetI18n;
  var t = i18n.t;
  var MIN_GROUP = 5;

  function sliceNode(stats, field, value) {
    if (!stats || !field || !value) return null;
    if (field === "ageBand") return (stats.byAge || {})[demo.ageKey(value)] || null;
    if (field === "gender") return (stats.byGender || {})[value] || null;
    if (field === "country") return (stats.byCountry || {})[value] || null;
    return null;
  }

  function sliceLabel(field, value) {
    if (field === "gender") return t("gender." + value);
    if (field === "country") return i18n.countryName(value);
    return value;
  }

  function shares(buckets) {
    var counts = math.BUCKETS.map(function (key) {
      return Number((buckets || {})[key] || 0);
    });
    var total = counts.reduce(function (sum, value) {
      return sum + value;
    }, 0);
    return counts.map(function (count) {
      return { count: count, share: total ? count / total : 0 };
    });
  }

  function renderAxisCharts(container, stats, axisKey, field, value) {
    if (!stats || !stats.axes) {
      container.innerHTML = '<p class="empty">' + ui.escapeHtml(t("explore.noStats")) + "</p>";
      return;
    }
    var keys = axisKey ? [axisKey] : math.OPEN_KEYS;
    var slice = sliceNode(stats, field, value);
    container.innerHTML = keys
      .map(function (key) {
        var overall = shares(stats.axes[key]);
        var group = slice ? shares(slice[key]) : null;
        var cols = overall
          .map(function (item, index) {
            var groupBar = group
              ? '<div class="hist-bar is-slice" style="height:' + Math.round(group[index].share * 100) + '%"></div>'
              : "";
            return (
              '<div class="hist-col"><div class="hist-bars-pair"><div class="hist-bar" style="height:' +
              Math.round(item.share * 100) +
              '%"></div>' +
              groupBar +
              "</div><span>" +
              index * 20 +
              "</span><small>" +
              (group ? group[index].count : item.count) +
              "</small></div>"
            );
          })
          .join("");
        var legend = group
          ? '<p class="legend"><span class="dot"></span>' +
            ui.escapeHtml(t("explore.everyone")) +
            ' <span class="dot is-slice"></span>' +
            ui.escapeHtml(sliceLabel(field, value)) +
            "</p>"
          : "";
        return (
          '<div class="hist"><h3>' +
          ui.escapeHtml(i18n.pick(ui.axisByKey(key).label)) +
          '</h3><div class="hist-bars">' +
          cols +
          "</div>" +
          legend +
          "</div>"
        );
      })
      .join("");
  }

  function rowChart(container, rows) {
    if (!rows.length) {
      container.innerHTML = '<p class="empty">' + ui.escapeHtml(t("explore.noStats")) + "</p>";
      return;
    }
    var max = Math.max.apply(null, rows.map(function (row) { return row.n; }).concat([1]));
    container.innerHTML =
      '<div class="row-chart">' +
      rows
        .map(function (row) {
          return (
            '<div class="row"><span class="row-label">' +
            ui.escapeHtml(row.label) +
            '</span><div class="row-track"><div class="row-fill" style="width:' +
            Math.round((row.n / max) * 100) +
            '%"></div></div><span class="row-value">' +
            row.n +
            "</span></div>"
          );
        })
        .join("") +
      "</div>";
  }

  function count(node) {
    return Number((node && node.n) || 0);
  }

  function prettyCity(key) {
    var cut = key.indexOf("_");
    var country = key.slice(0, cut);
    var city = key.slice(cut + 1).replace(/_/g, " ");
    var locale = i18n.lang === "tr" ? "tr-TR" : "en-US";
    city = city.replace(/(^|\s)\S/g, function (letter) {
      return letter.toLocaleUpperCase(locale);
    });
    return city + ", " + i18n.countryName(country);
  }

  function top(entries) {
    return entries
      .filter(function (row) {
        return row.n >= MIN_GROUP;
      })
      .sort(function (left, right) {
        return right.n - left.n;
      })
      .slice(0, 10);
  }

  function renderDemoCharts(stats) {
    stats = stats || {};
    rowChart(
      document.querySelector("#age-chart"),
      demo.AGE_BANDS.map(function (band) {
        return { label: band.id, n: count((stats.byAge || {})[band.key]) };
      }).filter(function (row) {
        return row.n > 0;
      })
    );
    rowChart(
      document.querySelector("#gender-chart"),
      demo.GENDERS.map(function (gender) {
        return { label: t("gender." + gender), n: count((stats.byGender || {})[gender]) };
      }).filter(function (row) {
        return row.n > 0;
      })
    );
    rowChart(
      document.querySelector("#country-chart"),
      top(
        Object.keys(stats.byCountry || {}).map(function (code) {
          return { label: i18n.countryName(code), n: count(stats.byCountry[code]) };
        })
      )
    );
    rowChart(
      document.querySelector("#city-chart"),
      top(
        Object.keys(stats.cities || {}).map(function (key) {
          return { label: prettyCity(key), n: Number(stats.cities[key] || 0) };
        })
      )
    );
    document.querySelector("#total").textContent = t("explore.total", { n: Number(stats.count || 0) });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var axisSelect = document.querySelector("#axis");
    var minSelect = document.querySelector("#min");
    var sliceSelect = document.querySelector("#slice");
    var valueSelect = document.querySelector("#slice-value");
    var results = document.querySelector("#results");
    var stats = null;

    window.MindsetLens.axes
      .filter(function (axis) {
        return axis.open;
      })
      .forEach(function (axis) {
        var option = document.createElement("option");
        option.value = axis.key;
        option.textContent = i18n.pick(axis.label);
        axisSelect.appendChild(option);
      });

    function fillValues() {
      var kind = sliceSelect.value;
      valueSelect.disabled = !kind;
      valueSelect.innerHTML = kind ? ui.demoOptions(kind, t("explore.everyone")) : "";
    }

    function charts() {
      renderAxisCharts(
        document.querySelector("#axis-chart"),
        stats,
        axisSelect.value,
        sliceSelect.value,
        valueSelect.value
      );
    }

    function load() {
      var axis = axisSelect.value;
      minSelect.disabled = !axis;
      ui.setStatus(status, t("common.loading"));
      store
        .listPublic({
          axis: axis,
          min: Number(minSelect.value || 0),
          sliceField: sliceSelect.value,
          sliceValue: valueSelect.value
        })
        .then(function (rows) {
          ui.renderCards(results, rows, "explore.empty");
          ui.setStatus(status, "");
        })
        .catch(function (error) {
          results.innerHTML = "";
          var message = window.MindsetFirestore.isPermission(error) ? t("explore.cantRead") : ui.errorText(error);
          ui.setStatus(status, message, "error");
        });
      charts();
    }

    axisSelect.addEventListener("change", load);
    minSelect.addEventListener("change", load);
    sliceSelect.addEventListener("change", function () {
      fillValues();
      load();
    });
    valueSelect.addEventListener("change", load);

    fillValues();
    store
      .getStats()
      .then(function (next) {
        stats = next;
        renderDemoCharts(stats);
        charts();
      })
      .catch(function () {
        renderDemoCharts(null);
        charts();
      });

    load();
  });
})();

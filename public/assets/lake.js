(function () {
  "use strict";

  var ui = window.MindsetUi;
  var store = window.MindsetStore;
  var social = window.MindsetSocial;
  var math = window.MindsetReading;
  var demo = window.MindsetDemographics;
  var i18n = window.MindsetI18n;
  var t = i18n.t;

  var POOL_SIZE = 500;
  var MIN_GROUP = 5;
  var FULL = { x: -6, y: -6, w: 112, h: 112 };
  var MIN_SPAN = 18;
  var SVG_NS = "http://www.w3.org/2000/svg";

  function openAxes() {
    return window.MindsetLens.axes.filter(function (axis) {
      return axis.open;
    });
  }

  // Small deterministic offset so identical readings don't stack exactly.
  function jitter(id, salt) {
    var value = Math.sin(Number(id) * 12.9898 + salt * 78.233) * 43758.5453;
    return (value - Math.floor(value) - 0.5) * 2.4;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // ---- Bucket charts -------------------------------------------------------

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

  function renderAxisCharts(container, stats, field, value) {
    if (!stats || !stats.axes) {
      container.innerHTML = '<p class="empty">' + ui.escapeHtml(t("explore.noStats")) + "</p>";
      return;
    }
    var slice = sliceNode(stats, field, value);
    container.innerHTML = math.OPEN_KEYS.map(function (key) {
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
            "</span></div>"
          );
        })
        .join("");
      var legend = group
        ? '<p class="legend"><span class="key"></span>' +
          ui.escapeHtml(t("explore.everyone")) +
          ' <span class="key is-slice"></span>' +
          ui.escapeHtml(sliceLabel(field, value)) +
          "</p>"
        : "";
      return (
        '<div class="hist"><div class="hist-bars">' +
        cols +
        '</div><h3 class="dist-title">' +
        ui.escapeHtml(i18n.pick(ui.axisByKey(key).label)) +
        "</h3>" +
        legend +
        "</div>"
      );
    }).join("");
  }

  var demoGroups = { age: [], gender: [], country: [], city: [] };
  var demoKey = "age";

  function sliceColor(index, count) {
    var tMix = count <= 1 ? 0 : index / (count - 1);
    var deep = Math.round(100 - tMix * 72);
    return "color-mix(in srgb, var(--accent-deep) " + deep + "%, var(--paper))";
  }

  function clipSliceLabel(label) {
    return label.length > 12 ? label.slice(0, 12) : label;
  }

  function labelFits(mid, sweep, width, radius) {
    var labelR = radius * 0.58;
    var lx = Math.cos(mid) * labelR;
    var ly = Math.sin(mid) * labelR;
    var hw = width / 2;
    var hh = 5;
    var corners = [
      [lx - hw, ly - hh],
      [lx + hw, ly - hh],
      [lx - hw, ly + hh],
      [lx + hw, ly + hh],
    ];
    for (var i = 0; i < corners.length; i++) {
      var x = corners[i][0];
      var y = corners[i][1];
      if (Math.hypot(x, y) > radius - 3) return false;
      var delta = Math.atan2(y, x) - mid;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (Math.abs(delta) > sweep / 2 - 0.04) return false;
    }
    return true;
  }

  function demoSlices(rows) {
    var sum = rows.reduce(function (total, row) {
      return total + row.n;
    }, 0);
    var radius = 52;
    var angle = -Math.PI / 2;
    var slices = rows.map(function (row, index) {
      var sweep = sum ? (row.n / sum) * Math.PI * 2 : 0;
      var start = angle;
      angle += sweep;
      var mid = start + sweep / 2;
      var caption = clipSliceLabel(row.label);
      var textWidth = Math.max(22, caption.length * 6.2);
      return {
        row: row,
        caption: caption,
        index: index,
        start: start,
        end: angle,
        mid: mid,
        sweep: sweep,
        textWidth: textWidth,
        outside: rows.length > 1 && !(sum && labelFits(mid, sweep, textWidth, radius)),
      };
    });
    return { sum: sum, radius: radius, slices: slices };
  }

  function pieMarkup(rows) {
    var laid = demoSlices(rows);
    if (!rows.length || !laid.sum) {
      return '<p class="empty">' + ui.escapeHtml(t("explore.noStats")) + "</p>";
    }
    var radius = laid.radius;
    if (rows.length === 1 || rows[0].n === laid.sum) {
      return (
        '<svg class="demo-pie" viewBox="-60 -60 120 120"><circle cx="0" cy="0" r="' +
        radius +
        '" fill="' +
        sliceColor(0, rows.length) +
        '"/><text class="demo-slice-label is-on-slice" x="0" y="0" font-size="8" text-anchor="middle" dominant-baseline="middle">' +
        ui.escapeHtml(clipSliceLabel(rows[0].label)) +
        "</text></svg>"
      );
    }
    var paths = laid.slices
      .map(function (slice) {
        var large = slice.sweep > Math.PI ? 1 : 0;
        var x1 = radius * Math.cos(slice.start);
        var y1 = radius * Math.sin(slice.start);
        var x2 = radius * Math.cos(slice.end);
        var y2 = radius * Math.sin(slice.end);
        return (
          '<path fill="' +
          sliceColor(slice.index, rows.length) +
          '" stroke="var(--paper)" stroke-width="1.5" d="M0 0 L' +
          x1.toFixed(2) +
          " " +
          y1.toFixed(2) +
          " A" +
          radius +
          " " +
          radius +
          " 0 " +
          large +
          " 1 " +
          x2.toFixed(2) +
          " " +
          y2.toFixed(2) +
          ' Z"/>'
        );
      })
      .join("");
    var labels = laid.slices
      .filter(function (slice) {
        return !slice.outside;
      })
      .map(function (slice) {
        var deep = 100 - (slice.index / (rows.length - 1)) * 72;
        var labelR = radius * 0.58;
        return (
          '<text class="demo-slice-label' +
          (deep >= 55 ? " is-on-slice" : "") +
          '" font-size="8" x="' +
          (Math.cos(slice.mid) * labelR).toFixed(2) +
          '" y="' +
          (Math.sin(slice.mid) * labelR).toFixed(2) +
          '" text-anchor="middle" dominant-baseline="middle">' +
          ui.escapeHtml(slice.caption) +
          "</text>"
        );
      })
      .join("");
    return '<svg class="demo-pie" viewBox="-60 -60 120 120">' + paths + labels + "</svg>";
  }

  function sideMarkup(rows, side) {
    var laid = demoSlices(rows);
    var wantRight = side === "right";
    return laid.slices
      .filter(function (slice) {
        return slice.outside && (Math.cos(slice.mid) >= 0) === wantRight;
      })
      .sort(function (left, right) {
        return Math.sin(left.mid) - Math.sin(right.mid);
      })
      .map(function (slice) {
        return (
          '<p class="demo-tag"><span class="demo-swatch" style="background:' +
          sliceColor(slice.index, rows.length) +
          '"></span><span>' +
          ui.escapeHtml(slice.caption) +
          "</span></p>"
        );
      })
      .join("");
  }

  function legendMarkup(rows) {
    if (!rows.length) return "";
    return (
      '<div class="demo-legend">' +
      rows
        .map(function (row, index) {
          return (
            '<div class="demo-key"><span class="demo-swatch" style="background:' +
            sliceColor(index, rows.length) +
            '"></span><span>' +
            ui.escapeHtml(row.label) +
            '</span><span class="demo-count">' +
            row.n +
            "</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function paintDemo() {
    var rows = demoGroups[demoKey] || [];
    var pie = document.querySelector("#demo-pie");
    var legend = document.querySelector("#demo-legend");
    var note = document.querySelector("#demo-city-note");
    if (pie) pie.innerHTML = pieMarkup(rows);
    var left = document.querySelector("#demo-left");
    var right = document.querySelector("#demo-right");
    if (left) left.innerHTML = sideMarkup(rows, "left");
    if (right) right.innerHTML = sideMarkup(rows, "right");
    if (legend) legend.innerHTML = legendMarkup(rows);
    if (note) note.hidden = demoKey !== "city";
    document.querySelectorAll("[data-demo]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-demo") === demoKey));
    });
  }

  function count(node) {
    return Number((node && node.n) || 0);
  }

  function prettyCity(key) {
    var cut = key.indexOf("_");
    var city = key.slice(cut + 1).replace(/_/g, " ");
    var locale = i18n.lang === "tr" ? "tr-TR" : "en-US";
    city = city.replace(/(^|\s)\S/g, function (letter) {
      return letter.toLocaleUpperCase(locale);
    });
    return city;
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
    demoGroups.age = demo.AGE_BANDS.map(function (band) {
      return { label: band.id, n: count((stats.byAge || {})[band.key]) };
    }).filter(function (row) {
      return row.n > 0;
    });
    demoGroups.gender = demo.GENDERS.map(function (gender) {
      return { label: t("gender." + gender), n: count((stats.byGender || {})[gender]) };
    }).filter(function (row) {
      return row.n > 0;
    });
    demoGroups.country = top(
      Object.keys(stats.byCountry || {}).map(function (code) {
        return { label: i18n.countryName(code), n: count(stats.byCountry[code]) };
      })
    );
    demoGroups.city = top(
      Object.keys(stats.cities || {}).map(function (key) {
        return { label: prettyCity(key), n: Number(stats.cities[key] || 0) };
      })
    );
    document.querySelector("#stats-count").textContent = String(Number(stats.count || 0));
    paintDemo();
  }

  // ---- Page ----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.querySelector("#page-status");
    var lake = document.querySelector("#lake");
    var list = document.querySelector("#fish-list");
    var card = document.querySelector("#fish-card");
    var cardStatus = document.querySelector("#card-status");
    var tailButton = document.querySelector("#card-tail");

    var pool = [];
    var session = null;
    var ownDoc = null;
    var onTrail = {};
    var inSchool = {};
    var stats = null;

    document.querySelector("#share").addEventListener("click", function () {
      ui.shareMindset(ownDoc, status);
    });
    var axes = { x: "agency", y: "redemption" };
    var view = Object.assign({}, FULL);
    var filters = blankFilters();
    var nodes = {};
    var matches = [];
    var cardDoc = null;

    function blankFilters() {
      var ranges = {};
      math.OPEN_KEYS.forEach(function (key) {
        ranges[key] = [0, 100];
      });
      return { ranges: ranges, number: "", ageBand: "", gender: "", country: "", untrailed: false };
    }

    // ---- SVG lake ----

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "lake-svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", t("lake.lakeLabel"));
    svg.innerHTML =
      '<defs><pattern id="waves" width="24" height="14" patternUnits="userSpaceOnUse">' +
      '<path class="wave" d="M1 7c2.5-2 5-2 7.5 0s5 2 7.5 0 5-2 7.5 0"/></pattern></defs>' +
      '<rect class="water" x="-200" y="-200" width="500" height="500" fill="url(#waves)"/>' +
      '<line class="lake-axis" x1="50" y1="-200" x2="50" y2="300"/>' +
      '<line class="lake-axis" x1="-200" y1="50" x2="300" y2="50"/>' +
      '<g id="school"></g>';
    lake.appendChild(svg);
    var school = svg.querySelector("#school");

    function applyView() {
      svg.setAttribute("viewBox", [view.x, view.y, view.w, view.h].map(function (n) {
        return n.toFixed(2);
      }).join(" "));
      placeFish();
    }

    function animateView(target) {
      var from = Object.assign({}, view);
      if (ui.prefersReducedMotion()) {
        view = target;
        applyView();
        return;
      }
      var start = performance.now();
      function frame(now) {
        var progress = Math.min(1, (now - start) / 380);
        var eased = 1 - Math.pow(1 - progress, 3);
        ["x", "y", "w", "h"].forEach(function (key) {
          view[key] = from[key] + (target[key] - from[key]) * eased;
        });
        applyView();
        if (progress < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    function clampView(next) {
      var span = clamp(next.w, MIN_SPAN, FULL.w);
      return {
        x: clamp(next.x, FULL.x - span / 2, FULL.x + FULL.w - span / 2),
        y: clamp(next.y, FULL.y - span / 2, FULL.y + FULL.h - span / 2),
        w: span,
        h: span
      };
    }

    function position(doc) {
      var scores = math.scoresOf(doc);
      var sx = scores[axes.x];
      var sy = scores[axes.y];
      if (!(sx >= 0) || !(sy >= 0)) return null;
      return {
        x: sx + jitter(doc.id, 1),
        y: 100 - sy + jitter(doc.id, 2),
        facing: scores.communion >= 0 && scores.communion < 50 ? -1 : 1
      };
    }

    function sizeFor(doc) {
      if (!ownDoc || doc.id === ownDoc.id) return 1.25;
      var distance = math.scoreDistance(math.scoresOf(ownDoc), math.scoresOf(doc));
      if (!isFinite(distance)) return 0.85;
      return 0.8 + 0.7 * Math.max(0, 1 - distance / 50);
    }

    function fishLabel(doc) {
      var parts = [t("common.mindset", { n: doc.id }), ui.plainSummary(doc)];
      if (ownDoc && doc.id === ownDoc.id) parts.push(t("lake.you"));
      if (inSchool[doc.id]) parts.push(t("lake.inSchool"));
      else if (onTrail[doc.id]) parts.push(t("lake.onTrail"));
      return parts.join(". ");
    }

    function buildFish() {
      school.innerHTML = "";
      nodes = {};
      pool.forEach(function (doc) {
        var spot = position(doc);
        if (!spot) return;
        var group = document.createElementNS(SVG_NS, "g");
        var classes = ["fish", ui.isSimOwner(doc.ownerUid) ? "is-sim" : "is-real"];
        if (doc.createdAt && doc.updatedAt && doc.createdAt !== doc.updatedAt) classes.push("is-fresh");
        if (ownDoc && doc.id === ownDoc.id) classes.push("is-mine");
        if (inSchool[doc.id]) classes.push("is-school");
        else if (onTrail[doc.id]) classes.push("is-trail");
        group.setAttribute("class", classes.join(" "));
        group.setAttribute("data-id", doc.id);
        group.setAttribute("role", "button");
        group.setAttribute("tabindex", "0");
        group.setAttribute("aria-label", fishLabel(doc));
        var mine = ownDoc && doc.id === ownDoc.id;
        group.innerHTML =
          (mine ? '<path class="fish-me" d="M1.6 -6.2 L4.8 -10.6 L-1.6 -10.6 Z"/>' : "") +
          '<g class="fish-sway" style="animation-delay:' + (-(Number(doc.id) % 7) * 0.4).toFixed(1) + 's">' +
          ui.fishMark() +
          "</g>";
        school.appendChild(group);
        nodes[doc.id] = { el: group, doc: doc, spot: spot, size: sizeFor(doc) };
      });
      if (ownDoc && nodes[ownDoc.id]) school.appendChild(nodes[ownDoc.id].el);
      placeFish();
    }

    function placeFish() {
      var zoom = view.w / FULL.w;
      Object.keys(nodes).forEach(function (id) {
        var node = nodes[id];
        var scale = 0.34 * node.size * zoom;
        node.el.setAttribute(
          "transform",
          "translate(" + node.spot.x.toFixed(2) + " " + node.spot.y.toFixed(2) + ") scale(" +
            (scale * node.spot.facing).toFixed(3) + " " + scale.toFixed(3) + ")"
        );
        var arrow = node.el.querySelector(".fish-me");
        if (arrow) arrow.setAttribute("transform", node.spot.facing < 0 ? "scale(-1 1)" : "");
      });
    }

    // ---- Filtering ----

    function matchesFilters(doc) {
      var scores = math.scoresOf(doc);
      var ok = math.OPEN_KEYS.every(function (key) {
        var range = filters.ranges[key];
        if (range[0] <= 0 && range[1] >= 100) return true;
        return scores[key] >= 0 && scores[key] >= range[0] && scores[key] <= range[1];
      });
      if (!ok) return false;
      if (filters.number && String(doc.id) !== filters.number) return false;
      if (filters.ageBand && doc.ageBand !== filters.ageBand) return false;
      if (filters.gender && doc.gender !== filters.gender) return false;
      if (filters.country && doc.country !== filters.country) return false;
      if (filters.untrailed && (onTrail[doc.id] || inSchool[doc.id])) return false;
      return true;
    }

    function activeFilterCount() {
      var countActive = math.OPEN_KEYS.filter(function (key) {
        var range = filters.ranges[key];
        return range[0] > 0 || range[1] < 100;
      }).length;
      ["number", "ageBand", "gender", "country", "untrailed"].forEach(function (key) {
        if (filters[key]) countActive += 1;
      });
      return countActive;
    }

    function refresh(zoomToFit) {
      matches = pool.filter(matchesFilters);
      var visible = {};
      matches.forEach(function (doc) {
        visible[doc.id] = true;
      });
      Object.keys(nodes).forEach(function (id) {
        var node = nodes[id];
        var on = visible[id] || (ownDoc && id === ownDoc.id);
        node.el.classList.toggle("is-faded", !on);
        node.el.setAttribute("tabindex", on ? "0" : "-1");
        node.el.setAttribute("aria-hidden", on ? "false" : "true");
      });
      var placed = matches.filter(function (doc) {
        return nodes[doc.id];
      });
      document.querySelector("#lake-count").textContent = t("lake.count", { n: matches.length, total: pool.length });
      var active = activeFilterCount();
      document.querySelector("#panel-summary").textContent = active ? t("lake.active", { n: active }) : "";
      if (!list.hidden) ui.renderCards(list, matches, "lake.none", optionsFor);
      if (zoomToFit) fitTo(active ? placed : []);
      renderAxisCharts(document.querySelector("#axis-chart"), stats, sliceField(), filters[sliceField()]);
    }

    function sliceField() {
      if (filters.ageBand) return "ageBand";
      if (filters.gender) return "gender";
      if (filters.country) return "country";
      return "";
    }

    function fitTo(docs) {
      if (!docs.length) {
        animateView(Object.assign({}, FULL));
        return;
      }
      var xs = docs.map(function (doc) { return nodes[doc.id].spot.x; });
      var ys = docs.map(function (doc) { return nodes[doc.id].spot.y; });
      var minX = Math.min.apply(null, xs);
      var maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys);
      var maxY = Math.max.apply(null, ys);
      var span = Math.max(maxX - minX, maxY - minY) + 16;
      animateView(
        clampView({
          x: (minX + maxX) / 2 - span / 2,
          y: (minY + maxY) / 2 - span / 2,
          w: span,
          h: span
        })
      );
    }

    function optionsFor(doc) {
      if (ownDoc && doc.id === ownDoc.id) return { tag: t("lake.you") };
      if (inSchool[doc.id]) return { tag: t("lake.inSchool") };
      if (onTrail[doc.id]) return { tag: t("lake.onTrail") };
      return null;
    }

    // ---- Controls ----

    function axisLabels() {
      var x = ui.axisByKey(axes.x);
      var y = ui.axisByKey(axes.y);
      var xLow = document.querySelector("#x-low");
      var xHigh = document.querySelector("#x-high");
      var yHigh = document.querySelector("#y-high");
      var yLow = document.querySelector("#y-low");
      xLow.textContent = "↑ " + i18n.pick(x.lowLabel);
      xHigh.textContent = "↑ " + i18n.pick(x.highLabel);
      yHigh.textContent = "↑ " + i18n.pick(y.highLabel);
      yLow.textContent = "↑ " + i18n.pick(y.lowLabel);
      var xHint = ui.axisHint(x);
      var yHint = ui.axisHint(y);
      xLow.title = xHint;
      xHigh.title = xHint;
      yHigh.title = yHint;
      yLow.title = yHint;
    }

    function fillAxisSelect(select, value) {
      select.innerHTML = openAxes()
        .map(function (axis) {
          return (
            '<option value="' + axis.key + '"' + (axis.key === value ? " selected" : "") + ">" +
            ui.escapeHtml(i18n.pick(axis.label)) +
            "</option>"
          );
        })
        .join("");
    }

    function renderRanges() {
      document.querySelector("#ranges").innerHTML = openAxes()
        .map(function (axis) {
          var range = filters.ranges[axis.key];
          return (
            '<fieldset class="range" data-axis="' + axis.key + '"><legend>' +
            ui.escapeHtml(i18n.pick(axis.label)) +
            ' <span class="range-value">' + range[0] + "–" + range[1] + "</span></legend>" +
            '<div class="range-pair">' +
            '<input type="range" min="0" max="100" step="5" value="' + range[0] + '" data-end="0" aria-label="' +
            ui.escapeHtml(t("lake.from", { axis: i18n.pick(axis.label) })) + '" />' +
            '<input type="range" min="0" max="100" step="5" value="' + range[1] + '" data-end="1" aria-label="' +
            ui.escapeHtml(t("lake.to", { axis: i18n.pick(axis.label) })) + '" />' +
            '</div><div class="range-poles"><span>' +
            ui.escapeHtml(i18n.pick(axis.lowLabel)) +
            "</span><span>" +
            ui.escapeHtml(i18n.pick(axis.highLabel)) +
            "</span></div></fieldset>"
          );
        })
        .join("");
    }

    function fillDemoFilters() {
      var present = {};
      pool.forEach(function (doc) {
        if (doc.country) present[doc.country] = true;
      });
      document.querySelector("#f-ageBand").innerHTML = ui.demoOptions("ageBand", t("explore.everyone"));
      document.querySelector("#f-gender").innerHTML = ui.demoOptions("gender", t("explore.everyone"));
      document.querySelector("#f-country").innerHTML =
        '<option value="">' + ui.escapeHtml(t("explore.everyone")) + "</option>" +
        Object.keys(present)
          .map(function (code) {
            return { code: code, name: i18n.countryName(code) };
          })
          .sort(function (a, b) {
            return a.name.localeCompare(b.name, i18n.lang);
          })
          .map(function (item) {
            return '<option value="' + item.code + '">' + ui.escapeHtml(item.name) + "</option>";
          })
          .join("");
    }

    document.querySelector("#ranges").addEventListener("input", function (event) {
      var input = event.target;
      var box = input.closest("[data-axis]");
      if (!box) return;
      var key = box.getAttribute("data-axis");
      var inputs = box.querySelectorAll("input");
      var low = Number(inputs[0].value);
      var high = Number(inputs[1].value);
      if (low > high) {
        if (input.getAttribute("data-end") === "0") inputs[1].value = String(low);
        else inputs[0].value = String(high);
        low = Number(inputs[0].value);
        high = Number(inputs[1].value);
      }
      filters.ranges[key] = [low, high];
      box.querySelector(".range-value").textContent = low + "–" + high;
      refresh(true);
    });

    ["ageBand", "gender", "country"].forEach(function (key) {
      document.querySelector("#f-" + key).addEventListener("change", function (event) {
        filters[key] = event.target.value;
        refresh(true);
      });
    });

    document.querySelector("#f-uncaught").addEventListener("change", function (event) {
      if (event.target.checked && !session) {
        event.target.checked = false;
        window.location.assign(ui.loginHref());
        return;
      }
      filters.untrailed = event.target.checked;
      refresh(true);
    });

    document.querySelector("#f-number").addEventListener("input", function (event) {
      var digits = String(event.target.value || "").replace(/\D/g, "");
      if (event.target.value !== digits) event.target.value = digits;
      filters.number = digits;
      refresh(true);
    });

    document.querySelector("#f-clear").addEventListener("click", function () {
      filters = blankFilters();
      renderRanges();
      document.querySelector("#f-number").value = "";
      ["ageBand", "gender", "country"].forEach(function (key) {
        document.querySelector("#f-" + key).value = "";
      });
      document.querySelector("#f-uncaught").checked = false;
      refresh(true);
    });

    ["x", "y"].forEach(function (which) {
      document.querySelector("#axis-" + which).addEventListener("change", function (event) {
        axes[which] = event.target.value;
        axisLabels();
        buildFish();
        refresh(true);
      });
    });

    var zoomReset = document.querySelector("#zoom-reset");
    zoomReset.innerHTML = ui.icon("whole");
    zoomReset.addEventListener("click", function () {
      animateView(Object.assign({}, FULL));
    });

    var viewList = document.querySelector("#view-list");
    var viewLake = document.querySelector("#view-lake");
    viewList.innerHTML = ui.icon("list");
    viewLake.innerHTML = ui.icon("waves");

    function showView(which) {
      var showList = which === "list";
      if (showList === !list.hidden) return;
      list.hidden = !showList;
      viewList.setAttribute("aria-pressed", String(showList));
      viewLake.setAttribute("aria-pressed", String(!showList));
      document.querySelector(".lake-wrap").classList.toggle("is-collapsed", showList);
      if (showList) ui.renderCards(list, matches, "lake.none", optionsFor);
    }
    viewList.addEventListener("click", function () {
      showView("list");
    });
    viewLake.addEventListener("click", function () {
      showView("lake");
    });

    var panelToggle = document.querySelector("#panel-toggle");
    panelToggle.addEventListener("click", function () {
      var open = panelToggle.getAttribute("aria-expanded") !== "true";
      panelToggle.setAttribute("aria-expanded", String(open));
      document.querySelector("#panel-body").hidden = !open;
    });

    function selectTab(which) {
      var mapOn = which === "map";
      document.querySelector("#tab-lake-map").setAttribute("aria-selected", String(mapOn));
      document.querySelector("#tab-lake-stats").setAttribute("aria-selected", String(!mapOn));
      document.querySelector("#pane-lake-map").hidden = !mapOn;
      document.querySelector("#pane-lake-stats").hidden = mapOn;
    }
    document.querySelector("#tab-lake-map").addEventListener("click", function () {
      selectTab("map");
    });
    document.querySelector("#tab-lake-stats").addEventListener("click", function () {
      selectTab("stats");
    });
    var tabsHelp = document.querySelector("#tabs-help-dialog");
    document.querySelector("#tabs-help").addEventListener("click", function () {
      document.querySelector("#tabs-help-body").innerHTML = String(t("guide.lakeBody") || "")
        .split(/\n+/)
        .filter(Boolean)
        .map(function (line) {
          return "<p>" + ui.escapeHtml(line) + "</p>";
        })
        .join("");
      tabsHelp.showModal();
    });
    if (ui.closeOnBackdrop) ui.closeOnBackdrop(tabsHelp);
    var demoSwitch = document.querySelector(".demo-switch");
    if (demoSwitch) {
      demoSwitch.addEventListener("click", function (event) {
        var button = event.target.closest("[data-demo]");
        if (!button) return;
        demoKey = button.getAttribute("data-demo");
        paintDemo();
      });
    }

    // ---- Pan and pinch ----

    var pointers = {};
    var gesture = null;
    var moved = false;

    function toLake(dx, dy) {
      var rect = svg.getBoundingClientRect();
      var unit = view.w / Math.min(rect.width, rect.height);
      return { x: dx * unit, y: dy * unit };
    }

    function spread() {
      var list = Object.keys(pointers).map(function (id) {
        return pointers[id];
      });
      if (list.length < 2) return 0;
      return Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
    }

    svg.addEventListener("pointerdown", function (event) {
      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      gesture = {
        view: Object.assign({}, view),
        start: Object.assign({}, pointers[event.pointerId]),
        spread: spread(),
        time: Date.now()
      };
      moved = false;
      svg.removeAttribute("data-panned");
    });

    svg.addEventListener("pointermove", function (event) {
      if (!pointers[event.pointerId] || !gesture) return;
      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      var ids = Object.keys(pointers);
      if (ids.length >= 2 && gesture.spread) {
        var ratio = gesture.spread / Math.max(1, spread());
        var span = gesture.view.w * ratio;
        var cx = gesture.view.x + gesture.view.w / 2;
        var cy = gesture.view.y + gesture.view.h / 2;
        view = clampView({ x: cx - span / 2, y: cy - span / 2, w: span, h: span });
        moved = true;
      } else if (ids.length === 1) {
        var rawX = event.clientX - gesture.start.x;
        var rawY = event.clientY - gesture.start.y;
        var horizontal = Math.abs(rawX) > Math.abs(rawY) * 1.4;
        if (gesture.hold) return;
        if (horizontal && Date.now() - gesture.time < 420) {
          if (Math.abs(rawX) >= 56) gesture.hold = true;
          return;
        }
        var delta = toLake(rawX, rawY);
        if (Math.abs(rawX) + Math.abs(rawY) > 6) moved = true;
        if (!moved) return;
        svg.setAttribute("data-panned", "1");
        if (!svg.hasPointerCapture(event.pointerId)) svg.setPointerCapture(event.pointerId);
        view = clampView({
          x: gesture.view.x - delta.x,
          y: gesture.view.y - delta.y,
          w: gesture.view.w,
          h: gesture.view.h
        });
      }
      applyView();
    });

    function endPointer(event) {
      delete pointers[event.pointerId];
      if (!Object.keys(pointers).length) gesture = null;
      else gesture = { view: Object.assign({}, view), start: pointers[Object.keys(pointers)[0]], spread: spread() };
    }
    svg.addEventListener("pointerup", endPointer);
    svg.addEventListener("pointercancel", endPointer);

    svg.addEventListener(
      "wheel",
      function (event) {
        event.preventDefault();
        var factor = event.deltaY > 0 ? 1.12 : 1 / 1.12;
        var span = view.w * factor;
        var cx = view.x + view.w / 2;
        var cy = view.y + view.h / 2;
        view = clampView({ x: cx - span / 2, y: cy - span / 2, w: span, h: span });
        applyView();
      },
      { passive: false }
    );

    function fishFromEvent(event) {
      var target = event.target.closest && event.target.closest(".fish");
      if (!target || target.classList.contains("is-faded")) return null;
      return nodes[target.getAttribute("data-id")];
    }

    svg.addEventListener("click", function (event) {
      if (moved) return;
      var node = fishFromEvent(event);
      if (node) openCard(node.doc);
    });

    svg.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      var node = fishFromEvent(event);
      if (!node) return;
      event.preventDefault();
      openCard(node.doc);
    });

    // ---- Fish card ----

    ui.closeOnBackdrop(card);
    document.querySelector("#card-close").addEventListener("click", function () {
      card.close();
    });

    function renderTail() {
      var tailing = Boolean(onTrail[cardDoc.id]);
      tailButton.textContent = t(tailing ? "profile.tailing" : "profile.tail");
      tailButton.className = "btn " + (tailing ? "" : "btn-primary");
      tailButton.setAttribute("aria-pressed", String(tailing));
    }

    async function openCard(doc) {
      cardDoc = doc;
      var mine = ownDoc && doc.id === ownDoc.id;
      document.querySelector("#card-number").innerHTML = ui.mindsetIdTitle(doc.id, "", doc.ownerUid);
      var cardHeadline = document.querySelector("#card-headline");
      if (cardHeadline) {
        cardHeadline.textContent = String(doc.headline || "").replace(/\.$/, "");
        cardHeadline.hidden = !doc.headline;
      }
      document.querySelector("#card-badges").textContent = ui.badgeText(doc);
      document.querySelector("#card-meta").textContent = ui.relativeWhen(doc.updatedAt);
      var cardSummary = document.querySelector("#card-summary");
      var code = String(doc.personalCode || "").trim();
      cardSummary.textContent = code || ui.plainSummary(doc);
      cardSummary.hidden = !cardSummary.textContent;
      document.querySelector("#card-quote").textContent = "";
      document.querySelector("#card-view").href = "/i/" + doc.id;
      ui.renderRadar(document.querySelector("#card-radar"), math.scoresOf(doc), null);
      var aliasNode = document.querySelector("#card-alias");
      aliasNode.hidden = true;
      ui.setStatus(cardStatus, "");
      tailButton.hidden = mine || Boolean(inSchool[doc.id]);
      if (!mine) renderTail();
      card.showModal();
      if (!session || mine || !inSchool[doc.id]) return;
      var entry = await social.aliasOf(doc.id, session.idToken);
      if (entry && entry.alias && cardDoc === doc) {
        aliasNode.textContent = "@" + entry.alias;
        aliasNode.hidden = false;
      }
    }

    function markNode(doc) {
      var node = nodes[doc.id];
      if (!node) return;
      node.el.classList.toggle("is-trail", Boolean(onTrail[doc.id]) && !inSchool[doc.id]);
      node.el.setAttribute("aria-label", fishLabel(doc));
    }

    tailButton.addEventListener("click", function () {
      if (!session) {
        window.location.assign("/register?next=" + encodeURIComponent("/i/" + cardDoc.id));
        return;
      }
      if (!ownDoc) {
        window.location.assign("/me");
        return;
      }
      var doc = cardDoc;
      var tailing = !onTrail[doc.id];
      if (tailing) onTrail[doc.id] = true;
      else delete onTrail[doc.id];
      renderTail();
      markNode(doc);
      (tailing
        ? social.tail(session, ownDoc.id, doc.ownerUid, doc.id)
        : social.untail(session, doc.ownerUid)
      )
        .then(function () {
          ui.setStatus(cardStatus, tailing ? "" : t("lake.released"));
        })
        .catch(function (error) {
          if (tailing) delete onTrail[doc.id];
          else onTrail[doc.id] = true;
          renderTail();
          markNode(doc);
          ui.setStatus(cardStatus, ui.errorText(error), "error");
        });
    });

    // ---- Load ----

    async function load() {
      ui.beginPageLoad();
      try {
        session = await ui.requireAuth();
        if (!session) return;
        ui.setStatus(status, t("common.loading"));
        var loaded = await Promise.all([
          store.recent(POOL_SIZE, session.idToken),
          store.getStats().catch(function () {
            return null;
          })
        ]);
        pool = loaded[0];
        stats = loaded[1];
        var social3 = await Promise.all([
          store.findOwn(session.uid, session.idToken).catch(function () { return null; }),
          social.trailNumbers(session).catch(function () { return []; }),
          social.members(session).catch(function () { return []; })
        ]);
        ownDoc = social3[0] && social3[0].publicDoc;
        social3[1].forEach(function (number) {
          onTrail[number] = true;
        });
        social3[2].forEach(function (row) {
          if (row.number) inSchool[row.number] = true;
        });
        if (ownDoc && !pool.some(function (doc) { return doc.id === ownDoc.id; })) pool.push(ownDoc);
        if (ownDoc) {
          var aliasEntry = await social.aliasOf(ownDoc.id, session.idToken).catch(function () {
            return null;
          });
          ui.paintOwnerHeader({
            doc: ownDoc,
            header: t("lake.title"),
            alias: aliasEntry && aliasEntry.alias
          });
        } else {
          ui.clearOwnerHeader(t("lake.title"));
        }
        fillAxisSelect(document.querySelector("#axis-x"), axes.x);
        fillAxisSelect(document.querySelector("#axis-y"), axes.y);
        axisLabels();
        renderRanges();
        fillDemoFilters();
        renderDemoCharts(stats);
        buildFish();
        applyView();
        refresh(false);
        var hidden = pool.length - Object.keys(nodes).length;
        ui.setStatus(status, hidden > 0 ? t("lake.unplaced", { n: hidden }) : "");
      } finally {
        await ui.endPageLoad();
      }
    }

    load().catch(function (error) {
      ui.setStatus(status, ui.errorText(error), "error");
    });
  });
})();

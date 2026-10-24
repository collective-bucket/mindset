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
  var FOCUS_SPAN = 48;
  var PAN_LIMIT = 90;
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
    var tailButton = document.querySelector("#card-tail");
    var replyButton = document.querySelector("#card-reply");
    var viewLink = document.querySelector("#card-view");
    var closeButton = document.querySelector("#card-close");

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
    var view = { x: 0, y: 0, w: FOCUS_SPAN, h: FOCUS_SPAN };
    var pan = { x: 0, y: 0 };
    var lastPanX = 0;
    var mineFacing = 0;
    var calls = {};
    var shows = {};
    var asked = {};
    var attention = {};
    var ownCall = null;
    var ownPrivate = null;
    var broadcast = window.MindsetCall.configOf({});
    var chosenKind = "";
    var chosenLine = "";
    var chosenField = "";
    var bubbleFor = "";
    var bubbleClosed = "";
    var filters = blankFilters();
    var nodes = {};
    var matches = [];
    var cardDoc = null;

    function blankFilters() {
      var ranges = {};
      math.OPEN_KEYS.forEach(function (key) {
        ranges[key] = [0, 100];
      });
      return {
        ranges: ranges,
        number: "",
        ageBand: "",
        gender: "",
        country: "",
        untrailed: false,
        hideSims: false,
        showTargets: false
      };
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
    var vectors = {
      up: document.querySelector("#y-high"),
      down: document.querySelector("#y-low"),
      left: document.querySelector("#x-low"),
      right: document.querySelector("#x-high")
    };
    var ALL_VECTORS = ["up", "down", "left", "right"];
    var vectorTimer = 0;
    var lastPanY = 0;

    function showVectors(dirs, linger) {
      Object.keys(vectors).forEach(function (dir) {
        vectors[dir].classList.toggle("is-on", dirs.indexOf(dir) >= 0);
      });
      clearTimeout(vectorTimer);
      if (dirs.length) {
        vectorTimer = setTimeout(function () {
          showVectors([]);
        }, linger || 1400);
      }
    }
    var bubble = document.createElement("div");
    bubble.id = "fish-bubble";
    bubble.className = "fish-bubble";
    bubble.hidden = true;
    bubble.innerHTML =
      '<button type="button" id="fish-bubble-close" class="fish-bubble-close" aria-label="' +
      ui.escapeHtml(t("common.close")) +
      '">' +
      ui.icon("close") +
      "</button>" +
      '<p id="fish-bubble-text"></p><a id="fish-bubble-go" class="btn btn-small"></a>';
    lake.appendChild(bubble);
    document.querySelector("#fish-bubble-close").addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      dismissBubble();
    });

    function focusSpot() {
      if (ownDoc && nodes[ownDoc.id]) return nodes[ownDoc.id].spot;
      return { x: 50, y: 50 };
    }

    function clampPan(next) {
      return {
        x: clamp(next.x, -PAN_LIMIT, PAN_LIMIT),
        y: clamp(next.y, -PAN_LIMIT, PAN_LIMIT)
      };
    }

    function viewCenter() {
      var spot = focusSpot();
      return { x: spot.x + pan.x, y: spot.y + pan.y };
    }

    function applyView() {
      var center = viewCenter();
      view.x = center.x - view.w / 2;
      view.y = center.y - view.h / 2;
      view.h = view.w;
      svg.setAttribute("viewBox", [view.x, view.y, view.w, view.h].map(function (n) {
        return n.toFixed(2);
      }).join(" "));
      placeFish();
    }

    function setSpan(span) {
      view.w = clamp(span, MIN_SPAN, FULL.w);
      view.h = view.w;
      applyView();
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
          '<g class="fish-sonar" aria-hidden="true">' +
          '<circle class="sonar-ring" cx="0" cy="0" r="10"/>' +
          '<circle class="sonar-ring sonar-late" cx="0" cy="0" r="10"/>' +
          "</g>" +
          (mine ? '<path class="fish-me" d="M0.8 -7 L4.8 -13 L-3.2 -13 Z"/>' : "") +
          '<text class="fish-bang" x="0" y="-11" text-anchor="middle" aria-hidden="true">!</text>' +
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
      var dx = pan.x - lastPanX;
      var dy = pan.y - lastPanY;
      if (Math.abs(dx) > 0.02) mineFacing = dx < 0 ? -1 : 1;
      lastPanX = pan.x;
      lastPanY = pan.y;
      var heading = [];
      if (Math.abs(dx) > 0.02) heading.push(dx < 0 ? "left" : "right");
      if (Math.abs(dy) > 0.02) heading.push(dy < 0 ? "up" : "down");
      if (heading.length) showVectors(heading);
      var zoom = view.w / FULL.w;
      var center = viewCenter();
      var mineId = ownDoc && ownDoc.id;
      Object.keys(nodes).forEach(function (id) {
        var node = nodes[id];
        var at = mineId && id === mineId ? center : node.spot;
        var facing = node.spot.facing;
        if (mineId && id === mineId) {
          if (!mineFacing) mineFacing = facing || 1;
          facing = mineFacing;
        }
        var scale = 0.34 * node.size * zoom;
        node.el.setAttribute(
          "transform",
          "translate(" + at.x.toFixed(2) + " " + at.y.toFixed(2) + ") scale(" +
            (scale * facing).toFixed(3) + " " + scale.toFixed(3) + ")"
        );
        var flip = facing < 0 ? "scale(-1 1)" : "";
        var arrow = node.el.querySelector(".fish-me");
        if (arrow) arrow.setAttribute("transform", flip);
        var bang = node.el.querySelector(".fish-bang");
        if (bang) bang.setAttribute("transform", flip);
        var flags = signalState(node.doc);
        node.el.classList.toggle("is-attention", flags.attention);
        node.el.classList.toggle("is-calling", flags.calling);
      });
      placeBubble();
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
      var mine = ownDoc && String(doc.id) === String(ownDoc.id);
      if (!mine && filters.hideSims && ui.isSimOwner(doc.ownerUid)) return false;
      if (!mine && filters.showTargets && !signalState(doc).attention) return false;
      return true;
    }

    function activeFilterCount() {
      var countActive = math.OPEN_KEYS.filter(function (key) {
        var range = filters.ranges[key];
        return range[0] > 0 || range[1] < 100;
      }).length;
      ["number", "ageBand", "gender", "country", "untrailed", "hideSims", "showTargets"].forEach(function (key) {
        if (filters[key]) countActive += 1;
      });
      return countActive;
    }

    function refresh() {
      matches = pool.filter(matchesFilters);
      var visible = {};
      matches.forEach(function (doc) {
        visible[doc.id] = true;
      });
      Object.keys(nodes).forEach(function (id) {
        var node = nodes[id];
        var keepMine = ownDoc && id === ownDoc.id;
        var on = visible[id] || keepMine;
        node.el.classList.toggle("is-faded", !on);
        node.el.setAttribute("tabindex", on ? "0" : "-1");
        node.el.setAttribute("aria-hidden", on ? "false" : "true");
      });
      document.querySelector("#lake-count").textContent = t("lake.count", { n: matches.length, total: pool.length });
      var active = activeFilterCount();
      var summary = document.querySelector("#panel-summary");
      summary.textContent = active ? String(active) : "";
      summary.hidden = !active;
      document.querySelector("#panel-toggle").title = active ? t("lake.active", { n: active }) : "";
      if (!list.hidden) ui.renderCards(list, matches, "lake.none", optionsFor);
      renderAxisCharts(document.querySelector("#axis-chart"), stats, sliceField(), filters[sliceField()]);
    }

    function sliceField() {
      if (filters.ageBand) return "ageBand";
      if (filters.gender) return "gender";
      if (filters.country) return "country";
      return "";
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
      refresh();
    });

    ["ageBand", "gender", "country"].forEach(function (key) {
      document.querySelector("#f-" + key).addEventListener("change", function (event) {
        filters[key] = event.target.value;
        refresh();
      });
    });

    document.querySelector("#f-sims").addEventListener("change", function (event) {
      filters.hideSims = !event.target.checked;
      paintSims();
      refresh();
    });

    document.querySelector("#f-targets").addEventListener("change", function (event) {
      setShowTargets(event.target.checked);
    });

    document.querySelector("#f-uncaught").addEventListener("change", function (event) {
      if (event.target.checked && !session) {
        event.target.checked = false;
        window.location.assign(ui.loginHref());
        return;
      }
      filters.untrailed = event.target.checked;
      refresh();
    });

    document.querySelector("#f-number").addEventListener("input", function (event) {
      var digits = String(event.target.value || "").replace(/\D/g, "");
      if (event.target.value !== digits) event.target.value = digits;
      filters.number = digits;
      refresh();
    });

    document.querySelector("#f-clear").addEventListener("click", function () {
      var framed = filters.showTargets ? savedView : null;
      savedView = null;
      filters = blankFilters();
      renderRanges();
      document.querySelector("#f-number").value = "";
      ["ageBand", "gender", "country"].forEach(function (key) {
        document.querySelector("#f-" + key).value = "";
      });
      document.querySelector("#f-uncaught").checked = false;
      document.querySelector("#f-sims").checked = true;
      document.querySelector("#f-targets").checked = false;
      paintSims();
      paintTargets();
      refresh();
      if (framed) {
        pan = framed.pan;
        setSpan(framed.span);
      }
    });

    ["x", "y"].forEach(function (which) {
      document.querySelector("#axis-" + which).addEventListener("change", function (event) {
        axes[which] = event.target.value;
        axisLabels();
        buildFish();
        refresh();
        showVectors(ALL_VECTORS, 2200);
      });
    });

    var zoomReset = document.querySelector("#zoom-reset");
    var panelToggle = document.querySelector("#panel-toggle");
    zoomReset.innerHTML = ui.icon("whole");

    var targetButton = document.querySelector("#lake-targets");
    targetButton.innerHTML = ui.icon("target");
    var savedView = null;

    function paintTargets() {
      var on = Boolean(filters.showTargets);
      targetButton.setAttribute("aria-pressed", String(on));
      targetButton.setAttribute("aria-label", t(on ? "lake.hideTargets" : "lake.showTargets"));
      document.querySelector("#f-targets").checked = on;
    }

    function setShowTargets(on) {
      on = Boolean(on);
      if (on === Boolean(filters.showTargets)) {
        paintTargets();
        return;
      }
      filters.showTargets = on;
      paintTargets();
      refresh();
      if (on) {
        savedView = { pan: { x: pan.x, y: pan.y }, span: view.w };
        if (!frameTargets()) savedView = null;
        return;
      }
      if (!savedView) return;
      var back = savedView;
      savedView = null;
      pan = back.pan;
      setSpan(back.span);
    }

    function attentionSpots() {
      var spots = [];
      Object.keys(nodes).forEach(function (id) {
        var node = nodes[id];
        if (!node || !node.spot || !signalState(node.doc).attention) return;
        spots.push(node.spot);
      });
      return spots;
    }

    function frameTargets() {
      var spots = attentionSpots();
      if (!spots.length) {
        ui.setStatus(status, t("lake.noTargets"));
        return false;
      }
      var minX = spots[0].x;
      var maxX = spots[0].x;
      var minY = spots[0].y;
      var maxY = spots[0].y;
      spots.forEach(function (spot) {
        minX = Math.min(minX, spot.x);
        maxX = Math.max(maxX, spot.x);
        minY = Math.min(minY, spot.y);
        maxY = Math.max(maxY, spot.y);
      });
      var focus = focusSpot();
      pan = clampPan({
        x: (minX + maxX) / 2 - focus.x,
        y: (minY + maxY) / 2 - focus.y
      });
      setSpan(Math.max(maxX - minX, maxY - minY) + 10);
      return true;
    }

    targetButton.addEventListener("click", function () {
      setShowTargets(!filters.showTargets);
    });

    paintTargets();

    var simsButton = document.querySelector("#lake-sims");
    simsButton.innerHTML = ui.icon("fish");

    function paintSims() {
      var shown = !filters.hideSims;
      simsButton.setAttribute("aria-pressed", String(shown));
      simsButton.setAttribute("aria-label", t(shown ? "lake.hideSims" : "lake.showSims"));
      document.querySelector("#f-sims").checked = shown;
    }

    simsButton.addEventListener("click", function () {
      filters.hideSims = !filters.hideSims;
      paintSims();
      refresh();
    });

    paintSims();

    zoomReset.addEventListener("click", function () {
      savedView = null;
      pan = { x: 0, y: 0 };
      setSpan(FULL.w);
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

    var panelBody = document.querySelector("#panel-body");
    panelToggle.insertAdjacentHTML("afterbegin", ui.icon("filter"));

    function setPanel(open) {
      panelToggle.setAttribute("aria-expanded", String(open));
      panelBody.hidden = !open;
    }
    panelToggle.addEventListener("click", function () {
      setPanel(panelToggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("click", function (event) {
      if (panelBody.hidden) return;
      if (panelBody.contains(event.target) || panelToggle.contains(event.target)) return;
      setPanel(false);
    });

    var lakeWrap = document.querySelector(".lake-wrap");
    var fullButton = document.querySelector("#lake-full");

    function paintFull(on) {
      fullButton.innerHTML = ui.icon(on ? "fullscreenExit" : "fullscreen");
      fullButton.setAttribute("aria-pressed", String(on));
      fullButton.setAttribute("aria-label", t(on ? "lake.exitFullscreen" : "lake.fullscreen"));
    }

    function setFull(on) {
      lakeWrap.classList.toggle("is-full", on);
      document.body.classList.toggle("is-lake-full", on);
      paintFull(on);
      var root = document.documentElement;
      if (on && root.requestFullscreen && !document.fullscreenElement) {
        root.requestFullscreen().catch(function () {});
      } else if (!on && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      }
    }
    fullButton.addEventListener("click", function () {
      setFull(!lakeWrap.classList.contains("is-full"));
    });
    document.addEventListener("fullscreenchange", function () {
      if (!document.fullscreenElement && lakeWrap.classList.contains("is-full")) setFull(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      if (!panelBody.hidden) {
        setPanel(false);
        panelToggle.focus();
      } else if (lakeWrap.classList.contains("is-full")) {
        setFull(false);
      }
    });
    paintFull(false);

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
        span: view.w,
        pan: Object.assign({}, pan),
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
        view.w = clamp(gesture.span * ratio, MIN_SPAN, FULL.w);
        view.h = view.w;
        moved = true;
      } else if (ids.length === 1) {
        var rawX = event.clientX - gesture.start.x;
        var rawY = event.clientY - gesture.start.y;
        var delta = toLake(rawX, rawY);
        if (Math.abs(rawX) + Math.abs(rawY) > 6) moved = true;
        if (!moved) return;
        svg.setAttribute("data-panned", "1");
        if (!svg.hasPointerCapture(event.pointerId)) svg.setPointerCapture(event.pointerId);
        pan = clampPan({
          x: gesture.pan.x - delta.x,
          y: gesture.pan.y - delta.y
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
        setSpan(view.w * factor);
      },
      { passive: false }
    );

    document.addEventListener("keydown", function (event) {
      if (document.querySelector("#pane-lake-map").hidden) return;
      if (document.querySelector("dialog[open]")) return;
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (event.target && event.target.isContentEditable)) return;
      var step = Math.max(4, view.w * 0.12);
      var next = null;
      if (event.key === "ArrowLeft") next = { x: pan.x - step, y: pan.y };
      else if (event.key === "ArrowRight") next = { x: pan.x + step, y: pan.y };
      else if (event.key === "ArrowUp") next = { x: pan.x, y: pan.y - step };
      else if (event.key === "ArrowDown") next = { x: pan.x, y: pan.y + step };
      if (!next) return;
      event.preventDefault();
      pan = clampPan(next);
      applyView();
    });

    function fishFromEvent(event) {
      var target = event.target.closest && event.target.closest(".fish");
      if (!target || target.classList.contains("is-faded")) return null;
      return nodes[target.getAttribute("data-id")];
    }

    svg.addEventListener("click", function (event) {
      if (moved) return;
      var node = fishFromEvent(event);
      if (!node) {
        if (!livePulHolding()) hideBubble();
        revealOwnPul();
        return;
      }
      dismissBang(node.doc);
      if (!openBroadcast(node.doc) && !livePulHolding()) hideBubble();
      revealOwnPul();
      openCard(node.doc);
    });

    svg.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      var node = fishFromEvent(event);
      if (!node) return;
      event.preventDefault();
      dismissBang(node.doc);
      if (!openBroadcast(node.doc) && !livePulHolding()) hideBubble();
      revealOwnPul();
      openCard(node.doc);
    });

    // ---- Fish card ----

    ui.closeOnBackdrop(card);
    tailButton.innerHTML = ui.icon("fish");
    replyButton.innerHTML = ui.icon("reply");
    viewLink.innerHTML = ui.icon("preview");
    closeButton.innerHTML = ui.icon("close");
    closeButton.addEventListener("click", function () {
      card.close();
    });

    function noticeDock() {
      return document.querySelector(".notice-dock");
    }

    function liftNotice(message) {
      var dock = noticeDock();
      if (!dock || !dock.showPopover) return;
      if (message && card.open) {
        dock.setAttribute("popover", "manual");
        if (!dock.matches(":popover-open")) dock.showPopover();
      } else if (dock.matches(":popover-open")) {
        dock.hidePopover();
      }
    }

    function cardNotice(message, kind) {
      ui.setStatus(status, message, kind);
      liftNotice(message);
    }

    card.addEventListener("close", function () {
      var dock = noticeDock();
      if (dock && dock.matches(":popover-open")) dock.hidePopover();
    });

    function renderTail() {
      var tailing = Boolean(onTrail[cardDoc.id]);
      tailButton.setAttribute("aria-label", t(tailing ? "profile.tailing" : "profile.tail"));
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
      viewLink.href = "/i/" + doc.id;
      ui.renderRadar(document.querySelector("#card-radar"), math.scoresOf(doc), null, { compact: true });
      var aliasNode = document.querySelector("#card-alias");
      aliasNode.hidden = true;
      var trailed = !mine && !inSchool[doc.id] && Boolean(onTrail[doc.id]);
      tailButton.hidden = mine || Boolean(inSchool[doc.id]);
      paintPulCard(doc);
      if (!tailButton.hidden) renderTail();
      card.showModal();
      cardNotice(trailed ? t("profile.tailing") : "");
      var row = liveCall(doc.id);
      if (session && row && row.kind === "pul" && !pulShow(doc.id) && row.from) {
        var fetched = await ensureShow(doc.id, row.from);
        if (cardDoc !== doc) return;
        if (fetched && bubbleFor === String(doc.id)) {
          var node = nodes[doc.id];
          if (node) showBubble(node.doc, row);
        } else if (!fetched && bubbleFor === String(doc.id)) {
          bubbleFor = "";
          revealOwnPul();
        }
        paintPulCard(doc);
      }
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

    replyButton.addEventListener("click", async function () {
      if (!session || !cardDoc) return;
      if (!ownDoc || !ownPrivate) {
        window.location.assign("/me");
        return;
      }
      var show = shows[String(cardDoc.id)];
      if (!show || !show.field || !show.text) return;
      var doc = cardDoc;
      var field = await ui.pickClosedField({
        title: t("lake.callReplyTitle"),
        hint: t("lake.callReplyHint"),
        action: t("lake.callReplySend"),
        privateDoc: ownPrivate
      });
      if (!field || !ownPrivate[field]) return;
      replyButton.disabled = true;
      social
        .replyToCall(
          session,
          ownDoc.id,
          doc.ownerUid,
          doc.id,
          field,
          ownPrivate[field],
          show.field,
          show.text
        )
        .then(function () {
          asked[doc.ownerUid] = true;
          replyButton.hidden = true;
          cardNotice(t("lake.callReplied"));
        })
        .catch(function (error) {
          cardNotice(ui.errorText(error), "error");
        })
        .then(function () {
          replyButton.disabled = false;
        });
    });

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
          cardNotice(tailing ? t("profile.tailing") : t("lake.released"));
        })
        .catch(function (error) {
          if (tailing) delete onTrail[doc.id];
          else onTrail[doc.id] = true;
          renderTail();
          markNode(doc);
          cardNotice(ui.errorText(error), "error");
        });
    });

    // ---- Broadcasts and attention marks ----

    function seenKey() {
      return "mindset.seenAttention." + (session && session.uid ? session.uid : "");
    }

    function seenAttention() {
      try {
        return JSON.parse(sessionStorage.getItem(seenKey()) || "{}") || {};
      } catch (error) {
        return {};
      }
    }

    function attentionStamp(doc) {
      var id = String(doc.id);
      var bits = [];
      if (attention[id]) bits.push(String(attention[id]));
      var row = calls[id];
      if (row && window.MindsetCall.isLive(row, Date.now())) bits.push("call:" + row.endsAt);
      if (doc.createdAt && doc.updatedAt && doc.createdAt !== doc.updatedAt) bits.push("fresh:" + doc.updatedAt);
      return bits.join("|");
    }

    function dismissBang(doc) {
      var stamp = attentionStamp(doc);
      if (!stamp) return;
      var id = String(doc.id);
      var map = seenAttention();
      if (map[id] === stamp) return;
      map[id] = stamp;
      try {
        sessionStorage.setItem(seenKey(), JSON.stringify(map));
      } catch (error) {
        /* ignore quota */
      }
      placeFish();
    }

    function signalState(doc) {
      var id = String(doc.id);
      var mine = ownDoc && String(ownDoc.id) === id;
      var stamp = attentionStamp(doc);
      var row = calls[id];
      var live = row && window.MindsetCall.isLive(row, Date.now());
      return {
        attention: !mine && Boolean(stamp) && seenAttention()[id] !== stamp,
        calling: Boolean(mine && live)
      };
    }

    function hideBubble() {
      bubbleFor = "";
      bubble.hidden = true;
    }

    function broadcastKey(row) {
      if (!row) return "";
      return String(row.fromNumber || "") + ":" + String(row.endsAt || "");
    }

    function dismissBubble() {
      bubbleClosed = broadcastKey(liveCall(bubbleFor));
      hideBubble();
    }

    function liveCall(id) {
      var row = calls[String(id)];
      if (!row || !window.MindsetCall.isLive(row, Date.now())) return null;
      return row;
    }

    function pulShow(id) {
      var show = shows[String(id)];
      if (!show || !show.text) return null;
      var ends = Date.parse(show.endsAt);
      if (isFinite(ends) && Date.now() >= ends) return null;
      return show;
    }

    function livePulHolding() {
      var row = liveCall(bubbleFor);
      return Boolean(row && row.kind === "pul");
    }

    function paintPulCard(doc) {
      if (!doc || cardDoc !== doc) return;
      var mine = ownDoc && String(ownDoc.id) === String(doc.id);
      var row = liveCall(doc.id);
      var show = row && row.kind === "pul" ? pulShow(doc.id) : null;
      document.querySelector("#card-quote").textContent = show ? show.text : "";
      replyButton.hidden = !show || mine || Boolean(inSchool[doc.id]) || Boolean(asked[doc.ownerUid]);
    }

    async function ensureShow(number, uid) {
      var id = String(number);
      var existing = pulShow(id);
      if (existing) return existing;
      if (!session || !uid) return null;
      var row = null;
      try {
        row = await social.callShow(session, uid);
      } catch (error) {
        return null;
      }
      if (!row || !row.text) return null;
      var ends = Date.parse(row.endsAt);
      if (isFinite(ends) && Date.now() >= ends) return null;
      if (!row.fromNumber) row.fromNumber = Number(number);
      shows[id] = row;
      return row;
    }

    async function backfillShows() {
      var pending = [];
      Object.keys(calls).forEach(function (id) {
        var row = liveCall(id);
        if (!row || row.kind !== "pul" || pulShow(id) || !row.from) return;
        pending.push(ensureShow(id, row.from));
      });
      if (pending.length) await Promise.all(pending);
    }

    function showBubble(doc, row) {
      var text = document.querySelector("#fish-bubble-text");
      var go = document.querySelector("#fish-bubble-go");
      bubbleFor = String(doc.id);
      go.hidden = true;
      go.removeAttribute("href");
      if (row.kind === "pul") {
        var show = pulShow(doc.id);
        if (!show) {
          bubble.hidden = true;
          return;
        }
        text.textContent = show.text;
      } else {
        text.textContent = t("lake.callLine." + row.line);
      }
      bubble.hidden = false;
      placeBubble();
    }

    function placeBubble() {
      if (!bubbleFor || bubble.hidden) return;
      var node = nodes[bubbleFor];
      if (!node || !liveCall(bubbleFor)) {
        hideBubble();
        return;
      }
      var host = lake.getBoundingClientRect();
      var mark = node.el.querySelector(".fish-sway") || node.el;
      var ctm = node.el.getScreenCTM();
      var svg = node.el.ownerSVGElement;
      var attention = node.el.classList.contains("is-attention");
      var box = mark.getBBox();
      var crownY = box.y;
      var gap = 14;
      if (attention) {
        var bang = node.el.querySelector(".fish-bang");
        if (bang) crownY = Math.min(crownY, bang.getBBox().y);
        gap = 8;
      } else {
        var arrow = node.el.querySelector(".fish-me");
        if (arrow) crownY = Math.min(crownY, arrow.getBBox().y);
      }
      var centerPoint = svg.createSVGPoint();
      var topPoint = svg.createSVGPoint();
      centerPoint.x = box.x + box.width / 2;
      centerPoint.y = box.y + box.height / 2;
      topPoint.x = centerPoint.x;
      topPoint.y = crownY;
      var center = ctm ? centerPoint.matrixTransform(ctm) : null;
      var crown = ctm ? topPoint.matrixTransform(ctm) : null;
      if (!center || !crown) {
        var fallback = mark.getBoundingClientRect();
        center = { x: fallback.left + fallback.width / 2, y: fallback.top + fallback.height / 2 };
        crown = { x: center.x, y: fallback.top };
      }
      var pad = 8;
      var text = document.querySelector("#fish-bubble-text");
      bubble.style.transform = "none";
      bubble.style.maxWidth = Math.max(96, Math.min(190, host.width - pad * 2)) + "px";
      text.style.maxHeight = Math.max(32, host.height - pad * 2 - 16) + "px";
      var width = bubble.offsetWidth;
      var height = bubble.offsetHeight;
      var left = center.x - host.left - width / 2;
      var top = crown.y - host.top - gap - height;
      if (left < pad) left = pad;
      if (left + width > host.width - pad) left = Math.max(pad, host.width - pad - width);
      bubble.style.left = left + "px";
      bubble.style.top = top + "px";
    }

    function openBroadcast(doc) {
      var row = liveCall(doc.id);
      if (!row) return false;
      if (broadcastKey(row) === bubbleClosed) bubbleClosed = "";
      showBubble(doc, row);
      return true;
    }

    function revealOwnPul() {
      if (!ownDoc) return;
      var id = String(ownDoc.id);
      var row = liveCall(id);
      if (!row || row.kind !== "pul" || !pulShow(id)) return;
      if (broadcastKey(row) === bubbleClosed) return;
      if (bubbleFor && bubbleFor !== id && liveCall(bubbleFor)) return;
      var node = nodes[id];
      if (!node) return;
      if (bubbleFor === id && !bubble.hidden) {
        placeBubble();
        return;
      }
      showBubble(node.doc, row);
    }

    function indexCalls(rows, mine) {
      calls = {};
      var now = Date.now();
      (rows || []).forEach(function (row) {
        if (!row || !row.fromNumber || !window.MindsetCall.isLive(row, now)) return;
        calls[String(row.fromNumber)] = row;
      });
      ownCall = mine || null;
      if (ownCall && ownCall.fromNumber && window.MindsetCall.isLive(ownCall, now)) {
        calls[String(ownCall.fromNumber)] = ownCall;
      }
    }

    function indexShows(rows) {
      shows = {};
      var now = Date.now();
      (rows || []).forEach(function (row) {
        if (!row || !row.fromNumber || !row.text) return;
        var ends = Date.parse(row.endsAt);
        if (!isFinite(ends) || now >= ends) return;
        shows[String(row.fromNumber)] = row;
      });
    }

    function noteAttention(requests, glints, trailRows, memberRows) {
      attention = {};
      var members = {};
      (memberRows || []).forEach(function (row) {
        members[row.uid || row.id] = true;
      });
      var trail = {};
      (trailRows || []).forEach(function (row) {
        if (row.to && !members[row.to]) trail[row.to] = true;
      });
      (requests || []).forEach(function (row) {
        if (!row.fromNumber) return;
        var id = String(row.fromNumber);
        var stamp = "req:" + (row.createdAt || row.id || "1");
        attention[id] = attention[id] ? attention[id] + "|" + stamp : stamp;
      });
      (glints || []).forEach(function (row) {
        if (!social.glintLive(row) || !row.from || !trail[row.from] || !row.fromNumber) return;
        var stamp = String(row.createdAt || row.expiresAt || row.from);
        if (window.MindsetNotices && window.MindsetNotices.isPassedGlint(session.uid, row.from, stamp)) return;
        var id = String(row.fromNumber);
        var bit = "glint:" + stamp;
        attention[id] = attention[id] ? attention[id] + "|" + bit : bit;
      });
    }

    async function ensureNumbers(numbers) {
      var missing = numbers.filter(function (n) {
        return n > 0 && !pool.some(function (doc) { return String(doc.id) === String(n); });
      });
      if (!missing.length) return false;
      var extra = await store.byNumbers(missing, session.idToken);
      var added = false;
      extra.forEach(function (doc) {
        if (pool.some(function (row) { return row.id === doc.id; })) return;
        pool.push(doc);
        added = true;
      });
      return added;
    }

    function paintCall() {
      var bar = document.querySelector("#call-bar");
      var open = document.querySelector("#call-open");
      var timer = document.querySelector("#call-timer");
      var dialog = document.querySelector("#call-dialog");
      if (!ownDoc) {
        bar.hidden = true;
        if (dialog.open) dialog.close();
        return;
      }
      bar.hidden = false;
      var state = window.MindsetCall.phase(ownCall, broadcast, Date.now());
      timer.hidden = true;
      if (state.name === "idle") {
        open.textContent = t("lake.callOpen");
        open.disabled = false;
        return;
      }
      if (dialog.open) dialog.close();
      open.disabled = true;
      open.textContent = window.MindsetCall.formatRemain(state.remainMs);
    }

    function renderPledge() {
      var host = document.querySelector("#call-fields");
      var empty = document.querySelector("#call-pledge-empty");
      var fields = window.MindsetLens.fields.filter(function (field) {
        return !field.open && ownPrivate && String(ownPrivate[field.key] || "").trim();
      });
      if (!fields.length) {
        host.innerHTML = "";
        empty.hidden = false;
        return;
      }
      empty.hidden = true;
      host.innerHTML =
        '<legend class="visually-hidden">' +
        ui.escapeHtml(t("lake.callPledge")) +
        "</legend>" +
        fields
          .map(function (field) {
            var text = String(ownPrivate[field.key] || "").trim();
            return (
              '<label><input type="radio" name="call-field" value="' +
              field.key +
              '"' +
              (chosenField === field.key ? " checked" : "") +
              " /> <span>" +
              ui.escapeHtml(text) +
              "</span></label>"
            );
          })
          .join("");
    }

    function syncStart() {
      var ready = (chosenKind === "pul" && chosenField) || (chosenKind === "seslen" && chosenLine);
      document.querySelector("#call-start").disabled = !ready;
      document.querySelector("#call-description").hidden = chosenKind !== "seslen";
      document.querySelector("#call-pledge").hidden = chosenKind !== "pul";
      document.querySelector("#call-kind-seslen").checked = chosenKind === "seslen";
      document.querySelector("#call-kind-pul").checked = chosenKind === "pul";
      document.querySelectorAll("#call-lines input").forEach(function (box) {
        box.checked = box.getAttribute("data-line") === chosenLine;
      });
      if (chosenKind === "pul") renderPledge();
    }

    function openSetup() {
      var state = window.MindsetCall.phase(ownCall, broadcast, Date.now());
      if (state.name !== "idle") return;
      chosenKind = "";
      chosenLine = "";
      chosenField = "";
      syncStart();
      var dialog = document.querySelector("#call-dialog");
      if (!dialog.open) dialog.showModal();
    }

    function closeSetup() {
      var dialog = document.querySelector("#call-dialog");
      if (dialog.open) dialog.close();
    }

    document.querySelector("#call-dialog").addEventListener("close", function () {
      chosenKind = "";
      chosenLine = "";
      chosenField = "";
      paintCall();
    });

    document.querySelector("#call-open").addEventListener("click", openSetup);
    document.querySelector("#call-cancel").addEventListener("click", closeSetup);
    document.querySelector("#call-kinds").addEventListener("change", function (event) {
      var box = event.target.closest("input");
      if (!box || !box.checked) return;
      chosenKind = box.value;
      if (chosenKind === "pul") chosenLine = "";
      syncStart();
    });
    document.querySelector("#call-lines").addEventListener("change", function (event) {
      var box = event.target.closest("[data-line]");
      if (!box || !box.checked) return;
      chosenLine = box.getAttribute("data-line");
      syncStart();
    });
    document.querySelector("#call-fields").addEventListener("change", function (event) {
      var box = event.target.closest('input[name="call-field"]');
      if (!box || !box.checked) return;
      chosenField = box.value;
      syncStart();
    });
    document.querySelector("#call-start").addEventListener("click", function () {
      if (!session || !ownDoc) return;
      var kind = chosenKind;
      var line = kind === "seslen" ? chosenLine : "";
      var field = kind === "pul" ? chosenField : "";
      var text = field && ownPrivate ? String(ownPrivate[field] || "") : "";
      if (kind !== "pul" && kind !== "seslen") return;
      if (kind === "seslen" && window.MindsetCall.LINES.indexOf(line) < 0) return;
      if (kind === "pul" && (!field || !text.trim())) return;
      var started = new Date();
      var ends = new Date(started.getTime() + broadcast.durationSec * 1000);
      document.querySelector("#call-start").disabled = true;
      social
        .startCall(session, ownDoc.id, {
          kind: kind,
          line: line,
          field: field,
          text: text,
          startedAt: started,
          endsAt: ends
        })
        .then(function () {
          ownCall = {
            from: session.uid,
            fromNumber: Number(ownDoc.id),
            kind: kind,
            line: line,
            startedAt: started.toISOString(),
            endsAt: ends.toISOString()
          };
          calls[String(ownDoc.id)] = ownCall;
          if (kind === "pul") {
            shows[String(ownDoc.id)] = {
              from: session.uid,
              fromNumber: Number(ownDoc.id),
              field: field,
              text: text,
              endsAt: ends.toISOString()
            };
          }
          closeSetup();
          placeFish();
          revealOwnPul();
        })
        .catch(function (error) {
          ui.setStatus(status, ui.errorText(error), "error");
          syncStart();
        });
    });

    var polling = false;
    async function refreshCalls() {
      if (polling || !session) return;
      polling = true;
      try {
        var rows = await Promise.all([
          social.liveCalls(session).catch(function () { return []; }),
          social.ownCall(session).catch(function () { return null; }),
          social.liveShows(session).catch(function () { return null; })
        ]);
        indexCalls(rows[0], rows[1]);
        if (rows[2]) indexShows(rows[2]);
        var added = await ensureNumbers(Object.keys(calls).map(Number));
        await backfillShows();
        if (added) buildFish();
        else placeFish();
        if (bubbleFor && !liveCall(bubbleFor)) hideBubble();
        revealOwnPul();
        if (card.open && cardDoc) paintPulCard(cardDoc);
        paintCall();
      } finally {
        polling = false;
      }
    }

    var ticks = 0;
    window.setInterval(function () {
      if (!session) return;
      ticks += 1;
      paintCall();
      if (bubbleFor && !liveCall(bubbleFor)) hideBubble();
      revealOwnPul();
      placeBubble();
      if (card.open && cardDoc) paintPulCard(cardDoc);
      if (ticks % 20 === 0) refreshCalls();
    }, 1000);

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
        var socialRows = await Promise.all([
          store.findOwn(session.uid, session.idToken).catch(function () { return null; }),
          social.trailOf(session).catch(function () { return []; }),
          social.members(session).catch(function () { return []; }),
          social.incoming(session).catch(function () { return []; }),
          social.glintsToward(session).catch(function () { return []; }),
          social.liveCalls(session).catch(function () { return []; }),
          social.ownCall(session).catch(function () { return null; }),
          social.broadcastConfig(session.idToken).catch(function () { return null; }),
          social.outgoing(session).catch(function () { return []; }),
          social.liveShows(session).catch(function () { return null; })
        ]);
        ownDoc = socialRows[0] && socialRows[0].publicDoc;
        ownPrivate = socialRows[0] && socialRows[0].privateDoc;
        socialRows[1].forEach(function (row) {
          if (row.toNumber) onTrail[row.toNumber] = true;
        });
        socialRows[2].forEach(function (row) {
          if (row.number) inSchool[row.number] = true;
        });
        noteAttention(socialRows[3], socialRows[4], socialRows[1], socialRows[2]);
        broadcast = window.MindsetCall.configOf(socialRows[7]);
        (socialRows[8] || []).forEach(function (row) {
          if (row.to) asked[row.to] = true;
        });
        indexCalls(socialRows[5], socialRows[6]);
        if (socialRows[9]) indexShows(socialRows[9]);
        if (ownDoc && !pool.some(function (doc) { return doc.id === ownDoc.id; })) pool.push(ownDoc);
        await ensureNumbers(Object.keys(attention).concat(Object.keys(calls)).map(Number));
        await backfillShows();
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
        showVectors(ALL_VECTORS, 2200);
        renderRanges();
        fillDemoFilters();
        renderDemoCharts(stats);
        buildFish();
        setSpan(FOCUS_SPAN);
        refresh();
        revealOwnPul();
        paintCall();
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

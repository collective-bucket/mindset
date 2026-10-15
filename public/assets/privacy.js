(function (root) {
  "use strict";

  function digits(value) {
    return String(value).replace(/\D/g, "");
  }

  function luhn(value) {
    var number = digits(value);
    if (number.length < 13 || number.length > 19) return false;
    var sum = 0;
    for (var index = 0; index < number.length; index += 1) {
      var digit = Number(number[number.length - 1 - index]);
      if (index % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    return sum % 10 === 0;
  }

  function tcknValid(value) {
    var d = digits(value).split("").map(Number);
    if (d.length !== 11 || d[0] === 0) return false;
    var odd = d[0] + d[2] + d[4] + d[6] + d[8];
    var even = d[1] + d[3] + d[5] + d[7];
    if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false;
    var total = d.slice(0, 10).reduce(function (sum, digit) {
      return sum + digit;
    }, 0);
    return total % 10 === d[10];
  }

  function ibanValid(value) {
    var iban = String(value).replace(/\s/g, "").toUpperCase();
    if (iban.length < 15 || iban.length > 34) return false;
    var moved = iban.slice(4) + iban.slice(0, 4);
    var remainder = 0;
    for (var index = 0; index < moved.length; index += 1) {
      var code = moved.charCodeAt(index);
      var chunk = code >= 65 && code <= 90 ? String(code - 55) : moved[index];
      for (var step = 0; step < chunk.length; step += 1) {
        remainder = (remainder * 10 + Number(chunk[step])) % 97;
      }
    }
    return remainder === 1;
  }

  function phoneValid(value) {
    var count = digits(value).length;
    return count >= 10 && count <= 15;
  }

  // Order matters: earlier rules claim their characters first.
  var RULES = [
    { kind: "email", severity: "block", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
    { kind: "iban", severity: "block", pattern: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/gi, check: ibanValid },
    { kind: "card", severity: "block", pattern: /\b\d(?:[ -]?\d){12,18}\b/g, check: luhn },
    { kind: "tckn", severity: "block", pattern: /\b[1-9]\d{10}\b/g, check: tcknValid },
    {
      kind: "phone",
      severity: "block",
      pattern: /(?:\+|\b00)\d[\d\s().-]{7,16}\d|\b0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b|\(0?\d{3}\)\s?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g,
      check: phoneValid
    },
    {
      kind: "url",
      severity: "warn",
      pattern: /\b(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9-]+\.(?:com|net|org|io|me|tr|co|app|dev|info)(?:\.[a-z]{2})?(?:\/[^\s]*)?/gi
    },
    { kind: "handle", severity: "warn", pattern: /(?:^|[^\w@.])(@[a-z0-9_.]{2,30})/gi, group: 1 },
    { kind: "name", severity: "warn", pattern: /\b\p{Lu}\p{Ll}{1,}\s+\p{Lu}\p{Ll}{1,}\b/gu }
  ];

  function overlaps(taken, start, end) {
    return taken.some(function (range) {
      return start < range[1] && end > range[0];
    });
  }

  function scan(text) {
    var source = String(text || "");
    var found = [];
    var taken = [];
    RULES.forEach(function (rule) {
      rule.pattern.lastIndex = 0;
      var match;
      while ((match = rule.pattern.exec(source))) {
        var value = rule.group ? match[rule.group] : match[0];
        var start = match.index + (rule.group ? match[0].indexOf(value) : 0);
        var end = start + value.length;
        if (rule.check && !rule.check(value)) continue;
        if (overlaps(taken, start, end)) continue;
        taken.push([start, end]);
        found.push({ kind: rule.kind, severity: rule.severity, match: value, index: start });
      }
    });
    return found.sort(function (left, right) {
      return left.index - right.index;
    });
  }

  function scanFields(texts) {
    var out = {};
    Object.keys(texts || {}).forEach(function (key) {
      var findings = scan(texts[key]);
      if (findings.length) out[key] = findings;
    });
    return out;
  }

  function blocks(findings) {
    var list = Array.isArray(findings)
      ? findings
      : Object.keys(findings || {}).reduce(function (all, key) {
          return all.concat(findings[key]);
        }, []);
    return list.some(function (item) {
      return item.severity === "block";
    });
  }

  var api = {
    scan: scan,
    scanFields: scanFields,
    blocks: blocks,
    luhn: luhn,
    tcknValid: tcknValid,
    ibanValid: ibanValid
  };

  root.MindsetPrivacy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

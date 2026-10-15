"use strict";

/**
 * One-shot: delete all mindset-related data except mindset #1.
 * Does not touch ads/ or trips/.
 *
 * Usage: node scripts/wipe-except-one.js
 */

var PROJECT = "collective-bucket";
var KEEP = "1";
var DOCS = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";
var COMMIT = DOCS + ":commit";
var AUTH_ADMIN = "https://identitytoolkit.googleapis.com/v1/projects/" + PROJECT;
var DOC_PREFIX = "projects/" + PROJECT + "/databases/(default)/documents/";

function adminToken() {
  return require(process.env.HOME + "/.config/configstore/firebase-tools.json").tokens.access_token;
}

function headers(token) {
  return {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
    "x-goog-user-project": PROJECT
  };
}

function decodeValue(node) {
  if (!node) return null;
  if ("nullValue" in node) return null;
  if ("booleanValue" in node) return node.booleanValue;
  if ("integerValue" in node) return Number(node.integerValue);
  if ("doubleValue" in node) return node.doubleValue;
  if ("stringValue" in node) return node.stringValue;
  if ("arrayValue" in node) return (node.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in node) {
    var out = {};
    Object.keys((node.mapValue && node.mapValue.fields) || {}).forEach(function (key) {
      out[key] = decodeValue(node.mapValue.fields[key]);
    });
    return out;
  }
  return null;
}

function decodeDoc(doc) {
  if (!doc || !doc.name) return null;
  var data = {};
  Object.keys(doc.fields || {}).forEach(function (key) {
    data[key] = decodeValue(doc.fields[key]);
  });
  data.id = doc.name.split("/").pop();
  data._name = doc.name;
  return data;
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  var fields = {};
  Object.keys(value).forEach(function (key) {
    fields[key] = encodeValue(value[key]);
  });
  return { mapValue: { fields: fields } };
}

async function http(url, options) {
  options = options || {};
  var response = await fetch(url, {
    method: options.method || "GET",
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  var text = await response.text();
  var json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (error) {
    json = { raw: text.slice(0, 300) };
  }
  if (!response.ok) {
    var err = new Error((json && json.error && json.error.message) || text.slice(0, 200) || response.status);
    err.status = response.status;
    throw err;
  }
  return json;
}

async function listCollection(token, collectionId) {
  var rows = [];
  var pageToken = null;
  for (;;) {
    var url = DOCS + "/" + collectionId + "?pageSize=300" + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    var page = await http(url, { headers: headers(token) });
    (page.documents || []).forEach(function (doc) {
      rows.push(decodeDoc(doc));
    });
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }
  return rows;
}

async function listChildren(token, parentPath, collectionId) {
  var page = await http(DOCS + "/" + parentPath + "/" + collectionId + "?pageSize=300", {
    headers: headers(token)
  });
  return (page.documents || []).map(decodeDoc);
}

async function commitDeletes(token, names) {
  var unique = Array.from(new Set(names.filter(Boolean)));
  for (var i = 0; i < unique.length; i += 400) {
    var chunk = unique.slice(i, i + 400).map(function (name) {
      return { delete: name };
    });
    await http(COMMIT, { method: "POST", headers: headers(token), body: { writes: chunk } });
  }
}

async function deleteAuthUsers(token, uids) {
  var unique = Array.from(new Set(uids.filter(Boolean)));
  for (var i = 0; i < unique.length; i += 1) {
    var uid = unique[i];
    try {
      await http(AUTH_ADMIN + "/accounts:update", {
        method: "POST",
        headers: headers(token),
        body: { localId: uid, disableUser: true }
      });
      await http(AUTH_ADMIN + "/accounts:batchDelete", {
        method: "POST",
        headers: headers(token),
        body: { localIds: [uid] }
      });
      console.log("auth deleted", uid);
    } catch (error) {
      console.log("auth warn", uid, error.message);
    }
  }
}

async function setDoc(token, path, data) {
  var fields = {};
  Object.keys(data).forEach(function (key) {
    fields[key] = encodeValue(data[key]);
  });
  await http(COMMIT, {
    method: "POST",
    headers: headers(token),
    body: {
      writes: [{ update: { name: DOC_PREFIX + path, fields: fields } }]
    }
  });
}

async function main() {
  var reading = require("../public/assets/reading.js");
  var token = adminToken();
  var keep = decodeDoc(await http(DOCS + "/mindsets/" + KEEP, { headers: headers(token) }));
  if (!keep) throw new Error("mindset #1 missing; aborting");
  var keepUid = keep.ownerUid;
  console.log("keep #1 owner", keepUid);

  var mindsets = await listCollection(token, "mindsets");
  var toRemove = mindsets.filter(function (doc) {
    return doc.id !== KEEP;
  });
  console.log("mindsets total", mindsets.length, "remove", toRemove.length);

  var deleteNames = [];
  var authUids = [];

  for (var j = 0; j < toRemove.length; j += 1) {
    var m = toRemove[j];
    var n = m.id;
    if (m.ownerUid && m.ownerUid !== keepUid) authUids.push(m.ownerUid);

    var vers = await listChildren(token, "mindsets/" + n, "versions");
    vers.forEach(function (row) {
      deleteNames.push(row._name);
    });
    deleteNames.push(DOC_PREFIX + "mindsets/" + n);
    deleteNames.push(DOC_PREFIX + "privateMindsets/" + n);
    deleteNames.push(DOC_PREFIX + "aliasOf/" + n);
    if (m.ownerUid && m.ownerUid !== keepUid) {
      deleteNames.push(DOC_PREFIX + "owners/" + m.ownerUid);
    }
  }

  (await listCollection(token, "aliases")).forEach(function (alias) {
    if (Number(alias.number) === 1 || alias.id === "mindhunter") return;
    deleteNames.push(alias._name);
  });

  (await listCollection(token, "aliasOf")).forEach(function (row) {
    if (row.id === KEEP) return;
    deleteNames.push(row._name);
  });

  (await listCollection(token, "owners")).forEach(function (row) {
    if (row.id === keepUid) return;
    deleteNames.push(row._name);
    authUids.push(row.id);
  });

  var follows = await listCollection(token, "follows");
  for (var f = 0; f < follows.length; f += 1) {
    var followUid = follows[f].id;
    var items = await listChildren(token, "follows/" + followUid, "items");
    items.forEach(function (item) {
      if (followUid === keepUid && (String(item.number) === KEEP || item.id === KEEP)) return;
      deleteNames.push(item._name);
    });
    if (followUid !== keepUid) deleteNames.push(follows[f]._name);
  }

  var tribes = await listCollection(token, "tribes");
  for (var t = 0; t < tribes.length; t += 1) {
    var tribeUid = tribes[t].id;
    var members = await listChildren(token, "tribes/" + tribeUid, "members");
    members.forEach(function (member) {
      deleteNames.push(member._name);
    });
    if (tribeUid !== keepUid) deleteNames.push(tribes[t]._name);
  }

  (await listCollection(token, "tribeRequests")).forEach(function (row) {
    deleteNames.push(row._name);
  });

  console.log("deleting docs", Array.from(new Set(deleteNames)).length);
  await commitDeletes(token, deleteNames);
  await deleteAuthUsers(token, authUids);

  var priv = null;
  try {
    priv = decodeDoc(await http(DOCS + "/privateMindsets/" + KEEP, { headers: headers(token) }));
  } catch (error) {
    priv = null;
  }

  var totals = { lens: "v2", count: 0, axes: {}, byAge: {}, byGender: {}, byCountry: {}, cities: {} };
  function bump(obj, parts, by) {
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i += 1) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
    var leaf = parts[parts.length - 1];
    cur[leaf] = (cur[leaf] || 0) + by;
  }
  reading
    .histogramDelta(null, {
      published: keep.published === true,
      scores: reading.scoresOf(keep),
      demo: reading.demoOf(keep, priv)
    })
    .forEach(function (delta) {
      bump(totals, delta.path.split("."), delta.by);
    });

  await setDoc(token, "stats/public", totals);
  await setDoc(token, "counters/mindset", { next: 2 });

  var left = await listCollection(token, "mindsets");
  console.log(
    JSON.stringify(
      {
        remaining: left.map(function (row) {
          return row.id;
        }),
        statsCount: totals.count,
        authDeleted: Array.from(new Set(authUids)).length
      },
      null,
      2
    )
  );
  if (left.length !== 1 || left[0].id !== KEEP) throw new Error("wipe incomplete");
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});

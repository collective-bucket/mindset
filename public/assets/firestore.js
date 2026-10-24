(function () {
  "use strict";

  var PROJECT = window.MindsetConfig.projectId;
  var API_KEY = window.MindsetConfig.apiKey;
  var DB = "projects/" + PROJECT + "/databases/(default)";
  var ROOT = "https://firestore.googleapis.com/v1/" + DB + "/documents";

  function withKey(url) {
    var sep = url.indexOf("?") >= 0 ? "&" : "?";
    return url + sep + "key=" + encodeURIComponent(API_KEY);
  }

  function encodePath(path) {
    return String(path)
      .split("/")
      .map(encodeURIComponent)
      .join("/");
  }

  function docName(path) {
    return DB + "/documents/" + path;
  }

  function encodeValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number") {
      return Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    }
    if (typeof value === "string") return { stringValue: value };
    if (Array.isArray(value)) {
      return { arrayValue: { values: value.map(encodeValue) } };
    }
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (typeof value === "object") {
      return { mapValue: { fields: encodeFields(value) } };
    }
    throw new Error("Unsupported field type");
  }

  function decodeValue(node) {
    if (!node || typeof node !== "object") return null;
    if ("nullValue" in node) return null;
    if ("booleanValue" in node) return node.booleanValue;
    if ("integerValue" in node) return Number(node.integerValue);
    if ("doubleValue" in node) return node.doubleValue;
    if ("stringValue" in node) return node.stringValue;
    if ("timestampValue" in node) return node.timestampValue;
    if ("arrayValue" in node) {
      return (node.arrayValue.values || []).map(decodeValue);
    }
    if ("mapValue" in node) {
      var out = {};
      var fields = (node.mapValue && node.mapValue.fields) || {};
      Object.keys(fields).forEach(function (key) {
        out[key] = decodeValue(fields[key]);
      });
      return out;
    }
    return null;
  }

  function decodeDocument(doc) {
    if (!doc || !doc.name) return null;
    var data = {};
    var fields = doc.fields || {};
    Object.keys(fields).forEach(function (key) {
      data[key] = decodeValue(fields[key]);
    });
    data.id = doc.name.split("/").pop();
    return data;
  }

  function encodeFields(data) {
    var fields = {};
    Object.keys(data).forEach(function (key) {
      if (key === "id") return;
      fields[key] = encodeValue(data[key]);
    });
    return fields;
  }

  function fieldMask(data) {
    return Object.keys(data).filter(function (key) {
      return key !== "id";
    });
  }

  async function request(path, options) {
    options = options || {};
    var headers = { "Content-Type": "application/json" };
    if (options.token) headers.Authorization = "Bearer " + options.token;

    var url = path.indexOf("http") === 0 ? path : ROOT + path;
    var response = await fetch(withKey(url), {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (response.status === 404 && (options.method || "GET") === "GET") return null;

    var text = await response.text();
    var json = text ? JSON.parse(text) : null;
    if (!response.ok) {
      var rowError = Array.isArray(json) && json[0] && json[0].error;
      var message =
        (json && json.error && json.error.message) ||
        (rowError && rowError.message) ||
        "Firestore request failed (" + response.status + ")";
      var error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return json;
  }

  function isConflict(error) {
    return Boolean(
      error &&
        (error.status === 409 || /already exists/i.test(String(error.message || "")))
    );
  }

  function isPermission(error) {
    return Boolean(
      error &&
        (error.status === 403 || /permission/i.test(String(error.message || "")))
    );
  }

  async function get(path, token) {
    return decodeDocument(await request("/" + encodePath(path), { token: token }));
  }

  // options.paths adds "_path" (relative to the database root) to every row,
  // which collection group queries need to know whose subcollection a row is.
  async function runQuery(structuredQuery, token, parentPath, options) {
    var prefix = parentPath ? "/" + encodePath(parentPath) : "";
    var rows = await request(prefix + ":runQuery", {
      method: "POST",
      token: token,
      body: { structuredQuery: structuredQuery }
    });
    if (!Array.isArray(rows)) return [];
    return rows
      .map(function (row) {
        var doc = decodeDocument(row.document);
        if (doc && options && options.paths) {
          doc._path = row.document.name.split("/documents/")[1];
        }
        return doc;
      })
      .filter(Boolean);
  }

  function equals(field, value) {
    return {
      fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: encodeValue(value) }
    };
  }

  function inList(field, values) {
    return {
      fieldFilter: {
        field: { fieldPath: field },
        op: "IN",
        value: { arrayValue: { values: values.map(encodeValue) } }
      }
    };
  }

  function above(field, value) {
    return {
      fieldFilter: {
        field: { fieldPath: field },
        op: "GREATER_THAN",
        value: encodeValue(value)
      }
    };
  }

  function atLeast(field, value) {
    return {
      fieldFilter: {
        field: { fieldPath: field },
        op: "GREATER_THAN_OR_EQUAL",
        value: encodeValue(value)
      }
    };
  }

  function where(filters) {
    if (filters.length === 1) return filters[0];
    return { compositeFilter: { op: "AND", filters: filters } };
  }

  async function create(collectionPath, id, data, token) {
    var doc = await request(
      "/" + encodePath(collectionPath) + "?documentId=" + encodeURIComponent(id),
      { method: "POST", token: token, body: { fields: encodeFields(data) } }
    );
    return decodeDocument(doc);
  }

  async function update(path, data, token) {
    var mask = fieldMask(data)
      .map(function (key) {
        return "updateMask.fieldPaths=" + encodeURIComponent(key);
      })
      .join("&");
    var doc = await request("/" + encodePath(path) + (mask ? "?" + mask : ""), {
      method: "PATCH",
      token: token,
      body: { fields: encodeFields(data) }
    });
    return decodeDocument(doc);
  }

  async function remove(path, token) {
    await request("/" + encodePath(path), { method: "DELETE", token: token });
  }

  var writes = {
    create: function (path, data) {
      return {
        update: { name: docName(path), fields: encodeFields(data) },
        currentDocument: { exists: false }
      };
    },
    set: function (path, data) {
      return { update: { name: docName(path), fields: encodeFields(data) } };
    },
    patch: function (path, data) {
      return {
        update: { name: docName(path), fields: encodeFields(data) },
        updateMask: { fieldPaths: fieldMask(data) },
        currentDocument: { exists: true }
      };
    },
    remove: function (path) {
      return { delete: docName(path) };
    },
    increment: function (path, deltas) {
      return {
        transform: {
          document: docName(path),
          fieldTransforms: deltas.map(function (delta) {
            return {
              fieldPath: delta.path,
              increment: { integerValue: String(delta.by) }
            };
          })
        }
      };
    }
  };

  async function commit(list, token) {
    if (!list.length) return;
    await request(":commit", { method: "POST", token: token, body: { writes: list } });
  }

  window.MindsetFirestore = {
    get: get,
    runQuery: runQuery,
    equals: equals,
    inList: inList,
    above: above,
    atLeast: atLeast,
    where: where,
    create: create,
    update: update,
    remove: remove,
    writes: writes,
    commit: commit,
    isConflict: isConflict,
    isPermission: isPermission
  };
})();

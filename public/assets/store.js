(function () {
  "use strict";

  var PAGE = 24;

  function db() {
    return window.MindsetFirestore;
  }

  function reading() {
    return window.MindsetReading;
  }

  async function waitForAuth() {
    var deadline = Date.now() + 15000;
    while (!window.MindsetAuth) {
      if (Date.now() > deadline) throw new Error("Auth did not load.");
      await new Promise(function (resolve) {
        setTimeout(resolve, 40);
      });
    }
    return window.MindsetAuth;
  }

  async function getOptionalSession() {
    try {
      var auth = await waitForAuth();
      return await auth.session(false);
    } catch (error) {
      return null;
    }
  }

  async function requireSession() {
    var auth = await waitForAuth();
    var session = await auth.session(true);
    if (!session) {
      var error = new Error("Sign in to continue.");
      error.code = "login_required";
      throw error;
    }
    return session;
  }

  async function bumpCounter(token, atLeast) {
    var counter = await db().get("counters/mindset", token);
    if (!counter) {
      try {
        await db().create("counters", "mindset", { next: atLeast }, token);
        return;
      } catch (error) {
        if (!db().isConflict(error)) throw error;
        counter = await db().get("counters/mindset", token);
      }
    }
    while (counter && counter.next < atLeast) {
      counter = await db().update(
        "counters/mindset",
        { next: Math.min(atLeast, counter.next + 8) },
        token
      );
    }
  }

  async function writePrivate(number, privateDoc, token, existing) {
    var path = "privateMindsets/" + number;
    if (existing) return db().update(path, privateDoc, token);
    try {
      return await db().create("privateMindsets", String(number), privateDoc, token);
    } catch (error) {
      if (!db().isConflict(error)) throw error;
      return db().update(path, privateDoc, token);
    }
  }

  async function ensureOwner(uid, number, token) {
    var owner = await db().get("owners/" + uid, token);
    if (owner && owner.number === number) return;
    if (owner) {
      await db().update("owners/" + uid, { number: number }, token);
      return;
    }
    try {
      await db().create("owners", uid, { number: number }, token);
    } catch (error) {
      if (!db().isConflict(error)) throw error;
      await db().update("owners/" + uid, { number: number }, token);
    }
  }

  async function findOwn(uid, token) {
    var owner = await db().get("owners/" + uid, token);
    if (owner && owner.number) {
      var owned = await db().get("mindsets/" + owner.number, token);
      if (owned && owned.ownerUid === uid) {
        return {
          publicDoc: owned,
          privateDoc: await db().get("privateMindsets/" + owner.number, token)
        };
      }
    }
    var rows = await db().runQuery(
      {
        from: [{ collectionId: "mindsets" }],
        where: db().equals("ownerUid", uid),
        limit: 1
      },
      token
    );
    if (!rows.length) return null;
    var publicDoc = rows[0];
    var privateDoc = await db().get("privateMindsets/" + publicDoc.id, token);
    await ensureOwner(uid, Number(publicDoc.id), token);
    return { publicDoc: publicDoc, privateDoc: privateDoc };
  }

  function placementOf(publicDoc, privateDoc) {
    if (!publicDoc) return null;
    return {
      published: publicDoc.published === true,
      scores: reading().scoresOf(publicDoc),
      demo: reading().demoOf(publicDoc, privateDoc)
    };
  }

  async function adjustStats(token, previous, next) {
    var deltas = reading().histogramDelta(previous, next);
    if (!deltas.length) return;
    var current = await db().get("stats/public", token);
    if (!current) {
      try {
        await db().create("stats", "public", { lens: "v2", count: 0, axes: {} }, token);
      } catch (error) {
        if (!db().isConflict(error)) throw error;
      }
    }
    await db().commit([db().writes.increment("stats/public", deltas)], token);
  }

  async function allocate(uid, token, texts, scores, demo, now) {
    var lastError = null;
    for (var attempt = 0; attempt < 8; attempt += 1) {
      var counter = await db().get("counters/mindset", token);
      var number = counter ? counter.next : 1;
      var docs = reading().buildDocuments(uid, number, texts, scores, true, now, now, demo, "none");
      try {
        await db().create("mindsets", String(number), docs.publicDoc, token);
      } catch (error) {
        lastError = error;
        if (!db().isConflict(error)) throw error;
        await bumpCounter(token, number + 1);
        continue;
      }
      await writePrivate(number, docs.privateDoc, token, false);
      await ensureOwner(uid, number, token);
      try {
        await bumpCounter(token, number + 1);
      } catch (error) {
        // The number is already on the document; the next writer advances the counter.
      }
      return { number: number, previous: null, publicDoc: docs.publicDoc };
    }
    throw lastError || new Error("Couldn't allocate a number.");
  }

  function writeVersion(publicDoc, token) {
    return db().create(
      "mindsets/" + publicDoc.number + "/versions",
      reading().versionId(publicDoc.updatedAt),
      reading().buildVersion(publicDoc),
      token
    );
  }

  async function publish(session, texts, scores, demo, alias) {
    var token = session.idToken;
    var now = new Date().toISOString();
    var existing = await findOwn(session.uid, token);
    var saved;
    if (!existing) {
      saved = await allocate(session.uid, token, texts, scores, demo, now);
    } else {
      var number = Number(existing.publicDoc.id);
      var docs = reading().buildDocuments(
        session.uid,
        number,
        texts,
        scores,
        true,
        existing.publicDoc.createdAt,
        now,
        demo,
        existing.publicDoc.history
      );
      await db().update("mindsets/" + number, docs.publicDoc, token);
      await writePrivate(number, docs.privateDoc, token, Boolean(existing.privateDoc));
      await ensureOwner(session.uid, number, token);
      saved = {
        number: number,
        previous: placementOf(existing.publicDoc, existing.privateDoc),
        publicDoc: docs.publicDoc
      };
    }

    var warning = false;
    try {
      await writeVersion(saved.publicDoc, token);
    } catch (error) {
      warning = true;
    }
    var aliasFailed = null;
    if (alias) {
      try {
        var current = await window.MindsetSocial.aliasOf(saved.number, token);
        await window.MindsetSocial.setAlias(session, saved.number, alias, current && current.alias);
      } catch (error) {
        aliasFailed = error;
      }
    }
    try {
      await adjustStats(token, saved.previous, {
        published: true,
        scores: scores,
        demo: demo
      });
    } catch (error) {
      warning = true;
    }
    return { number: saved.number, warning: warning, aliasError: aliasFailed };
  }

  async function setHistory(session, level) {
    var existing = await findOwn(session.uid, session.idToken);
    if (!existing) {
      var error = new Error("No mindset.");
      error.i18n = "common.needMindset";
      throw error;
    }
    level = reading().historyLevel(level);
    await db().update("mindsets/" + existing.publicDoc.id, { history: level }, session.idToken);
    return level;
  }

  function versions(number, token) {
    return db().runQuery(
      {
        from: [{ collectionId: "versions" }],
        orderBy: [{ field: { fieldPath: "createdAt" }, direction: "ASCENDING" }],
        limit: 120
      },
      token,
      "mindsets/" + number
    );
  }

  async function ensureFirstVersion(publicDoc, token) {
    if (!publicDoc || !publicDoc.updatedAt) return false;
    var rows = await versions(publicDoc.id, token);
    if (rows.length) return false;
    await writeVersion(publicDoc, token);
    return true;
  }

  async function removeVersions(number, token) {
    var rows = await versions(number, token);
    var writes = db().writes;
    for (var index = 0; index < rows.length; index += 400) {
      await db().commit(
        rows.slice(index, index + 400).map(function (row) {
          return writes.remove("mindsets/" + number + "/versions/" + row.id);
        }),
        token
      );
    }
  }

  async function setPublished(session, published) {
    var token = session.idToken;
    var existing = await findOwn(session.uid, token);
    if (!existing) {
      var error = new Error("No mindset.");
      error.i18n = "common.needMindset";
      throw error;
    }
    var number = Number(existing.publicDoc.id);
    await db().update(
      "mindsets/" + number,
      { published: published, updatedAt: new Date().toISOString() },
      token
    );
    var previous = placementOf(existing.publicDoc, existing.privateDoc);
    var warning = false;
    try {
      await adjustStats(token, previous, {
        published: published,
        scores: previous.scores,
        demo: previous.demo
      });
    } catch (error) {
      warning = true;
    }
    return { number: number, warning: warning };
  }

  async function remove(session) {
    var token = session.idToken;
    var existing = await findOwn(session.uid, token);
    if (!existing) return;
    var number = existing.publicDoc.id;
    try {
      await adjustStats(token, placementOf(existing.publicDoc, existing.privateDoc), null);
    } catch (error) {
      // Deleting continues even if the distribution can't be updated.
    }
    await window.MindsetSocial.cleanup(session, number);
    await removeVersions(number, token);
    if (existing.privateDoc) await db().remove("privateMindsets/" + number, token);
    await db().remove("mindsets/" + number, token);
    await db().remove("owners/" + session.uid, token);
  }

  function publishedFilter() {
    return db().equals("published", true);
  }

  async function listPublic(options) {
    options = options || {};
    var filters = [publishedFilter()];
    if (options.sliceField && options.sliceValue) {
      filters.push(db().equals(options.sliceField, options.sliceValue));
    }
    var orderField = "number";
    if (options.axis && reading().OPEN_KEYS.indexOf(options.axis) >= 0) {
      filters.push(db().atLeast(options.axis, Number(options.min || 0)));
      orderField = options.axis;
    }
    return db().runQuery({
      from: [{ collectionId: "mindsets" }],
      where: db().where(filters),
      orderBy: [{ field: { fieldPath: orderField }, direction: "DESCENDING" }],
      limit: options.limit || PAGE
    });
  }

  function recent(limit, token) {
    return db().runQuery(
      {
        from: [{ collectionId: "mindsets" }],
        where: publishedFilter(),
        orderBy: [{ field: { fieldPath: "updatedAt" }, direction: "DESCENDING" }],
        limit: limit || PAGE
      },
      token
    );
  }

  async function byNumbers(numbers, token) {
    var unique = numbers
      .map(Number)
      .filter(function (value, index, list) {
        return value > 0 && list.indexOf(value) === index;
      });
    var rows = [];
    for (var index = 0; index < unique.length; index += 30) {
      var chunk = unique.slice(index, index + 30);
      var found = await db().runQuery(
        {
          from: [{ collectionId: "mindsets" }],
          where: db().where([publishedFilter(), db().inList("number", chunk)]),
          limit: chunk.length
        },
        token
      );
      rows = rows.concat(found);
    }
    return rows.sort(function (left, right) {
      return right.number - left.number;
    });
  }

  async function similar(doc, options) {
    options = options || {};
    if (!doc || !doc.bucket || /^u{4}$/.test(doc.bucket)) return [];
    var filters = [
      publishedFilter(),
      db().inList("bucket", reading().neighborBuckets(doc.bucket).slice(0, 30))
    ];
    if (options.country) filters.push(db().equals("country", options.country));
    if (options.ageBand) filters.push(db().equals("ageBand", options.ageBand));
    var rows = await db().runQuery({
      from: [{ collectionId: "mindsets" }],
      where: db().where(filters),
      limit: PAGE
    });
    var exclude = options.exclude || {};
    var mine = reading().scoresOf(doc);
    return rows
      .filter(function (row) {
        return row.id !== doc.id && !exclude[row.id];
      })
      .map(function (row) {
        return { row: row, distance: reading().scoreDistance(mine, reading().scoresOf(row)) };
      })
      .sort(function (left, right) {
        return left.distance - right.distance;
      })
      .slice(0, options.limit || 6)
      .map(function (item) {
        return item.row;
      });
  }

  function getStats() {
    return db().get("stats/public");
  }

  window.MindsetStore = {
    getOptionalSession: getOptionalSession,
    requireSession: requireSession,
    findOwn: findOwn,
    publish: publish,
    setPublished: setPublished,
    setHistory: setHistory,
    versions: versions,
    ensureFirstVersion: ensureFirstVersion,
    remove: remove,
    recent: recent,
    listPublic: listPublic,
    byNumbers: byNumbers,
    similar: similar,
    getStats: getStats
  };
})();

(function () {
  "use strict";

  var db = function () {
    return window.MindsetFirestore;
  };

  async function waitForAuth() {
    var deadline = Date.now() + 10000;
    while (!window.CollectiveBucketAuth) {
      if (Date.now() > deadline) throw new Error("Oturum servisi yüklenemedi.");
      await new Promise(function (resolve) {
        setTimeout(resolve, 50);
      });
    }
    return window.CollectiveBucketAuth;
  }

  async function getOptionalSession() {
    try {
      var client = await waitForAuth();
      var current = client.getCurrentSession && client.getCurrentSession();
      if (current && current.idToken) return current;
      return await client.getSession({ forceRefresh: false });
    } catch (error) {
      return null;
    }
  }

  async function requireSession() {
    var client = await waitForAuth();
    var session = await client.getSession({ forceRefresh: true });
    if (!session || !session.idToken) throw new Error("Kaydetmek için giriş yap.");
    return session;
  }

  function loginUrl() {
    return (
      window.MindsetConfig.authOrigin +
      "/?returnTo=" +
      encodeURIComponent(window.location.href)
    );
  }

  function strip(doc) {
    if (!doc) return null;
    var copy = Object.assign({}, doc);
    delete copy.id;
    return copy;
  }

  async function bumpCounter(token, atLeast) {
    var firestore = db();
    var counter = await firestore.getDocument("counters", "mindset", token);
    if (!counter) {
      try {
        await firestore.createDocument("counters", "mindset", { next: atLeast }, token);
        return;
      } catch (error) {
        if (!firestore.isConflict(error)) throw error;
        counter = await firestore.getDocument("counters", "mindset", token);
      }
    }
    while (counter && counter.next < atLeast) {
      var step = Math.min(atLeast, counter.next + 8);
      counter = await firestore.updateDocument(
        "counters",
        "mindset",
        { next: step },
        token
      );
    }
  }

  async function writePrivate(number, privateDoc, token, existing) {
    var firestore = db();
    if (existing) {
      return firestore.updateDocument(
        "privateMindsets",
        String(number),
        privateDoc,
        token
      );
    }
    try {
      return await firestore.createDocument(
        "privateMindsets",
        String(number),
        privateDoc,
        token
      );
    } catch (error) {
      if (!firestore.isConflict(error)) throw error;
      return firestore.updateDocument(
        "privateMindsets",
        String(number),
        privateDoc,
        token
      );
    }
  }

  async function ensureOwner(uid, number, token) {
    var firestore = db();
    var owner = await firestore.getDocument("owners", uid, token);
    if (owner && owner.number === number) return;
    if (owner) {
      await firestore.updateDocument("owners", uid, { number: number }, token);
      return;
    }
    try {
      await firestore.createDocument("owners", uid, { number: number }, token);
    } catch (error) {
      if (!firestore.isConflict(error)) throw error;
      await firestore.updateDocument("owners", uid, { number: number }, token);
    }
  }

  async function findOwn(uid, token) {
    var firestore = db();
    var owner = await firestore.getDocument("owners", uid, token);
    if (owner && owner.number) {
      var owned = await firestore.getDocument("mindsets", String(owner.number), token);
      if (owned && owned.ownerUid === uid) {
        var ownedPrivate = await firestore.getDocument(
          "privateMindsets",
          String(owner.number),
          token
        );
        return { publicDoc: owned, privateDoc: ownedPrivate };
      }
    }

    var rows = await firestore.queryEquals("mindsets", "ownerUid", uid, token, 5);
    if (!rows.length) return null;
    var publicDoc = rows[0];
    var privateDoc = await firestore.getDocument(
      "privateMindsets",
      publicDoc.id,
      token
    );
    await ensureOwner(uid, Number(publicDoc.id), token);
    return { publicDoc: publicDoc, privateDoc: privateDoc };
  }

  function emptyStats() {
    function buckets() {
      return { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
    }
    return {
      lens: "v1",
      axes: {
        agency: buckets(),
        communion: buckets(),
        codeClarity: buckets(),
        redemption: buckets()
      }
    };
  }

  async function adjustHistogram(token, previous, next) {
    var deltas = window.MindsetReading.histogramDelta(previous, next);
    if (!deltas.length) return;
    var current = await db().getDocument("stats", "public", token);
    if (!current) {
      try {
        await db().createDocument("stats", "public", emptyStats(), token);
      } catch (error) {
        if (!db().isConflict(error)) throw error;
      }
    }
    await db().incrementFields("stats", "public", deltas, token);
  }

  function previousPlacement(doc) {
    if (!doc) return null;
    return {
      published: doc.published === true,
      scores: window.MindsetReading.scoresOf(doc)
    };
  }

  async function allocate(uid, token, texts, scores, now) {
    var firestore = db();
    var lastError = null;
    for (var attempt = 0; attempt < 8; attempt += 1) {
      var counter = await firestore.getDocument("counters", "mindset", token);
      var number = counter ? counter.next : 1;
      var docs = window.MindsetReading.buildDocuments(
        uid,
        number,
        texts,
        scores,
        true,
        now,
        now
      );
      try {
        await firestore.createDocument(
          "mindsets",
          String(number),
          docs.publicDoc,
          token
        );
      } catch (error) {
        lastError = error;
        if (!firestore.isConflict(error)) throw error;
        await bumpCounter(token, number + 1);
        continue;
      }
      await writePrivate(number, docs.privateDoc, token, false);
      await ensureOwner(uid, number, token);
      try {
        await bumpCounter(token, number + 1);
      } catch (error) {
        // Numara belgede durur. Sayaç bir sonraki denemede ilerler.
      }
      return { number: number, docs: docs, previous: null };
    }
    throw lastError || new Error("Numara ayrılamadı.");
  }

  async function publish(session, texts, scores) {
    var token = session.idToken;
    var now = new Date().toISOString();
    var existing = await findOwn(session.uid, token);
    var saved;
    if (!existing) {
      saved = await allocate(session.uid, token, texts, scores, now);
    } else {
      var number = Number(existing.publicDoc.id);
      var docs = window.MindsetReading.buildDocuments(
        session.uid,
        number,
        texts,
        scores,
        true,
        existing.publicDoc.createdAt,
        now
      );
      await db().updateDocument("mindsets", String(number), docs.publicDoc, token);
      await writePrivate(number, docs.privateDoc, token, Boolean(existing.privateDoc));
      await ensureOwner(session.uid, number, token);
      saved = {
        number: number,
        docs: docs,
        previous: previousPlacement(existing.publicDoc)
      };
    }

    var warning = "";
    try {
      await adjustHistogram(token, saved.previous, {
        published: true,
        scores: scores
      });
    } catch (error) {
      warning = "Mindset kaydedildi. Dağılım güncellenemedi.";
    }
    return { number: saved.number, warning: warning };
  }

  async function setPublished(session, published) {
    var token = session.idToken;
    var existing = await findOwn(session.uid, token);
    if (!existing) throw new Error("Mindsetin yok.");
    var number = Number(existing.publicDoc.id);
    var scores = window.MindsetReading.scoresOf(existing.publicDoc);
    var privateScores = window.MindsetReading.scoresOf(existing.privateDoc);
    Object.keys(privateScores).forEach(function (key) {
      if (window.MindsetReading.CLOSED_KEYS.indexOf(key) >= 0) {
        scores[key] = privateScores[key];
      }
    });
    var texts = {
      currentPosition: existing.publicDoc.currentPosition || "",
      personalCode: existing.publicDoc.personalCode || "",
      selfNarrative: existing.publicDoc.selfNarrative || "",
      unsayableAttitude: (existing.privateDoc && existing.privateDoc.unsayableAttitude) || "",
      desireScript: (existing.privateDoc && existing.privateDoc.desireScript) || "",
      disownedSelf: (existing.privateDoc && existing.privateDoc.disownedSelf) || ""
    };
    var docs = window.MindsetReading.buildDocuments(
      session.uid,
      number,
      texts,
      scores,
      published,
      existing.publicDoc.createdAt,
      new Date().toISOString()
    );
    await db().updateDocument("mindsets", String(number), docs.publicDoc, token);
    var warning = "";
    try {
      await adjustHistogram(token, previousPlacement(existing.publicDoc), {
        published: published,
        scores: scores
      });
    } catch (error) {
      warning = "Yayın durumu değişti. Dağılım güncellenemedi.";
    }
    return { number: number, warning: warning };
  }

  async function remove(session) {
    var token = session.idToken;
    var existing = await findOwn(session.uid, token);
    if (!existing) return;
    var scores = window.MindsetReading.scoresOf(existing.publicDoc);
    try {
      await adjustHistogram(token, previousPlacement(existing.publicDoc), {
        published: false,
        scores: scores
      });
    } catch (error) {
      // Silme, dağılım hatasında da sürer.
    }
    if (existing.privateDoc) {
      await db().deleteDocument("privateMindsets", existing.publicDoc.id, token);
    }
    await db().deleteDocument("mindsets", existing.publicDoc.id, token);
    await db().deleteDocument("owners", session.uid, token);
  }

  async function listPublic(axis, min) {
    var filters = [
      {
        fieldFilter: {
          field: { fieldPath: "published" },
          op: "EQUAL",
          value: { booleanValue: true }
        }
      }
    ];
    var orderField = "number";
    if (axis) {
      filters.push({
        fieldFilter: {
          field: { fieldPath: axis },
          op: "GREATER_THAN_OR_EQUAL",
          value: { integerValue: String(min) }
        }
      });
      orderField = axis;
    }
    return db().runQuery({
      from: [{ collectionId: "mindsets" }],
      where: { compositeFilter: { op: "AND", filters: filters } },
      orderBy: [{ field: { fieldPath: orderField }, direction: "DESCENDING" }],
      limit: 24
    });
  }

  window.MindsetStore = {
    getOptionalSession: getOptionalSession,
    requireSession: requireSession,
    loginUrl: loginUrl,
    findOwn: findOwn,
    publish: publish,
    setPublished: setPublished,
    remove: remove,
    listPublic: listPublic,
    strip: strip
  };
})();

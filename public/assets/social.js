(function () {
  "use strict";

  var ALIAS_PATTERN = /^[a-z0-9_]{3,20}$/;

  function db() {
    return window.MindsetFirestore;
  }

  function now() {
    return new Date().toISOString();
  }

  async function quietGet(path, token) {
    try {
      return await db().get(path, token);
    } catch (error) {
      if (db().isPermission(error)) return null;
      throw error;
    }
  }

  async function listChildren(parentPath, collectionId, token, limit) {
    return db().runQuery(
      { from: [{ collectionId: collectionId }], limit: limit || 200 },
      token,
      parentPath
    );
  }

  var CLOSED_FIELDS = ["unsayableAttitude", "desireScript", "disownedSelf"];
  var GLINT_DAYS = 7;

  function pairId(from, to) {
    return from + "_" + to;
  }

  // ---- Step 1: tails. A swims after B; B sees it on the current screen. ----

  async function tailing(session, otherUid) {
    return quietGet("tails/" + pairId(session.uid, otherUid), session.idToken);
  }

  async function tail(session, myNumber, otherUid, otherNumber) {
    try {
      await db().create(
        "tails",
        pairId(session.uid, otherUid),
        {
          from: session.uid,
          to: otherUid,
          fromNumber: Number(myNumber),
          toNumber: Number(otherNumber),
          createdAt: now()
        },
        session.idToken
      );
    } catch (error) {
      if (!db().isConflict(error)) throw error;
    }
  }

  function untail(session, otherUid) {
    return db().remove("tails/" + pairId(session.uid, otherUid), session.idToken);
  }

  // B waves a tail off: nobody is told, the tail simply goes.
  function dismissTail(session, fromUid) {
    return db().remove("tails/" + pairId(fromUid, session.uid), session.idToken);
  }

  function tailQuery(session, field) {
    return db().runQuery(
      { from: [{ collectionId: "tails" }], where: db().equals(field, session.uid), limit: 300 },
      session.idToken
    );
  }

  // Fish that swim after me.
  function tailersOf(session) {
    return tailQuery(session, "to");
  }

  // Fish I swim after.
  function trailOf(session) {
    return tailQuery(session, "from");
  }

  async function trailNumbers(session) {
    var rows = await trailOf(session);
    return rows.map(function (row) {
      return Number(row.toNumber);
    });
  }

  // ---- Step 2: glints. B shows A one closed field, for a week. ----

  function glintLive(glint) {
    if (!glint) return false;
    var until = new Date(glint.expiresAt).getTime();
    return Number.isNaN(until) ? false : until > Date.now();
  }

  async function shine(session, myNumber, otherUid, otherNumber, field, text) {
    if (CLOSED_FIELDS.indexOf(field) < 0 || !String(text || "").trim()) {
      throw aliasError("profile.pick");
    }
    var created = new Date();
    var expires = new Date(created.getTime() + GLINT_DAYS * 24 * 3600 * 1000 - 60 * 1000);
    await db().commit(
      [
        db().writes.set("glints/" + pairId(session.uid, otherUid), {
          from: session.uid,
          to: otherUid,
          fromNumber: Number(myNumber),
          toNumber: Number(otherNumber),
          field: field,
          text: text,
          createdAt: created.toISOString(),
          expiresAt: expires
        })
      ],
      session.idToken
    );
  }

  function withdrawGlint(session, otherUid) {
    return db().remove("glints/" + pairId(session.uid, otherUid), session.idToken);
  }

  // What they showed me; null once it ran out and we are not a school.
  function glintFrom(session, otherUid) {
    return quietGet("glints/" + pairId(otherUid, session.uid), session.idToken);
  }

  function glintTo(session, otherUid) {
    return quietGet("glints/" + pairId(session.uid, otherUid), session.idToken);
  }

  function myGlints(session) {
    return db().runQuery(
      {
        from: [{ collectionId: "glints" }],
        where: db().equals("from", session.uid),
        limit: 300
      },
      session.idToken
    );
  }

  // ---- Step 3: school requests, with one sealed pledge. ----

  async function relation(session, otherUid) {
    if (!session || session.uid === otherUid) return { self: true };
    var me = session.uid;
    var token = session.idToken;
    var rows = await Promise.all([
      quietGet("schools/" + me + "/members/" + otherUid, token),
      quietGet("tails/" + pairId(me, otherUid), token),
      quietGet("tails/" + pairId(otherUid, me), token),
      glintFrom(session, otherUid),
      glintTo(session, otherUid),
      quietGet("schoolRequests/" + pairId(me, otherUid), token),
      quietGet("schoolRequests/" + pairId(otherUid, me), token)
    ]);
    return {
      self: false,
      member: Boolean(rows[0]),
      iTail: Boolean(rows[1]),
      theyTail: Boolean(rows[2]),
      theirGlint: rows[3],
      myGlint: rows[4],
      outgoing: Boolean(rows[5]),
      incoming: Boolean(rows[6])
    };
  }

  async function requestSchool(session, myNumber, otherUid, otherNumber, field, text) {
    var id = pairId(session.uid, otherUid);
    var created = now();
    var base = {
      from: session.uid,
      to: otherUid,
      fromNumber: Number(myNumber),
      toNumber: Number(otherNumber),
      field: field,
      createdAt: created
    };
    var writes = db().writes;
    try {
      await db().commit(
        [
          writes.set("seals/" + id, Object.assign({}, base, { text: text })),
          writes.create("schoolRequests/" + id, base)
        ],
        session.idToken
      );
    } catch (error) {
      if (db().isPermission(error)) throw aliasError("common.permission");
      throw error;
    }
  }

  function cancel(session, toUid) {
    var id = pairId(session.uid, toUid);
    var writes = db().writes;
    return db().commit([writes.remove("schoolRequests/" + id), writes.remove("seals/" + id)], session.idToken);
  }

  function decline(session, fromUid) {
    var id = pairId(fromUid, session.uid);
    var writes = db().writes;
    return db().commit([writes.remove("schoolRequests/" + id), writes.remove("seals/" + id)], session.idToken);
  }

  async function accept(session, fromUid) {
    var token = session.idToken;
    var id = pairId(fromUid, session.uid);
    var request = await db().get("schoolRequests/" + id, token);
    if (!request) return;
    var since = now();
    var writes = db().writes;
    var reverse = pairId(session.uid, fromUid);
    await db().commit(
      [
        writes.create("schools/" + session.uid + "/members/" + fromUid, {
          uid: fromUid,
          number: request.fromNumber,
          since: since
        }),
        writes.create("schools/" + fromUid + "/members/" + session.uid, {
          uid: session.uid,
          number: request.toNumber,
          since: since
        }),
        writes.remove("schoolRequests/" + id),
        writes.remove("schoolRequests/" + reverse),
        writes.remove("seals/" + reverse)
      ],
      token
    );
  }

  function pairLeftovers(me, other) {
    var writes = db().writes;
    return [
      writes.remove("tails/" + pairId(me, other)),
      writes.remove("tails/" + pairId(other, me)),
      writes.remove("glints/" + pairId(me, other)),
      writes.remove("glints/" + pairId(other, me)),
      writes.remove("seals/" + pairId(me, other)),
      writes.remove("seals/" + pairId(other, me))
    ];
  }

  function leave(session, otherUid) {
    var writes = db().writes;
    return db().commit(
      [
        writes.remove("schools/" + session.uid + "/members/" + otherUid),
        writes.remove("schools/" + otherUid + "/members/" + session.uid)
      ].concat(pairLeftovers(session.uid, otherUid)),
      session.idToken
    );
  }

  // What each side showed once a school exists (null when nothing was shown).
  async function exchanged(session, otherUid) {
    var rows = await Promise.all([
      glintFrom(session, otherUid),
      glintTo(session, otherUid),
      quietGet("seals/" + pairId(otherUid, session.uid), session.idToken),
      quietGet("seals/" + pairId(session.uid, otherUid), session.idToken)
    ]);
    return { theirGlint: rows[0], myGlint: rows[1], theirSeal: rows[2], mySeal: rows[3] };
  }

  async function deepReading(number, token) {
    return quietGet("deepReadings/" + number, token);
  }

  function requests(session, field) {
    return db().runQuery(
      {
        from: [{ collectionId: "schoolRequests" }],
        where: db().equals(field, session.uid),
        limit: 100
      },
      session.idToken
    );
  }

  function incoming(session) {
    return requests(session, "to");
  }

  function outgoing(session) {
    return requests(session, "from");
  }

  function members(session) {
    return listChildren("schools/" + session.uid, "members", session.idToken, 300);
  }

  function aliasOf(number, token) {
    return quietGet("aliasOf/" + number, token);
  }

  function resolveAlias(alias, token) {
    if (!ALIAS_PATTERN.test(alias)) return Promise.resolve(null);
    return quietGet("aliases/" + alias, token);
  }

  function aliasError(key) {
    var error = new Error(key);
    error.i18n = key;
    return error;
  }

  function cleanAlias(alias) {
    return String(alias || "").trim().replace(/^@/, "").toLowerCase();
  }

  // Another person's alias is unreadable, so "permission denied" means taken.
  async function aliasFree(alias, session) {
    alias = cleanAlias(alias);
    if (!ALIAS_PATTERN.test(alias)) throw aliasError("me.aliasInvalid");
    if (alias === "firstfish") return false;
    try {
      var found = await db().get("aliases/" + alias, session && session.idToken);
      return !found || (session && found.ownerUid === session.uid);
    } catch (error) {
      if (db().isPermission(error)) return false;
      throw error;
    }
  }

  async function setAlias(session, number, alias, current) {
    alias = cleanAlias(alias);
    if (!ALIAS_PATTERN.test(alias)) throw aliasError("me.aliasInvalid");
    if (alias === current) return alias;
    var token = session.idToken;
    var reserved = alias === "firstfish" && Number(number) === 1;
    if (!reserved && !(await aliasFree(alias, session))) throw aliasError("me.aliasTaken");
    var writes = db().writes;
    var list = [];
    if (current) list.push(writes.remove("aliases/" + current));
    list.push(
      writes.set("aliases/" + alias, { ownerUid: session.uid, number: Number(number) }),
      writes.set("aliasOf/" + number, { ownerUid: session.uid, alias: alias })
    );
    try {
      await db().commit(list, token);
    } catch (error) {
      if (db().isPermission(error)) throw aliasError("me.aliasTaken");
      throw error;
    }
    return alias;
  }

  async function inChunks(list, token) {
    for (var index = 0; index < list.length; index += 400) {
      await db().commit(list.slice(index, index + 400), token);
    }
  }

  async function cleanup(session, number) {
    var token = session.idToken;
    var writes = db().writes;
    var me = session.uid;
    var list = [];
    var alias = await aliasOf(number, token);
    if (alias) {
      list.push(writes.remove("aliases/" + alias.alias), writes.remove("aliasOf/" + number));
    }
    var others = {};
    (await tailersOf(session)).forEach(function (row) {
      others[row.from] = true;
    });
    (await trailOf(session)).forEach(function (row) {
      others[row.to] = true;
    });
    (await myGlints(session)).forEach(function (row) {
      others[row.to] = true;
    });
    var pending = (await incoming(session)).concat(await outgoing(session));
    pending.forEach(function (row) {
      others[row.from === me ? row.to : row.from] = true;
      list.push(writes.remove("schoolRequests/" + row.id));
    });
    (await members(session)).forEach(function (row) {
      var other = row.uid || row.id;
      others[other] = true;
      list.push(
        writes.remove("schools/" + me + "/members/" + other),
        writes.remove("schools/" + other + "/members/" + me)
      );
    });
    Object.keys(others).forEach(function (other) {
      list = list.concat(pairLeftovers(me, other));
    });
    await inChunks(list, token);
  }

  window.MindsetSocial = {
    ALIAS_PATTERN: ALIAS_PATTERN,
    CLOSED_FIELDS: CLOSED_FIELDS,
    GLINT_DAYS: GLINT_DAYS,
    tailing: tailing,
    tail: tail,
    untail: untail,
    dismissTail: dismissTail,
    tailersOf: tailersOf,
    trailOf: trailOf,
    trailNumbers: trailNumbers,
    glintLive: glintLive,
    shine: shine,
    withdrawGlint: withdrawGlint,
    glintFrom: glintFrom,
    glintTo: glintTo,
    myGlints: myGlints,
    relation: relation,
    requestSchool: requestSchool,
    accept: accept,
    decline: decline,
    cancel: cancel,
    leave: leave,
    exchanged: exchanged,
    deepReading: deepReading,
    incoming: incoming,
    outgoing: outgoing,
    members: members,
    aliasOf: aliasOf,
    resolveAlias: resolveAlias,
    cleanAlias: cleanAlias,
    aliasFree: aliasFree,
    setAlias: setAlias,
    cleanup: cleanup
  };
})();

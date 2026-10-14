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

  // Following works like a bookmark: owner-only, no approval, nobody is notified.
  async function isFollowing(session, number) {
    return Boolean(await quietGet("follows/" + session.uid + "/items/" + number, session.idToken));
  }

  function follow(session, number) {
    return db().commit(
      [db().writes.set("follows/" + session.uid + "/items/" + number, { number: Number(number), createdAt: now() })],
      session.idToken
    );
  }

  function unfollow(session, number) {
    return db().remove("follows/" + session.uid + "/items/" + number, session.idToken);
  }

  async function followingNumbers(session) {
    var rows = await listChildren("follows/" + session.uid, "items", session.idToken, 300);
    return rows.map(function (row) {
      return Number(row.number || row.id);
    });
  }

  function requestId(from, to) {
    return from + "_" + to;
  }

  async function relation(session, otherUid) {
    if (!session || session.uid === otherUid) return "self";
    var token = session.idToken;
    if (await quietGet("tribes/" + session.uid + "/members/" + otherUid, token)) return "member";
    var incoming = await quietGet("tribeRequests/" + requestId(otherUid, session.uid), token);
    if (incoming) return "incoming";
    if (await quietGet("tribeRequests/" + requestId(session.uid, otherUid), token)) return "outgoing";
    return "none";
  }

  function invite(session, myNumber, otherUid, otherNumber) {
    return db().create(
      "tribeRequests",
      requestId(session.uid, otherUid),
      {
        from: session.uid,
        to: otherUid,
        fromNumber: Number(myNumber),
        toNumber: Number(otherNumber),
        createdAt: now()
      },
      session.idToken
    );
  }

  async function accept(session, fromUid) {
    var token = session.idToken;
    var id = requestId(fromUid, session.uid);
    var request = await db().get("tribeRequests/" + id, token);
    if (!request) return;
    var since = now();
    var writes = db().writes;
    await db().commit(
      [
        writes.create("tribes/" + session.uid + "/members/" + fromUid, {
          uid: fromUid,
          number: request.fromNumber,
          since: since
        }),
        writes.create("tribes/" + fromUid + "/members/" + session.uid, {
          uid: session.uid,
          number: request.toNumber,
          since: since
        }),
        writes.remove("tribeRequests/" + id)
      ],
      token
    );
  }

  function decline(session, fromUid) {
    return db().remove("tribeRequests/" + requestId(fromUid, session.uid), session.idToken);
  }

  function cancel(session, toUid) {
    return db().remove("tribeRequests/" + requestId(session.uid, toUid), session.idToken);
  }

  function leave(session, otherUid) {
    var writes = db().writes;
    return db().commit(
      [
        writes.remove("tribes/" + session.uid + "/members/" + otherUid),
        writes.remove("tribes/" + otherUid + "/members/" + session.uid)
      ],
      session.idToken
    );
  }

  function requests(session, field) {
    return db().runQuery(
      {
        from: [{ collectionId: "tribeRequests" }],
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
    return listChildren("tribes/" + session.uid, "members", session.idToken, 300);
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

  async function setAlias(session, number, alias, visibility, current) {
    alias = String(alias || "").trim().toLowerCase();
    if (!ALIAS_PATTERN.test(alias)) throw aliasError("me.aliasInvalid");
    if (visibility !== "public") visibility = "tribe";
    var token = session.idToken;
    if (alias !== current) {
      try {
        var taken = await db().get("aliases/" + alias, token);
        if (taken && taken.ownerUid !== session.uid) throw aliasError("me.aliasTaken");
      } catch (error) {
        if (db().isPermission(error)) throw aliasError("me.aliasTaken");
        throw error;
      }
    }
    var writes = db().writes;
    var list = [];
    if (current && current !== alias) list.push(writes.remove("aliases/" + current));
    list.push(
      writes.set("aliases/" + alias, { ownerUid: session.uid, number: Number(number), visibility: visibility }),
      writes.set("aliasOf/" + number, { ownerUid: session.uid, alias: alias, visibility: visibility }),
      writes.patch("mindsets/" + number, { alias: visibility === "public" ? alias : "" })
    );
    try {
      await db().commit(list, token);
    } catch (error) {
      if (db().isPermission(error)) throw aliasError("me.aliasTaken");
      throw error;
    }
    return alias;
  }

  async function removeAlias(session, number, current) {
    var writes = db().writes;
    var list = [];
    if (current) list.push(writes.remove("aliases/" + current));
    list.push(
      writes.remove("aliasOf/" + number),
      writes.patch("mindsets/" + number, { alias: "" })
    );
    await db().commit(list, session.idToken);
  }

  async function inChunks(list, token) {
    for (var index = 0; index < list.length; index += 400) {
      await db().commit(list.slice(index, index + 400), token);
    }
  }

  async function cleanup(session, number) {
    var token = session.idToken;
    var writes = db().writes;
    var list = [];
    var alias = await aliasOf(number, token);
    if (alias) {
      list.push(writes.remove("aliases/" + alias.alias), writes.remove("aliasOf/" + number));
    }
    var followed = await listChildren("follows/" + session.uid, "items", token, 500);
    followed.forEach(function (row) {
      list.push(writes.remove("follows/" + session.uid + "/items/" + row.id));
    });
    var pending = (await incoming(session)).concat(await outgoing(session));
    pending.forEach(function (row) {
      list.push(writes.remove("tribeRequests/" + row.id));
    });
    var tribe = await members(session);
    tribe.forEach(function (row) {
      list.push(
        writes.remove("tribes/" + session.uid + "/members/" + row.id),
        writes.remove("tribes/" + row.id + "/members/" + session.uid)
      );
    });
    await inChunks(list, token);
  }

  window.MindsetSocial = {
    ALIAS_PATTERN: ALIAS_PATTERN,
    isFollowing: isFollowing,
    follow: follow,
    unfollow: unfollow,
    followingNumbers: followingNumbers,
    relation: relation,
    invite: invite,
    accept: accept,
    decline: decline,
    cancel: cancel,
    leave: leave,
    incoming: incoming,
    outgoing: outgoing,
    members: members,
    aliasOf: aliasOf,
    resolveAlias: resolveAlias,
    setAlias: setAlias,
    removeAlias: removeAlias,
    cleanup: cleanup
  };
})();

(function () {
  "use strict";

  const REVISION = 6;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function unique(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean)));
  }

  function addId(target, value) {
    const id = text(value);
    if (id) target.add(id);
  }

  function addIds(target, values) {
    (Array.isArray(values) ? values : []).forEach(function (value) {
      addId(target, value);
    });
  }

  function intersects(left, right) {
    for (const value of left) {
      if (right.has(value)) return value;
    }
    return "";
  }

  function isCancelledPlayer(player) {
    return [
      "已取消",
      "取消",
      "cancelled",
      "canceled"
    ].includes(text(player && player.status).toLowerCase());
  }

  function getPlayerIdentityIds(player) {
    const source = player && typeof player === "object" ? player : {};
    const ids = new Set();

    [
      source.playerId,
      source.id,
      source.profileId,
      source.personId,
      source.identityId,
      source.memberId,
      source.canonicalPersonId,
      source.canonicalProfileId,
      source.canonicalMemberId,
      source.mergedIntoPersonId,
      source.mergedIntoProfileId,
      source.mergedIntoMemberId,
      source.applicationId
    ].forEach(function (value) {
      addId(ids, value);
    });

    addIds(ids, source.linkedPlayerIds);
    return ids;
  }

  function getOwnerIdentityIds(car) {
    const source = car && typeof car === "object" ? car : {};
    const ids = new Set();

    [
      source.ownerId,
      source.ownerPersonId,
      source.ownerProfileId,
      source.hostId,
      source.hostPersonId,
      source.hostProfileId,
      source.createdByPersonId
    ].forEach(function (value) {
      addId(ids, value);
    });

    return ids;
  }

  async function getIdentityContext() {
    const identity = window.JLYIdentity;
    if (!identity) throw new Error("JLY Identity 尚未載入");

    const profileId = typeof identity.getCurrentPlayerProfileId === "function"
      ? text(identity.getCurrentPlayerProfileId())
      : text(localStorage.getItem("currentPlayerProfileId"));

    if (profileId && window.db && typeof identity.syncFromPlayerProfile === "function") {
      await identity.syncFromPlayerProfile(window.db, profileId);
    }

    const viewerId = typeof identity.getCurrentPlayerId === "function"
      ? text(identity.getCurrentPlayerId())
      : text(localStorage.getItem("currentPlayerId"));

    const identityIds = typeof identity.getAllPlayerIdentityIds === "function"
      ? unique(identity.getAllPlayerIdentityIds())
      : unique([viewerId, profileId]);

    if (!viewerId) throw new Error("尚未取得 JLY 使用者身分");

    return {
      viewerId,
      profileId,
      identityIds: unique([viewerId, profileId, ...identityIds])
    };
  }

  function normalizePlayerMembershipForView(player, identitySet) {
    if (!player || isCancelledPlayer(player)) return player;

    const matchedId = intersects(getPlayerIdentityIds(player), identitySet);
    if (!matchedId) return player;

    const source = { ...player };

    // Prepared View V4 目前以 playerId / id / profileId 判定玩家。
    // 舊 Membership 可能只有 personId / identityId / canonical*。
    // 這裡只在 repair 的記憶體副本補上 playerId，不修改 Core car。
    if (!text(source.playerId) && !text(source.id) && !text(source.profileId)) {
      source.playerId = matchedId;
    }

    return source;
  }

  function normalizeCarForView(car, identitySet) {
    const source = car && typeof car === "object" ? car : {};
    const players = Array.isArray(source.players)
      ? source.players.map(function (player) {
          return normalizePlayerMembershipForView(player, identitySet);
        })
      : [];

    return {
      ...source,
      players
    };
  }

  function carMatchesViewerAsPlayer(car, identitySet) {
    const players = Array.isArray(car && car.players) ? car.players : [];

    return players.some(function (player) {
      return (
        player &&
        !isCancelledPlayer(player) &&
        Boolean(intersects(getPlayerIdentityIds(player), identitySet))
      );
    });
  }

  async function recoverCoreCars(context) {
    const identitySet = new Set(context.identityIds);
    const carMap = new Map();

    // 保留既有已驗證查詢路徑。
    for (const id of context.identityIds) {
      const hostCars = await window.JLYCarData.getCarsByOwner(id);
      hostCars.forEach(function (car) {
        carMap.set(car.id, normalizeCarForView(car, identitySet));
      });
    }

    const indexedPlayerCars = await window.JLYCarData.getCarsByPlayerId(
      context.profileId || context.viewerId
    );

    indexedPlayerCars.forEach(function (car) {
      carMap.set(car.id, normalizeCarForView(car, identitySet));
    });

    // 歷史相容 fallback：最近大改後 Prepared View 只讀，
    // playerIds index 或舊 Membership 欄位若沒有覆蓋完整身分，
    // 「我是玩家」會整批消失。Repair 時掃 Core cars 一次，
    // 只把正式 Membership 確認屬於目前使用者的車補回 View。
    const snapshot = await window.db.collection("cars").get();

    snapshot.docs.forEach(function (doc) {
      const car = { id: doc.id, ...(doc.data() || {}) };

      const isHost = Boolean(intersects(getOwnerIdentityIds(car), identitySet));
      const isPlayer = carMatchesViewerAsPlayer(car, identitySet);

      if (!isHost && !isPlayer) return;

      carMap.set(car.id, normalizeCarForView(car, identitySet));
    });

    return Array.from(carMap.values());
  }

  async function rebuild() {
    if (!window.JLYCarData) throw new Error("Car Data 尚未載入");
    if (typeof window.ensureMyCarViewModule !== "function") {
      throw new Error("MyCar View Runtime 尚未載入");
    }

    const context = await getIdentityContext();
    const viewModule = await window.ensureMyCarViewModule();
    const cars = await recoverCoreCars(context);

    const view = viewModule.buildView({
      viewerId: context.viewerId,
      identityIds: context.identityIds,
      cars
    });

    view.identityResolutionRevision = REVISION;
    view.identityResolvedAt = new Date().toISOString();
    view.identityRepairSource = "core-membership-recovery";

    await viewModule.write(view);
    return view;
  }

  async function run() {
    try {
      const view = await rebuild();
      console.log("✅ MyCar 歷史 Membership Recovery 完成", {
        host: view.counts && view.counts.host || 0,
        player: view.counts && view.counts.player || 0,
        all: view.counts && view.counts.all || 0
      });

      if (typeof window.resetMyCarPagination === "function") {
        window.resetMyCarPagination();
      }
      if (typeof window.renderMyCars === "function") {
        await window.renderMyCars({ restoreScroll: false });
      }
    } catch (error) {
      console.error("MyCar 歷史 Membership Recovery 失敗：", error);
    }
  }

  window.JLYMyCarLegacyIdentityRepair = {
    REVISION,
    getIdentityContext,
    getPlayerIdentityIds,
    carMatchesViewerAsPlayer,
    recoverCoreCars,
    rebuild,
    run
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(run, 0); });
  } else {
    setTimeout(run, 0);
  }
})();

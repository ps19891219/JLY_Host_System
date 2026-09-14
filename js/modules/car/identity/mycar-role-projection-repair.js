(function () {
  "use strict";

  const REVISION = 1;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function addId(target, value) {
    const id = text(value);
    if (id) target.add(id);
  }

  function addArray(target, values) {
    (Array.isArray(values) ? values : []).forEach(function (value) {
      addId(target, value);
    });
  }

  function getViewerIdentityIds() {
    const ids = new Set();
    const identity = window.JLYIdentity;

    if (identity) {
      if (typeof identity.getCurrentPlayerId === "function") {
        addId(ids, identity.getCurrentPlayerId());
      }
      if (typeof identity.getCurrentPlayerProfileId === "function") {
        addId(ids, identity.getCurrentPlayerProfileId());
      }
      if (typeof identity.getAllPlayerIdentityIds === "function") {
        addArray(ids, identity.getAllPlayerIdentityIds());
      }
      if (typeof identity.getLinkedPlayerIds === "function") {
        addArray(ids, identity.getLinkedPlayerIds());
      }
    }

    try {
      addId(ids, localStorage.getItem("currentPlayerId"));
      addId(ids, localStorage.getItem("currentPlayerProfileId"));
    } catch (_error) {}

    return ids;
  }

  function getCarOwnerIds(car) {
    const ids = new Set();
    const source = car && typeof car === "object" ? car : {};

    [
      source.ownerId,
      source.ownerPersonId,
      source.hostPersonId,
      source.createdByPersonId,
      source.hostProfileId,
      source.ownerProfileId,
      source.hostId
    ].forEach(function (value) {
      addId(ids, value);
    });

    return ids;
  }

  function getPlayerIds(player) {
    const ids = new Set();
    const source = player && typeof player === "object" ? player : {};

    [
      source.id,
      source.playerId,
      source.personId,
      source.profileId,
      source.identityId,
      source.canonicalPersonId,
      source.canonicalProfileId,
      source.canonicalMemberId,
      source.mergedIntoPersonId,
      source.mergedIntoProfileId,
      source.mergedIntoMemberId
    ].forEach(function (value) {
      addId(ids, value);
    });

    addArray(ids, source.linkedPlayerIds);
    return ids;
  }

  function intersects(left, right) {
    for (const value of left) {
      if (right.has(value)) return true;
    }
    return false;
  }

  function isCancelled(player) {
    return [
      "已取消",
      "取消",
      "cancelled",
      "canceled"
    ].includes(text(player && player.status).toLowerCase());
  }

  function resolveRole(car, viewerIds) {
    const host = intersects(getCarOwnerIds(car), viewerIds);

    if (host) {
      return { isHost: true, isPlayer: false, role: "host", ownerType: "self" };
    }

    const players = Array.isArray(car && car.players) ? car.players : [];
    const player = players.some(function (member) {
      return member && !isCancelled(member) && intersects(getPlayerIds(member), viewerIds);
    });

    return {
      isHost: false,
      isPlayer: player,
      role: player ? "player" : "",
      ownerType: ""
    };
  }

  async function fetchCoreCars(carIds) {
    const map = new Map();
    for (const carId of carIds) {
      const snapshot = await window.db.collection("cars").doc(carId).get();
      if (snapshot.exists) {
        map.set(snapshot.id, { id: snapshot.id, ...(snapshot.data() || {}) });
      }
    }
    return map;
  }

  async function run() {
    try {
      if (!window.db || typeof window.ensureMyCarViewModule !== "function") return;

      const viewerIds = getViewerIdentityIds();
      if (!viewerIds.size) return;

      const identity = window.JLYIdentity;
      const viewerId = identity && typeof identity.getCurrentPlayerId === "function"
        ? text(identity.getCurrentPlayerId())
        : text(localStorage.getItem("currentPlayerId"));

      if (!viewerId) return;

      const module = await window.ensureMyCarViewModule();
      const view = await module.read(viewerId);
      if (!view || !Array.isArray(view.cars)) return;

      const carIds = view.cars
        .map(function (car) { return text(car && (car.id || car.carId)); })
        .filter(Boolean);

      const coreCars = await fetchCoreCars(carIds);
      let changed = false;

      const cars = view.cars.map(function (prepared) {
        const carId = text(prepared && (prepared.id || prepared.carId));
        const core = coreCars.get(carId);
        if (!core) return prepared;

        const role = resolveRole(core, viewerIds);
        if (
          prepared.isHost !== role.isHost ||
          prepared.isPlayer !== role.isPlayer ||
          text(prepared.role) !== role.role ||
          text(prepared.ownerType) !== role.ownerType
        ) {
          changed = true;
        }

        return {
          ...prepared,
          isHost: role.isHost,
          isPlayer: role.isPlayer,
          role: role.role,
          ownerType: role.ownerType
        };
      });

      const nextView = {
        ...view,
        cars,
        counts: {
          all: cars.length,
          host: cars.filter(function (car) { return car && car.isHost === true; }).length,
          player: cars.filter(function (car) { return car && car.isPlayer === true; }).length
        },
        roleProjectionRevision: REVISION,
        roleProjectionRepairedAt: new Date().toISOString()
      };

      if (changed || Number(view.roleProjectionRevision || 0) < REVISION) {
        await module.write(nextView);
      }

      if (typeof window.resetMyCarPagination === "function") {
        window.resetMyCarPagination();
      }
      if (typeof window.renderMyCars === "function") {
        await window.renderMyCars({ restoreScroll: false });
      }

      console.log("✅ MyCar 主揪/玩家角色投影已修復", nextView.counts);
    } catch (error) {
      console.error("MyCar role projection repair 失敗：", error);
    }
  }

  window.JLYMyCarRoleProjectionRepair = {
    REVISION,
    getViewerIdentityIds,
    getCarOwnerIds,
    getPlayerIds,
    resolveRole,
    run
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(run, 50);
    });
  } else {
    setTimeout(run, 50);
  }
})();

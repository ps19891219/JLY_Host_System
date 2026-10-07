"use strict";

const { getFirestore } = require("./admin");

const CANCELLED = new Set(["已取消", "取消", "cancelled", "canceled"]);

function text(value) {
  return String(value == null ? "" : value).trim();
}

function unique(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map(text)
      .filter(Boolean)
  ));
}

function normalizeSeatType(value) {
  const normalized = text(value).toLowerCase();
  if (["male", "m", "男", "男位", "boy"].includes(normalized)) return "male";
  if (["female", "f", "女", "女位", "girl"].includes(normalized)) return "female";
  return "flexible";
}

function buildSeatSummary(car) {
  const source = car && typeof car === "object" ? car : {};
  const slots = Array.isArray(source.slots) ? source.slots : [];
  if (!slots.length) {
    return source.seatSummary && typeof source.seatSummary === "object"
      ? { ...source.seatSummary }
      : null;
  }

  const activePlayerIds = new Set(
    (Array.isArray(source.players) ? source.players : [])
      .filter(player => !CANCELLED.has(text(player && player.status)))
      .map(player => text(player && (
        player.playerId ||
        player.id ||
        player.profileId ||
        player.applicationId
      )))
      .filter(Boolean)
  );

  const summary = {
    totalSeatCount: 0,
    occupiedSeatCount: 0,
    maleTotal: 0,
    maleOccupied: 0,
    femaleTotal: 0,
    femaleOccupied: 0,
    flexibleTotal: 0,
    flexibleOccupied: 0,
    waitingCount: 0
  };

  slots.forEach(slot => {
    const safe = slot && typeof slot === "object" ? slot : {};
    const type = normalizeSeatType(
      safe.originalType ||
      safe.sectionType ||
      safe.slotType ||
      safe.type
    );
    summary.totalSeatCount += 1;
    if (type === "male") summary.maleTotal += 1;
    else if (type === "female") summary.femaleTotal += 1;
    else summary.flexibleTotal += 1;

    const playerId = text(safe.playerId);
    const occupied = Boolean(playerId) &&
      (activePlayerIds.size === 0 || activePlayerIds.has(playerId));
    if (!occupied) return;

    summary.occupiedSeatCount += 1;
    if (type === "male") summary.maleOccupied += 1;
    else if (type === "female") summary.femaleOccupied += 1;
    else summary.flexibleOccupied += 1;
  });

  summary.waitingCount = Math.max(
    activePlayerIds.size - summary.occupiedSeatCount,
    0
  );
  return summary;
}

function buildCarDetailView(car) {
  const source = car && typeof car === "object" ? car : {};
  const carId = text(source.id || source.carId);
  if (!carId) throw new Error("car_id_required");
  return {
    schemaVersion: 1,
    viewType: "car_detail",
    carId,
    ownerId: text(source.ownerId),
    sourceUpdatedAt: source.updatedAt || null,
    builtAt: new Date().toISOString(),
    car: {
      ...source,
      id: carId,
      seatSummary: buildSeatSummary(source)
    }
  };
}

function compactPlayer(player) {
  const source = player && typeof player === "object" ? player : {};
  return {
    playerId: text(source.playerId || source.id || source.profileId),
    position: text(source.position || source.roleChoice || source.role),
    status: text(source.status)
  };
}

function resolveViewerRole(source, identitySet, players) {
  const ownerId = text(source.ownerId);
  const ownerMatches = Boolean(ownerId) && identitySet.has(ownerId);
  const myRole = text(source.myRole).toLowerCase();
  const explicitRole = ["host", "player", "favorite"].includes(myRole)
    ? myRole
    : "";
  const membershipPlayer = players.some(player =>
    player &&
    identitySet.has(text(player.playerId)) &&
    !CANCELLED.has(text(player.status))
  );

  let isHost = false;
  let isPlayer = membershipPlayer;

  if (ownerMatches) {
    if (explicitRole === "host") {
      isHost = true;
      isPlayer = false;
    } else if (explicitRole === "player") {
      isPlayer = true;
    } else if (explicitRole === "favorite") {
      isPlayer = false;
    } else if (source.isPlayer === true && source.isHost !== true) {
      isPlayer = true;
    } else if (source.isHost === true) {
      isHost = true;
      isPlayer = false;
    } else {
      isHost = true;
      isPlayer = false;
    }
  }

  return { ownerId, isHost, isPlayer };
}

function compactCar(car, viewerIdentityIds) {
  const source = car && typeof car === "object" ? car : {};
  const identitySet = new Set(
    unique(viewerIdentityIds)
  );
  const players = (Array.isArray(source.players) ? source.players : [])
    .map(compactPlayer);
  const role = resolveViewerRole(source, identitySet, players);

  return {
    id: text(source.id || source.carId),
    scriptName: text(source.scriptName || source.title || source.name),
    gameDate: text(source.gameDate || source.date),
    gameTime: text(source.gameTime || source.time),
    status: text(source.status),
    planningStatus: text(source.planningStatus),
    visibility: text(source.visibility),
    studioName: text(source.studioName || source.studio),
    organizerName: text(source.organizerName || source.groupName),
    locationName: text(source.locationName),
    location: text(source.location || source.address || source.placeName),
    dmName: text(source.dmName),
    coverImageUrl: text(source.coverImageUrl),
    scriptCoverUrl: text(source.scriptCoverUrl),
    scriptImageUrl: text(source.scriptImageUrl),
    price: Number(source.price || source.amount || 0),
    totalPeople: Number(source.totalPeople || 0),
    maleSlots: Number(source.maleSlots || 0),
    femaleSlots: Number(source.femaleSlots || 0),
    flexibleSlots: Number(source.flexibleSlots || source.flexSlots || 0),
    seatSummary: buildSeatSummary(source),
    players,
    tags: Array.isArray(source.tags) ? source.tags : [],
    scriptTags: Array.isArray(source.scriptTags) ? source.scriptTags : [],
    ownerId: role.ownerId,
    myRole: text(source.myRole).toLowerCase(),
    isHost: role.isHost,
    isPlayer: role.isPlayer,
    role: role.isHost ? "host" : (role.isPlayer ? "player" : ""),
    ownerType: role.isHost ? "self" : "",
    updatedAt: source.updatedAt || null,
    createdAt: source.createdAt || null
  };
}

function dateTimeValue(car) {
  const date = text(car && car.gameDate) || "9999-12-31";
  const time = text(car && car.gameTime) || "23:59";
  const value = new Date(date + "T" + time).getTime();
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function isEnded(car) {
  const status = text(car && car.status);
  if (status === "已結束" || status === "已取消") return true;
  if (!text(car && car.gameDate)) return false;
  return dateTimeValue(car) < Date.now();
}

function isPlanning(car) {
  const status = text(car && car.status);
  return status === "規劃中" ||
    text(car && car.planningStatus) === "unscheduled" ||
    !text(car && car.gameDate);
}

function sortCars(cars) {
  return [...(Array.isArray(cars) ? cars : [])].sort((a, b) => {
    const group = car => isEnded(car) ? 2 : (isPlanning(car) ? 1 : 0);
    const ag = group(a);
    const bg = group(b);
    if (ag !== bg) return ag - bg;
    if (ag === 1) {
      return new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime();
    }
    return dateTimeValue(a) - dateTimeValue(b);
  });
}

function applyToMyCarView(view, beforeCar, afterCar) {
  if (!view || typeof view !== "object") return null;
  const viewerId = text(view.viewerId);
  const identityIds = unique([
    viewerId,
    ...(Array.isArray(view.identityIds) ? view.identityIds : [])
  ]);
  const carId = text(
    (afterCar && (afterCar.id || afterCar.carId)) ||
    (beforeCar && (beforeCar.id || beforeCar.carId))
  );
  if (!carId) return view;

  const cars = (Array.isArray(view.cars) ? view.cars : [])
    .filter(car => text(car && car.id) !== carId);

  if (afterCar) {
    const compact = compactCar(afterCar, identityIds);
    if (compact.id && (compact.isHost || compact.isPlayer)) {
      cars.push(compact);
    }
  }

  const nextCars = sortCars(cars);
  return {
    ...view,
    schemaVersion: 6,
    viewType: "mycar_index",
    cars: nextCars,
    counts: {
      all: nextCars.length,
      host: nextCars.filter(car => car.isHost).length,
      player: nextCars.filter(car => car.isPlayer).length
    },
    builtAt: new Date().toISOString()
  };
}

function activePlayerIds(car) {
  return unique(
    (Array.isArray(car && car.players) ? car.players : [])
      .filter(player => !CANCELLED.has(text(player && player.status)))
      .map(player => player && (
        player.playerId ||
        player.id ||
        player.profileId
      ))
  );
}

async function applyCarMutation(carId, mutator, options = {}) {
  const id = text(carId);
  if (!id) throw new Error("car_id_required");
  if (typeof mutator !== "function") throw new Error("car_mutator_required");

  const db = options.db || getFirestore();
  const result = await db.runTransaction(async transaction => {
    const carRef = db.collection("cars").doc(id);
    const carSnapshot = await transaction.get(carRef);
    if (!carSnapshot.exists) {
      return { changed: false, reason: "car_not_found", beforeCar: null, afterCar: null };
    }

    const beforeCar = { id: carSnapshot.id, ...(carSnapshot.data() || {}) };
    const mutation = await mutator(beforeCar);
    if (!mutation || mutation.changed !== true) {
      return {
        ...(mutation || {}),
        changed: false,
        beforeCar,
        afterCar: beforeCar
      };
    }

    const updateData = mutation.updateData && typeof mutation.updateData === "object"
      ? mutation.updateData
      : {};
    const afterCar = {
      ...beforeCar,
      ...updateData,
      id
    };

    const changedFields = unique(mutation.changedFields || Object.keys(updateData));
    const needsMyCar = changedFields.some(field => [
      "players", "playerIds", "slots", "ownerId", "updatedAt"
    ].includes(field));

    const viewDocs = new Map();

    if (needsMyCar) {
      const ownerIds = unique([
        beforeCar.ownerId,
        afterCar.ownerId
      ]);
      const playerIds = unique([
        ...activePlayerIds(beforeCar),
        ...activePlayerIds(afterCar)
      ]);
      const aliasIds = unique([...ownerIds, ...playerIds]);

      const aliasRefs = aliasIds.map(aliasId =>
        db.collection("myCarViewAliases").doc(aliasId)
      );
      const directOwnerRefs = ownerIds.map(ownerId =>
        db.collection("myCarViews").doc(ownerId)
      );

      const aliasSnapshots = aliasRefs.length
        ? await transaction.getAll(...aliasRefs)
        : [];
      const directOwnerSnapshots = directOwnerRefs.length
        ? await transaction.getAll(...directOwnerRefs)
        : [];

      const viewerIds = new Set();
      directOwnerSnapshots.forEach(snapshot => {
        if (snapshot.exists) viewerIds.add(snapshot.id);
      });
      aliasSnapshots.forEach(snapshot => {
        if (!snapshot.exists) return;
        const viewerId = text((snapshot.data() || {}).viewerId);
        if (viewerId) viewerIds.add(viewerId);
      });

      const viewerRefs = Array.from(viewerIds).map(viewerId =>
        db.collection("myCarViews").doc(viewerId)
      );
      const viewerSnapshots = viewerRefs.length
        ? await transaction.getAll(...viewerRefs)
        : [];

      viewerSnapshots.forEach(snapshot => {
        if (snapshot.exists) {
          viewDocs.set(snapshot.id, {
            ref: snapshot.ref,
            data: snapshot.data() || {}
          });
        }
      });
    }

    transaction.update(carRef, updateData);
    transaction.set(
      db.collection("carDetailViews").doc(id),
      buildCarDetailView(afterCar),
      { merge: false }
    );

    for (const entry of viewDocs.values()) {
      const next = applyToMyCarView(entry.data, beforeCar, afterCar);
      if (next) transaction.set(entry.ref, next, { merge: false });
    }

    return {
      ...mutation,
      changed: true,
      beforeCar,
      afterCar,
      updatedMyCarViews: viewDocs.size
    };
  });

  return result;
}

module.exports = {
  buildSeatSummary,
  buildCarDetailView,
  compactCar,
  applyToMyCarView,
  activePlayerIds,
  applyCarMutation
};

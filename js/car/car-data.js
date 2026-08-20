console.log(
  "car-data.js 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // Firebase
  // ============================================================

  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase 尚未初始化"
      );
    }

    return window.db;
  }

  function normalizeId(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  // ============================================================
  // 單台 Car
  // ============================================================

  async function getCarById(
    carId
  ) {
    const normalizedCarId =
      normalizeId(carId);

    if (!normalizedCarId) {
      throw new Error(
        "缺少車團 ID"
      );
    }

    const db =
      getDb();

    const snapshot =
      await db
        .collection("cars")
        .doc(normalizedCarId)
        .get();

    if (!snapshot.exists) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  }

  // ============================================================
  // 我的車
  //
  // Ownership V1：
  // 只取得 ownerId = 指定使用者的車。
  // ============================================================

  async function getCarsByOwner(
    ownerId
  ) {
    const normalizedOwnerId =
      normalizeId(ownerId);

    if (!normalizedOwnerId) {
      throw new Error(
        "缺少 ownerId"
      );
    }

    const db =
      getDb();

    const snapshot =
      await db
        .collection("cars")
        .where(
          "ownerId",
          "==",
          normalizedOwnerId
        )
        .get();

    return snapshot.docs.map(
      function (doc) {
        return {
          id: doc.id,
          ...doc.data()
        };
      }
    );
  }


  // ============================================================
  // 我的車分頁 V1
  //
  // - Firestore 真分頁：ownerId + documentId cursor
  // - 每頁最多回傳指定筆數
  // - 可傳入 filter 函式，會逐批掃描直到湊滿一頁或資料結束
  // - 不建立第二份 Car 正式資料
  // ============================================================

  async function getCarsByOwnerPage(
    ownerId,
    options
  ) {
    const normalizedOwnerId =
      normalizeId(ownerId);

    if (!normalizedOwnerId) {
      throw new Error(
        "缺少 ownerId"
      );
    }

    const settings =
      options || {};

    const pageSize =
      Math.max(
        1,
        Math.min(
          50,
          Number(
            settings.limit || 20
          )
        )
      );

    const filter =
      typeof settings.filter ===
        "function"
        ? settings.filter
        : null;

    let cursorId =
      normalizeId(
        settings.cursorId
      );

    const db =
      getDb();

    const batchSize =
      Math.max(
        pageSize + 1,
        24
      );

    const cars = [];
    let hasMore = false;
    let nextCursorId =
      cursorId || "";

    while (
      cars.length < pageSize
    ) {
      let query =
        db
          .collection("cars")
          .where(
            "ownerId",
            "==",
            normalizedOwnerId
          )
          .orderBy(
            firebase
              .firestore
              .FieldPath
              .documentId()
          )
          .limit(
            batchSize
          );

      if (cursorId) {
        query =
          query.startAfter(
            cursorId
          );
      }

      const snapshot =
        await query.get();

      if (
        snapshot.empty
      ) {
        hasMore = false;
        break;
      }

      const docs =
        snapshot.docs;

      let consumed = 0;

      for (
        const doc
        of docs
      ) {
        consumed += 1;

        const car = {
          id: doc.id,
          ...doc.data()
        };

        cursorId =
          doc.id;

        nextCursorId =
          doc.id;

        if (
          !filter ||
          filter(car)
        ) {
          cars.push(car);
        }

        if (
          cars.length >=
            pageSize
        ) {
          hasMore =
            consumed <
              docs.length ||
            docs.length ===
              batchSize;

          break;
        }
      }

      if (
        cars.length >=
          pageSize
      ) {
        break;
      }

      if (
        docs.length <
          batchSize
      ) {
        hasMore = false;
        break;
      }

      hasMore = true;
    }

    return {
      cars,
      nextCursorId,
      hasMore
    };
  }

  // ============================================================
// 依多個 Car ID 取得車團
// ============================================================

async function getCarsByIds(
  carIds
) {
  const ids = Array.from(
    new Set(
      (Array.isArray(carIds)
        ? carIds
        : []
      )
        .map(function (id) {
          return String(
            id || ""
          ).trim();
        })
        .filter(Boolean)
    )
  );

  if (ids.length === 0) {
    return [];
  }

  const cars =
    await Promise.all(
      ids.map(
        async function (carId) {
          try {
            return await getCarById(
              carId
            );
          } catch (error) {
            console.warn(
              "讀取車團失敗：",
              carId,
              error
            );

            return null;
          }
        }
      )
    );

  return cars.filter(Boolean);
}

// ============================================================
// Player Query Index V1
//
// players[] 仍是正式參與資料。
// playerIds 僅是 Firestore Query Index，不建立第二份玩家資料。
//
// 舊車第一次升級時會做一次 backfill：
// - 掃描既有 cars
// - 從 players[] 重建 playerIds
// - 完成後在本機留下 migration flag
//
// 若 migration / indexed query 失敗，會安全回退舊版掃描，
// 不會因此讓歷史「我是玩家」車團消失。
// ============================================================

const PLAYER_IDS_INDEX_VERSION =
  1;

const PLAYER_IDS_MIGRATION_KEY =
  "jly_car_player_ids_index_v1_done";

function isCancelledPlayerStatus(
  value
) {
  const status =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  return (
    status === "已取消" ||
    status === "取消" ||
    status === "cancelled" ||
    status === "canceled"
  );
}

function getPlayerStableId(
  player
) {
  const source =
    player &&
    typeof player === "object"
      ? player
      : {};

  return normalizeId(
    source.playerId ||
    source.id ||
    source.profileId
  );
}

function buildActivePlayerIds(
  players
) {
  const source =
    Array.isArray(players)
      ? players
      : [];

  return Array.from(
    new Set(
      source
        .filter(function (player) {
          return (
            player &&
            !isCancelledPlayerStatus(
              player.status
            )
          );
        })
        .map(
          getPlayerStableId
        )
        .filter(Boolean)
    )
  );
}

function sameIdArray(
  left,
  right
) {
  const a =
    Array.isArray(left)
      ? [...left]
          .map(normalizeId)
          .filter(Boolean)
          .sort()
      : [];

  const b =
    Array.isArray(right)
      ? [...right]
          .map(normalizeId)
          .filter(Boolean)
          .sort()
      : [];

  return (
    a.length === b.length &&
    a.every(
      function (value, index) {
        return value === b[index];
      }
    )
  );
}

function getLocalStorageSafe() {
  try {
    return window.localStorage ||
      null;
  } catch (_error) {
    return null;
  }
}

function isPlayerIdsMigrationDone() {
  const storage =
    getLocalStorageSafe();

  if (!storage) {
    return false;
  }

  return (
    storage.getItem(
      PLAYER_IDS_MIGRATION_KEY
    ) === "1"
  );
}

function markPlayerIdsMigrationDone() {
  const storage =
    getLocalStorageSafe();

  if (!storage) {
    return;
  }

  storage.setItem(
    PLAYER_IDS_MIGRATION_KEY,
    "1"
  );
}

async function backfillPlayerIdsIndex() {
  const db =
    getDb();

  const snapshot =
    await db
      .collection("cars")
      .get();

  if (snapshot.empty) {
    markPlayerIdsMigrationDone();

    return {
      scanned: 0,
      updated: 0
    };
  }

  let batch =
    db.batch();

  let batchCount =
    0;

  let scanned =
    0;

  let updated =
    0;

  async function commitBatch() {
    if (batchCount === 0) {
      return;
    }

    await batch.commit();

    batch =
      db.batch();

    batchCount =
      0;
  }

  for (
    const doc
    of snapshot.docs
  ) {
    scanned += 1;

    const car =
      doc.data() ||
      {};

    const nextPlayerIds =
      buildActivePlayerIds(
        car.players
      );

    const version =
      Number(
        car.playerIdsIndexVersion ||
        0
      );

    if (
      version ===
        PLAYER_IDS_INDEX_VERSION &&
      sameIdArray(
        car.playerIds,
        nextPlayerIds
      )
    ) {
      continue;
    }

    batch.update(
      doc.ref,
      {
        playerIds:
          nextPlayerIds,

        playerIdsIndexVersion:
          PLAYER_IDS_INDEX_VERSION
      }
    );

    updated += 1;
    batchCount += 1;

    if (
      batchCount >= 400
    ) {
      await commitBatch();
    }
  }

  await commitBatch();

  markPlayerIdsMigrationDone();

  console.log(
    "✅ Player IDs Index backfill 完成",
    {
      scanned,
      updated
    }
  );

  return {
    scanned,
    updated
  };
}

async function ensurePlayerIdsIndex() {
  if (
    isPlayerIdsMigrationDone()
  ) {
    return true;
  }

  try {
    await backfillPlayerIdsIndex();

    return true;
  } catch (error) {
    console.warn(
      "Player IDs Index backfill 失敗，暫時使用舊版相容查詢：",
      error
    );

    return false;
  }
}

async function resolveTargetPlayerIds(
  playerId
) {
  const db =
    getDb();

  const identityIds =
    window.JLYIdentity &&
    typeof window
      .JLYIdentity
      .getAllPlayerIdentityIds ===
        "function"
      ? window.JLYIdentity
          .getAllPlayerIdentityIds()
      : [];

  const inputPlayerId =
    normalizeId(playerId);

  const initialPlayerIds =
    Array.from(
      new Set([
        inputPlayerId,
        ...identityIds
      ])
    )
      .map(normalizeId)
      .filter(Boolean);

  if (
    initialPlayerIds.length === 0
  ) {
    throw new Error(
      "缺少 playerId"
    );
  }

  const firebaseLinkedPlayerIds =
    [];

  for (
    const identityId
    of initialPlayerIds
  ) {
    try {
      const profileSnapshot =
        await db
          .collection("players")
          .doc(identityId)
          .get();

      if (
        !profileSnapshot.exists
      ) {
        continue;
      }

      const profileData =
        profileSnapshot.data() ||
        {};

      const linkedIds =
        Array.isArray(
          profileData
            .linkedPlayerIds
        )
          ? profileData
              .linkedPlayerIds
              .map(normalizeId)
              .filter(Boolean)
          : [];

      firebaseLinkedPlayerIds.push(
        ...linkedIds
      );
    } catch (error) {
      console.warn(
        "讀取 Firebase linkedPlayerIds 失敗：",
        identityId,
        error
      );
    }
  }

  return Array.from(
    new Set([
      ...initialPlayerIds,
      ...firebaseLinkedPlayerIds
    ])
  )
    .map(normalizeId)
    .filter(Boolean);
}

function carMatchesPlayerIds(
  car,
  targetPlayerIds
) {
  const targetSet =
    new Set(
      targetPlayerIds
        .map(normalizeId)
        .filter(Boolean)
    );

  const players =
    Array.isArray(
      car && car.players
    )
      ? car.players
      : [];

  return players.some(
    function (player) {
      if (
        !player ||
        isCancelledPlayerStatus(
          player.status
        )
      ) {
        return false;
      }

      return targetSet.has(
        getPlayerStableId(
          player
        )
      );
    }
  );
}

async function legacyScanCarsByPlayerIds(
  targetPlayerIds
) {
  const db =
    getDb();

  const snapshot =
    await db
      .collection("cars")
      .get();

  return snapshot.docs
    .map(
      function (doc) {
        return {
          id: doc.id,
          ...doc.data()
        };
      }
    )
    .filter(
      function (car) {
        return carMatchesPlayerIds(
          car,
          targetPlayerIds
        );
      }
    );
}

function chunkIds(
  ids,
  size
) {
  const chunks = [];

  for (
    let index = 0;
    index < ids.length;
    index += size
  ) {
    chunks.push(
      ids.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
}

// ============================================================
// 取得指定玩家參與的車團
//
// V2.80：
// - 正常路徑使用 playerIds array-contains-any
// - Identity 仍包含 currentPlayerId / profileId / linkedPlayerIds
// - 查詢結果仍以正式 players[] 驗證，避免 stale index 誤判
// - migration/query 失敗時安全 fallback
// ============================================================

async function getCarsByPlayerId(
  playerId
) {
  const db =
    getDb();

  const targetPlayerIds =
    await resolveTargetPlayerIds(
      playerId
    );

  console.log(
    "🎮 玩家身分 IDs：",
    targetPlayerIds
  );

  const indexReady =
    await ensurePlayerIdsIndex();

  if (!indexReady) {
    const fallbackCars =
      await legacyScanCarsByPlayerIds(
        targetPlayerIds
      );

    console.log(
      "🎮 使用相容模式找到玩家車團：",
      fallbackCars.length
    );

    return fallbackCars;
  }

  try {
    const carMap =
      new Map();

    /*
      array-contains-any 的查詢值數量有限制。
      這裡保守以 10 個 Identity 為一組，
      linkedPlayerIds 再多也可以分批查詢。
    */
    const chunks =
      chunkIds(
        targetPlayerIds,
        10
      );

    for (
      const ids
      of chunks
    ) {
      if (
        ids.length === 0
      ) {
        continue;
      }

      const snapshot =
        await db
          .collection("cars")
          .where(
            "playerIds",
            "array-contains-any",
            ids
          )
          .get();

      snapshot.docs.forEach(
        function (doc) {
          const car = {
            id: doc.id,
            ...doc.data()
          };

          if (
            carMatchesPlayerIds(
              car,
              targetPlayerIds
            )
          ) {
            carMap.set(
              doc.id,
              car
            );
          }
        }
      );
    }

    const matchedCars =
      Array.from(
        carMap.values()
      );

    console.log(
      "🎮 Indexed Query 找到玩家車團：",
      matchedCars.length
    );

    return matchedCars;
  } catch (error) {
    console.warn(
      "Indexed Player Query 失敗，暫時回退相容模式：",
      error
    );

    return legacyScanCarsByPlayerIds(
      targetPlayerIds
    );
  }
}

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYCarData = {
  getCarById,
  getCarsByOwner,
  getCarsByOwnerPage,
  getCarsByIds,
  getCarsByPlayerId,

  // V2.80 migration / diagnostics
  backfillPlayerIdsIndex,
  buildActivePlayerIds
};
})();
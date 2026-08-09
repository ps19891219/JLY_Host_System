console.log(
  "car-relations.js 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // 基本工具
  // ============================================================

  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase 尚未初始化"
      );
    }

    return window.db;
  }

  function normalizeText(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function getCurrentPlayerId() {
    if (
      window.JLYIdentity &&
      typeof window
        .JLYIdentity
        .getCurrentPlayerId ===
        "function"
    ) {
      return normalizeText(
        window.JLYIdentity
          .getCurrentPlayerId()
      );
    }

    return normalizeText(
      localStorage.getItem(
        "currentPlayerId"
      )
    );
  }

  function getRelationRef(
    playerId,
    carId
  ) {
    const normalizedPlayerId =
      normalizeText(playerId);

    const normalizedCarId =
      normalizeText(carId);

    if (!normalizedPlayerId) {
      throw new Error(
        "缺少 playerId"
      );
    }

    if (!normalizedCarId) {
      throw new Error(
        "缺少 carId"
      );
    }

    return getDb()
      .collection("players")
      .doc(normalizedPlayerId)
      .collection(
        "carRelations"
      )
      .doc(normalizedCarId);
  }

  // ============================================================
  // 取得單台車的個人 Relation
  // ============================================================

  async function getRelation(
    playerId,
    carId
  ) {
    const ref =
      getRelationRef(
        playerId,
        carId
      );

    const snapshot =
      await ref.get();

    if (!snapshot.exists) {
      return {
        playerId:
          normalizeText(
            playerId
          ),

        carId:
          normalizeText(
            carId
          ),

        assistRecruiting:
          false
      };
    }

    return {
      playerId:
        normalizeText(
          playerId
        ),

      carId:
        snapshot.id,

      ...snapshot.data()
    };
  }

  // ============================================================
  // 取得目前使用者對單台車的 Relation
  // ============================================================

  async function getMyRelation(
    carId
  ) {
    const playerId =
      getCurrentPlayerId();

    if (!playerId) {
      throw new Error(
        "目前沒有使用者 Identity"
      );
    }

    return getRelation(
      playerId,
      carId
    );
  }

  // ============================================================
  // 更新 Relation
  //
  // 使用 merge，
  // 未來 favorite / notification 等欄位
  // 可以繼續共用同一份 Relation。
  // ============================================================

  async function updateRelation(
    playerId,
    carId,
    patch
  ) {
    const normalizedPlayerId =
      normalizeText(playerId);

    const normalizedCarId =
      normalizeText(carId);

    if (!normalizedPlayerId) {
      throw new Error(
        "缺少 playerId"
      );
    }

    if (!normalizedCarId) {
      throw new Error(
        "缺少 carId"
      );
    }

    const sourcePatch =
      patch &&
      typeof patch ===
        "object"
        ? patch
        : {};

    const data = {
      ...sourcePatch,

      playerId:
        normalizedPlayerId,

      carId:
        normalizedCarId,

      updatedAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp()
    };

    const ref =
      getRelationRef(
        normalizedPlayerId,
        normalizedCarId
      );

    await ref.set(
      data,
      {
        merge: true
      }
    );

    return getRelation(
      normalizedPlayerId,
      normalizedCarId
    );
  }

  // ============================================================
  // 更新目前使用者的 Relation
  // ============================================================

  async function updateMyRelation(
    carId,
    patch
  ) {
    const playerId =
      getCurrentPlayerId();

    if (!playerId) {
      throw new Error(
        "目前沒有使用者 Identity"
      );
    }

    return updateRelation(
      playerId,
      carId,
      patch
    );
  }

  // ============================================================
  // 協助揪團
  // ============================================================

  async function setAssistRecruiting(
    playerId,
    carId,
    enabled
  ) {
    return updateRelation(
      playerId,
      carId,
      {
        assistRecruiting:
          Boolean(enabled)
      }
    );
  }

  async function setMyAssistRecruiting(
    carId,
    enabled
  ) {
    return updateMyRelation(
      carId,
      {
        assistRecruiting:
          Boolean(enabled)
      }
    );
  }

  // ============================================================
  // 取得某位使用者全部 Car Relations
  //
  // 之後個人揪團頁會用到：
  // 找出 assistRecruiting = true 的車。
  // ============================================================

  async function getRelationsByPlayer(
    playerId
  ) {
    const normalizedPlayerId =
      normalizeText(playerId);

    if (!normalizedPlayerId) {
      throw new Error(
        "缺少 playerId"
      );
    }

    const snapshot =
      await getDb()
        .collection("players")
        .doc(
          normalizedPlayerId
        )
        .collection(
          "carRelations"
        )
        .get();

    return snapshot.docs.map(
      function (doc) {
        return {
          carId:
            doc.id,

          playerId:
            normalizedPlayerId,

          ...doc.data()
        };
      }
    );
  }

  async function getMyRelations() {
    const playerId =
      getCurrentPlayerId();

    if (!playerId) {
      throw new Error(
        "目前沒有使用者 Identity"
      );
    }

    return getRelationsByPlayer(
      playerId
    );
  }

  async function getAssistRecruitingCarIds(
    playerId
  ) {
    const relations =
      await getRelationsByPlayer(
        playerId
      );

    return relations
      .filter(
        function (relation) {
          return (
            relation
              .assistRecruiting ===
            true
          );
        }
      )
      .map(
        function (relation) {
          return relation.carId;
        }
      );
  }

  async function getMyAssistRecruitingCarIds() {
    const playerId =
      getCurrentPlayerId();

    if (!playerId) {
      throw new Error(
        "目前沒有使用者 Identity"
      );
    }

    return getAssistRecruitingCarIds(
      playerId
    );
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYCarRelations = {
    getCurrentPlayerId,

    getRelation,
    getMyRelation,

    updateRelation,
    updateMyRelation,

    setAssistRecruiting,
    setMyAssistRecruiting,

    getRelationsByPlayer,
    getMyRelations,

    getAssistRecruitingCarIds,
    getMyAssistRecruitingCarIds
  };
})();
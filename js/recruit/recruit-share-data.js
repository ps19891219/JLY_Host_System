console.log(
  "recruit-share-data.js 已成功載入！"
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

  function getOwnerId() {
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

  function createShareToken() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {
      return window.crypto
        .randomUUID()
        .replace(/-/g, "");
    }

    return (
      Date.now()
        .toString(36) +
      Math.random()
        .toString(36)
        .slice(2, 14)
    );
  }

  function getRecruitUrl(token) {
    const normalizedToken =
      normalizeText(token);

    if (!normalizedToken) {
      return "";
    }

    return (
      location.origin +
      "/pages/recruit.html?t=" +
      encodeURIComponent(
        normalizedToken
      )
    );
  }

  // ============================================================
  // 取得目前分享設定
  // ============================================================

  async function getShareProfile() {
    const ownerId =
      getOwnerId();

    if (!ownerId) {
      throw new Error(
        "目前沒有使用者 Identity"
      );
    }

    const snapshot =
      await getDb()
        .collection(
          "recruitProfiles"
        )
        .doc(ownerId)
        .get();

    if (!snapshot.exists) {
      return {
        ownerId,
        activeToken: "",
        shareUrl: ""
      };
    }

    const data =
      snapshot.data() || {};

    const activeToken =
      normalizeText(
        data.activeToken
      );

    return {
      ownerId,
      activeToken,
      shareUrl:
        getRecruitUrl(
          activeToken
        ),
      ...data
    };
  }

  // ============================================================
  // 建立／更換分享 Token
  //
  // 先建立新 Token，
  // 再刪除舊 Token。
  //
  // 避免建立過程失敗時，
  // 舊連結先被提前殺掉。
  // ============================================================

  async function rotateShareToken() {
    const db =
      getDb();

    const ownerId =
      getOwnerId();

    if (!ownerId) {
      throw new Error(
        "目前沒有使用者 Identity"
      );
    }

    const profileRef =
      db
        .collection(
          "recruitProfiles"
        )
        .doc(ownerId);

    const profileSnapshot =
      await profileRef.get();

    const profile =
      profileSnapshot.exists
        ? (
            profileSnapshot
              .data() || {}
          )
        : {};

    const oldToken =
      normalizeText(
        profile.activeToken
      );

    const newToken =
      createShareToken();

    const newTokenRef =
      db
        .collection(
          "recruitPages"
        )
        .doc(newToken);

    const batch =
      db.batch();

    batch.set(
      newTokenRef,
      {
        ownerId,

        status:
          "active",

        createdAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp(),

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()
      }
    );

    batch.set(
      profileRef,
      {
        ownerId,

        activeToken:
          newToken,

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()
      },
      {
        merge: true
      }
    );

    if (
      oldToken &&
      oldToken !== newToken
    ) {
      const oldTokenRef =
        db
          .collection(
            "recruitPages"
          )
          .doc(oldToken);

      batch.delete(
        oldTokenRef
      );
    }

    await batch.commit();

    const result = {
      ownerId,
      oldToken,
      activeToken:
        newToken,
      shareUrl:
        getRecruitUrl(
          newToken
        )
    };

    console.log(
      "✅ 個人揪團分享 Token 已更新：",
      result
    );

    return result;
  }

  // ============================================================
  // 建立批次選取型臨時分享
  // ============================================================

  async function createSelectedShareToken(
    carIds,
    expiresDays
  ) {
    const db = getDb();
    const ownerId = getOwnerId();
    const ids = Array.from(
      new Set(
        (Array.isArray(carIds) ? carIds : [])
          .map(normalizeText)
          .filter(Boolean)
      )
    );

    if (!ownerId) {
      throw new Error("目前沒有使用者 Identity");
    }

    if (!ids.length) {
      throw new Error("請至少選擇一台車");
    }

    if (ids.length > 50) {
      throw new Error("單一臨時連結最多 50 台車");
    }

    const days =
      expiresDays === null ||
      expiresDays === "never"
        ? null
        : Math.max(
            1,
            Math.min(
              90,
              Number(expiresDays || 7)
            )
          );

    const token = createShareToken();
    const now = new Date();
    const expiresAt = days
      ? new Date(
          now.getTime() +
          days * 24 * 60 * 60 * 1000
        )
      : null;

    const payload = {
      ownerId,
      status: "active",
      scope: "selected",
      carIds: ids,
      temporary: true,
      createdAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp(),
      updatedAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp()
    };

    if (expiresAt) {
      payload.expiresAt =
        firebase.firestore.Timestamp
          .fromDate(expiresAt);
    }

    await db
      .collection("recruitPages")
      .doc(token)
      .set(payload);

    return {
      ownerId,
      activeToken: token,
      shareUrl: getRecruitUrl(token),
      carIds: ids,
      expiresAt:
        expiresAt
          ? expiresAt.toISOString()
          : "",
      expiresDays: days
    };
  }

  // ============================================================
  // 停用分享
  // ============================================================

  async function disableShareToken() {
    const db =
      getDb();

    const profile =
      await getShareProfile();

    const ownerId =
      profile.ownerId;

    const activeToken =
      normalizeText(
        profile.activeToken
      );

    if (!activeToken) {
      return {
        disabled: false
      };
    }

    const batch =
      db.batch();

    batch.delete(
      db
        .collection(
          "recruitPages"
        )
        .doc(activeToken)
    );

    batch.set(
      db
        .collection(
          "recruitProfiles"
        )
        .doc(ownerId),
      {
        activeToken:
          "",

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()
      },
      {
        merge: true
      }
    );

    await batch.commit();

    return {
      disabled: true,
      oldToken:
        activeToken
    };
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYRecruitShareData = {
    getOwnerId,
    getRecruitUrl,
    getShareProfile,
    rotateShareToken,
    createSelectedShareToken,
    disableShareToken
  };
})();
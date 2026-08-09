console.log(
  "recruit-data.js 已成功載入！"
);

(function () {
  "use strict";

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

  function getShareToken() {
    return normalizeText(
      new URLSearchParams(
        location.search
      ).get("t")
    );
  }

  async function getRecruitPageByToken(
    token
  ) {
    const normalizedToken =
      normalizeText(token);

    if (!normalizedToken) {
      return null;
    }

    const snapshot =
      await getDb()
        .collection(
          "recruitPages"
        )
        .doc(normalizedToken)
        .get();

    if (!snapshot.exists) {
      return null;
    }

    return {
      token:
        snapshot.id,

      ...snapshot.data()
    };
  }

  async function getRecruitCarsByOwner(
    ownerId
  ) {
    const normalizedOwnerId =
      normalizeText(ownerId);

    if (!normalizedOwnerId) {
      return [];
    }

    /*
      Car Data 已經是正式資料入口，
      這裡不自己再寫另一套 owner query。
    */
    if (
      window.JLYCarData &&
      typeof window
        .JLYCarData
        .getCarsByOwner ===
          "function"
    ) {
      return window
        .JLYCarData
        .getCarsByOwner(
          normalizedOwnerId
        );
    }

    throw new Error(
      "Car Data 模組尚未載入"
    );
  }

  window.JLYRecruitData = {
    getShareToken,
    getRecruitPageByToken,
    getRecruitCarsByOwner
  };
})();
/*
====================================================

JLY Host System

Module：
Car Detail Application Actions V1

用途：
1. 核准玩家報名申請
2. 拒絕玩家報名申請
3. 將申請資料轉成車團玩家資料
4. 更新 applications、players 與 history
5. 儲存 Firestore 後重新載入車團詳情

目前階段：
- 只搬移既有功能
- 尚未接入審核後自動入座
- 尚未改變原本資料格式與操作結果

依賴：
- window.db
- window.JLYCarDetailApplicationActionsConfig

====================================================
*/

console.log(
  "application-actions.js 已成功載入！"
);

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 取得外部設定
  // ------------------------------------------------------------

  function getConfig() {
    const config =
      window
        .JLYCarDetailApplicationActionsConfig;

    if (!config) {
      throw new Error(
        "Application Actions Config 尚未設定"
      );
    }

    return config;
  }

  function getCarId() {
    const config =
      getConfig();

    if (
      typeof config.getCarId !==
        "function"
    ) {
      throw new Error(
        "缺少 getCarId"
      );
    }

    return config.getCarId();
  }

  function nowTime() {
    const config =
      getConfig();

    if (
      typeof config.nowTime ===
        "function"
    ) {
      return config.nowTime();
    }

    return new Date()
      .toISOString();
  }

  function addHistory(
    car,
    type,
    text
  ) {
    const config =
      getConfig();

    if (
      typeof config.addHistory !==
        "function"
    ) {
      throw new Error(
        "缺少 addHistory"
      );
    }

    return config.addHistory(
      car,
      type,
      text
    );
  }

  async function refreshCarDetail() {
    const config =
      getConfig();

    if (
      typeof config.renderCarDetail ===
        "function"
    ) {
      await config
        .renderCarDetail();
    }
  }

  // ------------------------------------------------------------
  // 基礎工具
  // ------------------------------------------------------------

  function cloneArray(value) {
    return Array.isArray(value)
      ? value.map(function (item) {
          return (
            item &&
            typeof item ===
              "object"
              ? {
                  ...item
                }
              : item
          );
        })
      : [];
  }

  function createStablePlayerId(
    application
  ) {
    const app =
      application &&
      typeof application ===
        "object"
        ? application
        : {};

    return String(
      app.playerId ||
      app.id ||
      app.applicationId ||
      (
        "car-player-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 10)
      )
    );
  }

  function getApplicationPlayerName(
    application
  ) {
    const app =
      application &&
      typeof application ===
        "object"
        ? application
        : {};

    return String(
      app.name ||
      app.playerName ||
      "未命名玩家"
    );
  }

  function buildPlayerFromApplication(
    application,
    playerIndex
  ) {
    const app =
      application &&
      typeof application ===
        "object"
        ? application
        : {};

    const defaultName =
      getApplicationPlayerName(
        app
      );

    const stablePlayerId =
      createStablePlayerId(
        app
      );

    return {
      playerId:
        stablePlayerId,

      playerName:
        defaultName,

      name:
        defaultName,

      hostAlias:
        defaultName,

      hostNote:
        "",

      position:
        app.role ||
        app.position ||
        "不限",

      roleChoice:
        "",

      seatLabel:
        String(
          Number(playerIndex || 0) +
          1
        ),

      isCrossPlay:
        app.isCrossPlay ===
        true,

      source:
        app.source ||
        "join_page",

      status:
        "已加入",

      joinedAt:
        nowTime()
    };
  }

  // ------------------------------------------------------------
  // 核准申請
  // ------------------------------------------------------------

  async function approveApplication(
    index
  ) {
    const db =
      window.db;

    const carId =
      getCarId();

    if (!db) {
      alert(
        "Firebase 尚未載入"
      );

      return;
    }

    if (!carId) {
      alert(
        "找不到車團 ID"
      );

      return;
    }

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      const doc =
        await carRef.get();

      if (!doc.exists) {
        alert(
          "找不到這台車"
        );

        return;
      }

      const car =
        doc.data();

      const applications =
        cloneArray(
          car.applications
        );

      const players =
        cloneArray(
          car.players
        );

      const applicationIndex =
        Number(index);

      const app =
        applications[
          applicationIndex
        ];

      if (!app) {
        alert(
          "找不到這筆申請"
        );

        return;
      }

      const defaultName =
        getApplicationPlayerName(
          app
        );

      const player =
        buildPlayerFromApplication(
          app,
          players.length
        );

      players.push(
        player
      );

      applications.splice(
        applicationIndex,
        1
      );

      const history =
        addHistory(
          car,
          "玩家加入",
          defaultName +
            " 已核准加入車團"
        );

      await carRef.update({
        players,
        applications,
        history,
        updatedAt:
          nowTime()
      });

      alert(
        "已核准加入！"
      );

      await refreshCarDetail();
    } catch (error) {
      console.error(
        "核准申請失敗：",
        error
      );

      alert(
        "核准失敗：" +
        (
          error &&
          error.message
            ? error.message
            : "未知錯誤"
        )
      );
    }
  }

  // ------------------------------------------------------------
  // 拒絕申請
  // ------------------------------------------------------------

  async function rejectApplication(
    index
  ) {
    if (
      !confirm(
        "確定要拒絕這筆申請嗎？"
      )
    ) {
      return;
    }

    const db =
      window.db;

    const carId =
      getCarId();

    if (!db) {
      alert(
        "Firebase 尚未載入"
      );

      return;
    }

    if (!carId) {
      alert(
        "找不到車團 ID"
      );

      return;
    }

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      const doc =
        await carRef.get();

      if (!doc.exists) {
        alert(
          "找不到這台車"
        );

        return;
      }

      const car =
        doc.data();

      const applications =
        cloneArray(
          car.applications
        );

      const applicationIndex =
        Number(index);

      const app =
        applications[
          applicationIndex
        ];

      if (!app) {
        alert(
          "找不到這筆申請"
        );

        return;
      }

      applications.splice(
        applicationIndex,
        1
      );

      const playerName =
        getApplicationPlayerName(
          app
        );

      const history =
        addHistory(
          car,
          "拒絕申請",
          playerName +
            " 的報名申請已被拒絕"
        );

      await carRef.update({
        applications,
        history,
        updatedAt:
          nowTime()
      });

      alert(
        "已拒絕申請"
      );

      await refreshCarDetail();
    } catch (error) {
      console.error(
        "拒絕申請失敗：",
        error
      );

      alert(
        "拒絕失敗：" +
        (
          error &&
          error.message
            ? error.message
            : "未知錯誤"
        )
      );
    }
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window
    .JLYCarDetailApplicationActions = {
      createStablePlayerId,

      getApplicationPlayerName,

      buildPlayerFromApplication,

      approveApplication,

      rejectApplication
    };

  console.log(
    "✅ Car Detail Application Actions V1 已載入"
  );
})();
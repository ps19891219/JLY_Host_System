/*
====================================================

JLY Host System

Module：
Car Detail Application Actions V2

用途：
1. 核准玩家報名申請
2. 拒絕玩家報名申請
3. 將申請資料轉為車團玩家
4. 核准後自動尋找符合的空位
5. 找到位置時直接入座
6. 沒有符合位置時留在待安排
7. 同步 players、applications、slots、history

目前規則：
- 不強制反串
- 不符合的位置不自動安排
- 固定位置優先
- 不限角色席位可依玩家本場選擇轉成男位或女位
- 玩家沒有明確男／女選擇時，先留在待安排

依賴：
- window.db
- window.JLYCarDetailApplicationActionsConfig

====================================================
*/

console.log(
  "application-actions.js V2 已成功載入！"
);

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 外部設定
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
  // 通用工具
  // ------------------------------------------------------------

  function cloneValue(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function cloneArray(value) {
    return cloneValue(
      Array.isArray(value)
        ? value
        : []
    );
  }

  function normalizeId(value) {
    return String(
      value || ""
    ).trim();
  }

  function normalizePosition(value) {
    const text =
      String(
        value || ""
      )
        .trim()
        .toLowerCase();

    if (
      text === "male" ||
      text === "男" ||
      text === "男位" ||
      text === "男角"
    ) {
      return "male";
    }

    if (
      text === "female" ||
      text === "女" ||
      text === "女位" ||
      text === "女角"
    ) {
      return "female";
    }

    return "flexible";
  }

  function getPositionLabel(value) {
    const position =
      normalizePosition(value);

    if (position === "male") {
      return "男位";
    }

    if (position === "female") {
      return "女位";
    }

    return "不限";
  }

  function getSlotId(slot) {
    const source =
      slot &&
      typeof slot ===
        "object"
        ? slot
        : {};

    return normalizeId(
      source.slotId ||
      source.seatId ||
      source.id
    );
  }

  function getSlotType(slot) {
    const source =
      slot &&
      typeof slot ===
        "object"
        ? slot
        : {};

    return normalizePosition(
      source.type ||
      source.position ||
      source.originalType
    );
  }

  function getSlotOriginalType(slot) {
    const source =
      slot &&
      typeof slot ===
        "object"
        ? slot
        : {};

    return normalizePosition(
      source.originalType ||
      source.type ||
      source.position
    );
  }

  function getSlotPlayerId(slot) {
    const source =
      slot &&
      typeof slot ===
        "object"
        ? slot
        : {};

    return normalizeId(
      source.playerId ||
      (
        source.player &&
        (
          source.player.playerId ||
          source.player.id
        )
      )
    );
  }

  function isSlotEmpty(slot) {
    return !getSlotPlayerId(slot);
  }

  // ------------------------------------------------------------
  // 申請／玩家資料
  // ------------------------------------------------------------

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
      app.displayName ||
      "未命名玩家"
    );
  }

  function getApplicationPosition(
    application
  ) {
    const app =
      application &&
      typeof application ===
        "object"
        ? application
        : {};

    return normalizePosition(
      app.playPosition ||
      app.requestedPosition ||
      app.role ||
      app.position
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

    const normalizedPosition =
      getApplicationPosition(
        app
      );

    return {
      playerId:
        stablePlayerId,

      playerName:
        defaultName,

      name:
        defaultName,

      displayName:
        app.displayName ||
        defaultName,

      hostAlias:
        app.hostAlias ||
        defaultName,

      hostNote:
        app.hostNote ||
        "",

      gender:
        app.gender ||
        app.playerGender ||
        "",

      position:
        getPositionLabel(
          normalizedPosition
        ),

      requestedPosition:
        app.requestedPosition ||
        app.role ||
        app.position ||
        "",

      playPosition:
        normalizedPosition ===
          "flexible"
          ? ""
          : normalizedPosition,

      requestedCrossPlay:
        app.requestedCrossPlay ===
          true,

      allowCrossPlay:
        app.allowCrossPlay ===
          true,

      isCrossPlay:
        app.isCrossPlay ===
          true,

      roleChoice:
        app.roleChoice ||
        "",

      seatLabel:
        String(
          Number(playerIndex || 0) +
          1
        ),

      source:
        app.source ||
        "join_page",

      status:
        "已加入",

      applicationId:
        app.applicationId ||
        app.id ||
        "",

      joinedAt:
        nowTime(),

      updatedAt:
        nowTime()
    };
  }

  function createPlayerSnapshot(
    player
  ) {
    const source =
      player &&
      typeof player ===
        "object"
        ? player
        : {};

    return {
      playerId:
        source.playerId,

      id:
        source.playerId,

      playerName:
        source.playerName,

      name:
        source.hostAlias ||
        source.playerName ||
        source.name,

      displayName:
        source.hostAlias ||
        source.displayName ||
        source.playerName ||
        source.name,

      hostAlias:
        source.hostAlias ||
        "",

      gender:
        source.gender ||
        "",

      position:
        source.position ||
        "不限",

      playPosition:
        source.playPosition ||
        "",

      isCrossPlay:
        source.isCrossPlay ===
        true
    };
  }

  // ------------------------------------------------------------
  // 自動入座規則
  // ------------------------------------------------------------

  function findFixedPositionSlot(
    slots,
    playerPosition
  ) {
    return (
      slots.find(
        function (slot) {
          return (
            isSlotEmpty(slot) &&
            getSlotOriginalType(
              slot
            ) === playerPosition
          );
        }
      ) ||
      null
    );
  }

  function findFlexibleSlot(slots) {
    return (
      slots.find(
        function (slot) {
          return (
            isSlotEmpty(slot) &&
            getSlotOriginalType(
              slot
            ) === "flexible"
          );
        }
      ) ||
      null
    );
  }

  function findAutoSeat(
    slots,
    player
  ) {
    const playerPosition =
      normalizePosition(
        player.playPosition ||
        player.position
      );

    /*
     * 玩家沒有明確選擇男位或女位時，
     * 不由系統猜測，直接留在待安排。
     */
    if (
      playerPosition !== "male" &&
      playerPosition !== "female"
    ) {
      return {
        slot:
          null,

        position:
          "flexible",

        reason:
          "玩家尚未選擇實際男位或女位"
      };
    }

    /*
     * 第一順位：
     * 固定男位／固定女位。
     */
    const fixedSlot =
      findFixedPositionSlot(
        slots,
        playerPosition
      );

    if (fixedSlot) {
      return {
        slot:
          fixedSlot,

        position:
          playerPosition,

        reason:
          ""
      };
    }

    /*
     * 第二順位：
     * 可男可女的不限角色席位。
     */
    const flexibleSlot =
      findFlexibleSlot(
        slots
      );

    if (flexibleSlot) {
      return {
        slot:
          flexibleSlot,

        position:
          playerPosition,

        reason:
          ""
      };
    }

    return {
      slot:
        null,

      position:
        playerPosition,

      reason:
        getPositionLabel(
          playerPosition
        ) + "目前沒有空位"
    };
  }

  function assignPlayerToSlot(
    slots,
    player,
    seatResult
  ) {
    const nextSlots =
      cloneArray(slots);

    const targetSlotId =
      getSlotId(
        seatResult.slot
      );

    const targetIndex =
      nextSlots.findIndex(
        function (slot) {
          return (
            getSlotId(slot) ===
            targetSlotId
          );
        }
      );

    if (targetIndex < 0) {
      return {
        success:
          false,

        reason:
          "找不到自動安排的席位",

        slots:
          nextSlots,

        slotId:
          ""
      };
    }

    const targetSlot = {
      ...nextSlots[
        targetIndex
      ]
    };

    targetSlot.playerId =
      player.playerId;

    targetSlot.player =
      createPlayerSnapshot(
        player
      );

    targetSlot.updatedAt =
      nowTime();

    /*
     * 不限角色席位會依玩家本場選擇，
     * 顯示為實際男位或女位。
     *
     * originalType 仍保留 flexible，
     * 以免失去這個角色原本可男可女的性質。
     */
    if (
      getSlotOriginalType(
        targetSlot
      ) === "flexible"
    ) {
      targetSlot.originalType =
        "flexible";

      targetSlot.type =
        seatResult.position;
    }

    nextSlots[
      targetIndex
    ] = targetSlot;

    return {
      success:
        true,

      reason:
        "",

      slots:
        nextSlots,

      slotId:
        targetSlotId,

      slot:
        targetSlot
    };
  }

  function autoAssignApprovedPlayer(
    car,
    player
  ) {
    const slots =
      cloneArray(
        car.slots
      );

    if (slots.length === 0) {
      return {
        success:
          false,

        assigned:
          false,

        reason:
          "車團尚未建立席位",

        slots
      };
    }

    const seatResult =
      findAutoSeat(
        slots,
        player
      );

    if (!seatResult.slot) {
      return {
        success:
          true,

        assigned:
          false,

        reason:
          seatResult.reason,

        slots
      };
    }

    const assignmentResult =
      assignPlayerToSlot(
        slots,
        player,
        seatResult
      );

    if (
      !assignmentResult.success
    ) {
      return {
        success:
          false,

        assigned:
          false,

        reason:
          assignmentResult.reason,

        slots
      };
    }

    return {
      success:
        true,

      assigned:
        true,

      reason:
        "",

      slots:
        assignmentResult.slots,

      slotId:
        assignmentResult.slotId,

      assignedPosition:
        seatResult.position
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

      const autoSeatResult =
        autoAssignApprovedPlayer(
          car,
          player
        );

      const nextSlots =
        Array.isArray(
          autoSeatResult.slots
        )
          ? autoSeatResult.slots
          : cloneArray(
              car.slots
            );

      const historyText =
        autoSeatResult.assigned
          ? (
              defaultName +
              " 已核准加入車團，並自動安排至" +
              getPositionLabel(
                autoSeatResult
                  .assignedPosition
              )
            )
          : (
              defaultName +
              " 已核准加入車團，等待主揪安排席位" +
              (
                autoSeatResult.reason
                  ? "（" +
                    autoSeatResult.reason +
                    "）"
                  : ""
              )
            );

      const history =
        addHistory(
          car,
          "玩家加入",
          historyText
        );

      await carRef.update({
        players,
        applications,
        slots:
          nextSlots,
        history,
        updatedAt:
          nowTime()
      });

      if (
        autoSeatResult.assigned
      ) {
        alert(
          "已核准加入，並自動安排席位！"
        );
      } else {
        alert(
          "已核准加入，目前已放入待安排。"
        );
      }

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
      normalizePosition,

      getPositionLabel,

      getSlotId,

      getSlotOriginalType,

      createStablePlayerId,

      getApplicationPlayerName,

      getApplicationPosition,

      buildPlayerFromApplication,

      createPlayerSnapshot,

      findFixedPositionSlot,

      findFlexibleSlot,

      findAutoSeat,

      assignPlayerToSlot,

      autoAssignApprovedPlayer,

      approveApplication,

      rejectApplication
    };

  console.log(
    "✅ Car Detail Application Actions V2 已載入"
  );
})();
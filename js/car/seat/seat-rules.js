/*
====================================================

JLY Host System

Module：
Seat Rule Engine V2.5

用途：
1. 集中管理玩家與席位分類規則
2. 區分自動安排與主揪手動安排
3. 產生提醒，而不是把主揪操作直接阻擋
4. 提供後續同步 player.position 的判斷資料

規則：
- AUTO：嚴格分類，用於自動排位
- SYNC：嚴格分類，用於資料同步
- HOST：主揪有最終決定權
- IMPORT：保留既有資料，不硬性阻擋

依賴：
- window.JLYSeatData

====================================================
*/

console.log(
  "seat-rules.js 已成功載入！"
);

(function () {
  "use strict";

  const MODES = Object.freeze({
    AUTO:
      "auto",

    SYNC:
      "sync",

    HOST:
      "host",

    IMPORT:
      "import"
  });

  // ------------------------------------------------------------
  // 取得 Seat Data
  // ------------------------------------------------------------

  function getSeatData() {
    if (!window.JLYSeatData) {
      throw new Error(
        "JLYSeatData 尚未載入"
      );
    }

    return window.JLYSeatData;
  }

  // ------------------------------------------------------------
  // 標準化操作模式
  // ------------------------------------------------------------

  function normalizeMode(mode) {
    const value =
      String(
        mode || ""
      ).toLowerCase();

    if (
      Object.values(MODES)
        .includes(value)
    ) {
      return value;
    }

    return MODES.AUTO;
  }

  // ------------------------------------------------------------
  // 取得玩家位置
  // ------------------------------------------------------------

  function getPlayerPosition(player) {
    return getSeatData()
      .getPlayerPosition(
        player || {}
      );
  }

  // ------------------------------------------------------------
  // 取得席位分類
  // ------------------------------------------------------------

  function getSlotPosition(slot) {
    if (!slot) {
      return "flexible";
    }

    return getSeatData()
      .normalizePosition(
        slot.originalType ||
        slot.type ||
        "flexible"
      );
  }

  // ------------------------------------------------------------
  // 顯示名稱
  // ------------------------------------------------------------

  function getPositionLabel(position) {
    switch (
      String(position || "")
    ) {
      case "male":
        return "男位";

      case "female":
        return "女位";

      case "flexible":
      default:
        return "不限位";
    }
  }

  // ------------------------------------------------------------
  // 是否完全符合分類
  // ------------------------------------------------------------

  function isDirectMatch(
    playerPosition,
    slotPosition
  ) {
    if (
      slotPosition === "flexible"
    ) {
      return true;
    }

    if (
      playerPosition ===
      "flexible"
    ) {
      return true;
    }

    return (
      playerPosition ===
      slotPosition
    );
  }

  // ------------------------------------------------------------
  // 是否為跨男女位
  // ------------------------------------------------------------

  function isCrossGenderMove(
    playerPosition,
    slotPosition
  ) {
    return (
      (
        playerPosition === "male" &&
        slotPosition === "female"
      ) ||
      (
        playerPosition === "female" &&
        slotPosition === "male"
      )
    );
  }

  // ------------------------------------------------------------
  // 評估玩家是否可安排至指定席位
  //
  // allowed：
  // 是否允許繼續。
  //
  // requiresConfirmation：
  // 是否需要主揪確認。
  //
  // shouldOfferPositionUpdate：
  // 是否應詢問同步修改玩家 position。
  // ------------------------------------------------------------

  function evaluatePlacement(
    player,
    slot,
    options
  ) {
    const settings = {
      mode:
        MODES.AUTO,

      ...(
        options || {}
      )
    };

    const mode =
      normalizeMode(
        settings.mode
      );

    if (!player) {
      return {
        allowed:
          false,

        requiresConfirmation:
          false,

        shouldOfferPositionUpdate:
          false,

        reason:
          "找不到玩家資料",

        mode,

        playerPosition:
          "",

        slotPosition:
          ""
      };
    }

    if (!slot) {
      return {
        allowed:
          false,

        requiresConfirmation:
          false,

        shouldOfferPositionUpdate:
          false,

        reason:
          "找不到座位資料",

        mode,

        playerPosition:
          "",

        slotPosition:
          ""
      };
    }

    const playerPosition =
      getPlayerPosition(
        player
      );

    const slotPosition =
      getSlotPosition(
        slot
      );

    const directMatch =
      isDirectMatch(
        playerPosition,
        slotPosition
      );

    // 自動安排與同步維持嚴格規則
    if (
      mode === MODES.AUTO ||
      mode === MODES.SYNC
    ) {
      return {
        allowed:
          directMatch,

        requiresConfirmation:
          false,

        shouldOfferPositionUpdate:
          false,

        reason:
          directMatch
            ? ""
            : "玩家的位置分類與座位不符合",

        mode,

        playerPosition,

        slotPosition,

        directMatch
      };
    }

    // 匯入舊資料時不硬性阻擋
    if (mode === MODES.IMPORT) {
      return {
        allowed:
          true,

        requiresConfirmation:
          false,

        shouldOfferPositionUpdate:
          false,

        reason:
          "",

        mode,

        playerPosition,

        slotPosition,

        directMatch
      };
    }

    // 主揪模式：永遠可決定
    if (mode === MODES.HOST) {
      const crossGender =
        isCrossGenderMove(
          playerPosition,
          slotPosition
        );

      const movingToFlexible =
        slotPosition ===
        "flexible" &&
        playerPosition !==
        "flexible";

      const flexibleToFixed =
        playerPosition ===
        "flexible" &&
        slotPosition !==
        "flexible";

      return {
        allowed:
          true,

        requiresConfirmation:
          crossGender ||
          movingToFlexible ||
          flexibleToFixed,

        shouldOfferPositionUpdate:
          crossGender ||
          movingToFlexible ||
          flexibleToFixed,

        reason:
          "",

        warningType:
          crossGender
            ? "cross-gender"
            : movingToFlexible
              ? "move-to-flexible"
              : flexibleToFixed
                ? "flexible-to-fixed"
                : "",

        warningMessage:
          buildWarningMessage(
            playerPosition,
            slotPosition
          ),

        mode,

        playerPosition,

        slotPosition,

        directMatch
      };
    }

    return {
      allowed:
        directMatch,

      requiresConfirmation:
        false,

      shouldOfferPositionUpdate:
        false,

      reason:
        directMatch
          ? ""
          : "玩家的位置分類與座位不符合",

      mode,

      playerPosition,

      slotPosition,

      directMatch
    };
  }

  // ------------------------------------------------------------
  // 建立提醒文字
  // ------------------------------------------------------------

  function buildWarningMessage(
    playerPosition,
    slotPosition
  ) {
    const playerLabel =
      getPositionLabel(
        playerPosition
      );

    const slotLabel =
      getPositionLabel(
        slotPosition
      );

    if (
      playerPosition ===
        slotPosition
    ) {
      return "";
    }

    if (
      slotPosition ===
      "flexible"
    ) {
      return (
        `這位玩家目前設定為「${playerLabel}」，` +
        `你正要安排到「${slotLabel}」。`
      );
    }

    return (
      `這位玩家目前設定為「${playerLabel}」，` +
      `你正要安排到「${slotLabel}」。\n\n` +
      "主揪可以繼續安排，並決定是否同步修改玩家位置。"
    );
  }

  // ------------------------------------------------------------
  // 舊版相容入口
  // 預設維持 AUTO 嚴格規則
  // ------------------------------------------------------------

  function canPlayerUseSlot(
    player,
    slot,
    options
  ) {
    return evaluatePlacement(
      player,
      slot,
      options
    ).allowed;
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatRules = {
    MODES,

    normalizeMode,

    getPlayerPosition,

    getSlotPosition,

    getPositionLabel,

    isDirectMatch,

    isCrossGenderMove,

    buildWarningMessage,

    evaluatePlacement,

    canPlayerUseSlot
  };

  console.log(
    "✅ Seat Rule Engine V2.5 已載入"
  );
})();
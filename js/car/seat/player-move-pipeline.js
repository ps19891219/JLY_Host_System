/*
====================================================

JLY Host System

Module：
Player Move Pipeline V1

用途：
1. 統一處理玩家移動需求
2. 支援等待區 → 席位
3. 支援席位 → 席位
4. 支援席位 → 等待區
5. 呼叫 Seat Rules 評估分類
6. 產生主揪確認需要的資料
7. 呼叫既有 Seat Actions 執行移動

規則：
- 不直接操作 DOM
- 不直接寫入 Firestore
- 不直接顯示確認視窗
- 不直接重新 Render
- 自動安排維持嚴格分類
- 主揪手動安排可以跨位，但要先確認

依賴：
- window.JLYSeatData
- window.JLYSeatRules
- window.JLYSeatActions
- window.JLYSeatAssignment

====================================================
*/

console.log(
  "player-move-pipeline.js 已成功載入！"
);

(function () {
  "use strict";

  const SOURCE_TYPES =
    Object.freeze({
      SEAT:
        "seat",

      WAITING:
        "waiting"
    });

  const TARGET_TYPES =
    Object.freeze({
      SEAT:
        "seat",

      WAITING:
        "waiting"
    });

  const POSITION_DECISIONS =
    Object.freeze({
      KEEP:
        "keep",

      UPDATE:
        "update",

      CANCEL:
        "cancel"
    });

  // ------------------------------------------------------------
  // 模組取得
  // ------------------------------------------------------------

  function getSeatData() {
    if (!window.JLYSeatData) {
      throw new Error(
        "JLYSeatData 尚未載入"
      );
    }

    return window.JLYSeatData;
  }

  function getSeatRules() {
    if (!window.JLYSeatRules) {
      throw new Error(
        "JLYSeatRules 尚未載入"
      );
    }

    return window.JLYSeatRules;
  }

  function getSeatActions() {
    if (!window.JLYSeatActions) {
      throw new Error(
        "JLYSeatActions 尚未載入"
      );
    }

    return window.JLYSeatActions;
  }

  function getSeatAssignment() {
    if (!window.JLYSeatAssignment) {
      throw new Error(
        "JLYSeatAssignment 尚未載入"
      );
    }

    return window.JLYSeatAssignment;
  }

  // ------------------------------------------------------------
  // 基礎工具
  // ------------------------------------------------------------

  function cloneValue(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function normalizeId(value) {
    return String(
      value || ""
    ).trim();
  }

  function getPlayerId(
    player,
    index
  ) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return normalizeId(
      source.playerId ||
      source.id ||
      source.profileId ||
      source.applicationId ||
      (
        Number.isInteger(index)
          ? `legacy-player-${index + 1}`
          : ""
      )
    );
  }

  function getPlayerName(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return String(
      source.hostAlias ||
      source.name ||
      source.displayName ||
      source.playerName ||
      source.nickname ||
      "未命名玩家"
    );
  }

  function getPlayerById(
    players,
    playerId
  ) {
    const targetId =
      normalizeId(playerId);

    if (!targetId) {
      return null;
    }

    const sourcePlayers =
      Array.isArray(players)
        ? players
        : [];

    return (
      sourcePlayers.find(
        function (
          player,
          index
        ) {
          return (
            getPlayerId(
              player,
              index
            ) === targetId
          );
        }
      ) ||
      null
    );
  }

  function getPlayerIndexById(
    players,
    playerId
  ) {
    const targetId =
      normalizeId(playerId);

    if (!targetId) {
      return -1;
    }

    return (
      Array.isArray(players)
        ? players
        : []
    ).findIndex(
      function (
        player,
        index
      ) {
        return (
          getPlayerId(
            player,
            index
          ) === targetId
        );
      }
    );
  }

  function getSlotById(
    slots,
    slotId
  ) {
    return getSeatAssignment()
      .getSlotById(
        slots,
        slotId
      );
  }

  function getSlotPlayerId(slot) {
    if (!slot) {
      return "";
    }

    return normalizeId(
      slot.playerId ||
      (
        slot.player &&
        (
          slot.player.playerId ||
          slot.player.id
        )
      )
    );
  }

  // ------------------------------------------------------------
  // 標準 Pipeline 結果
  // ------------------------------------------------------------

  function createPipelineResult(
    success,
    options
  ) {
    const settings =
      options || {};

    return {
      success:
        Boolean(success),

      status:
        settings.status ||
        (
          success
            ? "completed"
            : "failed"
        ),

      reason:
        settings.reason ||
        "",

      action:
        settings.action ||
        "",

      sourceType:
        settings.sourceType ||
        "",

      targetType:
        settings.targetType ||
        "",

      sourceSlotId:
        settings.sourceSlotId ||
        "",

      targetSlotId:
        settings.targetSlotId ||
        "",

      playerId:
        settings.playerId ||
        "",

      playerName:
        settings.playerName ||
        "",

      requiresConfirmation:
        Boolean(
          settings.requiresConfirmation
        ),

      confirmation:
        settings.confirmation ||
        null,

      slots:
        Array.isArray(
          settings.slots
        )
          ? settings.slots
          : [],

      players:
        Array.isArray(
          settings.players
        )
          ? settings.players
          : [],

      actionResult:
        settings.actionResult ||
        null
    };
  }

  // ------------------------------------------------------------
  // 更新玩家位置
  // ------------------------------------------------------------

  function updatePlayerPosition(
    players,
    playerId,
    nextPosition
  ) {
    const nextPlayers =
      cloneValue(
        Array.isArray(players)
          ? players
          : []
      );

    const playerIndex =
      getPlayerIndexById(
        nextPlayers,
        playerId
      );

    if (playerIndex < 0) {
      return {
        changed:
          false,

        players:
          nextPlayers
      };
    }

    const SeatData =
      getSeatData();

    const normalizedPosition =
      SeatData.normalizePosition(
        nextPosition
      );

    const positionLabel =
      normalizedPosition ===
        "male"
        ? "男位"
        : normalizedPosition ===
            "female"
          ? "女位"
          : "不限";

    nextPlayers[playerIndex] = {
      ...nextPlayers[playerIndex],

      position:
        positionLabel,

      updatedAt:
        SeatData.nowTime()
    };

    return {
      changed:
        true,

      players:
        nextPlayers,

      player:
        nextPlayers[playerIndex]
    };
  }

  // ------------------------------------------------------------
  // 建立主揪確認資料
  // ------------------------------------------------------------

  function buildConfirmationData(
    player,
    slot,
    evaluation
  ) {
    const SeatRules =
      getSeatRules();

    return {
      title:
        "更改玩家席位",

      message:
        evaluation.warningMessage ||
        "玩家位置與目標席位不同。",

      playerId:
        getPlayerId(player),

      playerName:
        getPlayerName(player),

      currentPosition:
        evaluation.playerPosition,

      currentPositionLabel:
        SeatRules.getPositionLabel(
          evaluation.playerPosition
        ),

      targetPosition:
        evaluation.slotPosition,

      targetPositionLabel:
        SeatRules.getPositionLabel(
          evaluation.slotPosition
        ),

      targetSlotId:
        getSeatAssignment()
          .getSlotId(slot),

      allowKeepPosition:
        true,

      allowUpdatePosition:
        evaluation
          .shouldOfferPositionUpdate ===
        true,

      decisions: {
        keep:
          POSITION_DECISIONS.KEEP,

        update:
          POSITION_DECISIONS.UPDATE,

        cancel:
          POSITION_DECISIONS.CANCEL
      }
    };
  }

  // ------------------------------------------------------------
  // 評估單一玩家移入席位
  // ------------------------------------------------------------

  function evaluatePlayerToSeat(
    players,
    slots,
    playerId,
    targetSlotId,
    options
  ) {
    const settings = {
      mode:
        getSeatRules()
          .MODES.HOST,

      ...(
        options || {}
      )
    };

    const player =
      getPlayerById(
        players,
        playerId
      );

    if (!player) {
      return createPipelineResult(
        false,
        {
          status:
            "failed",

          reason:
            "找不到玩家資料",

          playerId:
            normalizeId(playerId),

          slots:
            cloneValue(slots),

          players:
            cloneValue(players)
        }
      );
    }

    const targetSlot =
      getSlotById(
        slots,
        targetSlotId
      );

    if (!targetSlot) {
      return createPipelineResult(
        false,
        {
          status:
            "failed",

          reason:
            "找不到目標座位",

          playerId:
            normalizeId(playerId),

          playerName:
            getPlayerName(player),

          targetSlotId:
            normalizeId(targetSlotId),

          slots:
            cloneValue(slots),

          players:
            cloneValue(players)
        }
      );
    }

    const evaluation =
      getSeatRules()
        .evaluatePlacement(
          player,
          targetSlot,
          {
            mode:
              settings.mode
          }
        );

    if (!evaluation.allowed) {
      return createPipelineResult(
        false,
        {
          status:
            "blocked",

          reason:
            evaluation.reason ||
            "無法安排玩家",

          playerId:
            normalizeId(playerId),

          playerName:
            getPlayerName(player),

          targetSlotId:
            normalizeId(targetSlotId),

          slots:
            cloneValue(slots),

          players:
            cloneValue(players)
        }
      );
    }

    if (
      evaluation
        .requiresConfirmation
    ) {
      return createPipelineResult(
        false,
        {
          status:
            "confirmation-required",

          action:
            "player-to-seat",

          sourceType:
            settings.sourceType ||
            SOURCE_TYPES.WAITING,

          targetType:
            TARGET_TYPES.SEAT,

          playerId:
            normalizeId(playerId),

          playerName:
            getPlayerName(player),

          sourceSlotId:
            settings.sourceSlotId ||
            "",

          targetSlotId:
            normalizeId(targetSlotId),

          requiresConfirmation:
            true,

          confirmation:
            buildConfirmationData(
              player,
              targetSlot,
              evaluation
            ),

          slots:
            cloneValue(slots),

          players:
            cloneValue(players)
        }
      );
    }

    return createPipelineResult(
      true,
      {
        status:
          "ready",

        action:
          "player-to-seat",

        sourceType:
          settings.sourceType ||
          SOURCE_TYPES.WAITING,

        targetType:
          TARGET_TYPES.SEAT,

        playerId:
          normalizeId(playerId),

        playerName:
          getPlayerName(player),

        sourceSlotId:
          settings.sourceSlotId ||
          "",

        targetSlotId:
          normalizeId(targetSlotId),

        slots:
          cloneValue(slots),

        players:
          cloneValue(players)
      }
    );
  }

  // ------------------------------------------------------------
  // 等待區 → 席位
  // ------------------------------------------------------------

  function moveWaitingPlayerToSeat(
    players,
    slots,
    playerId,
    targetSlotId,
    options
  ) {
    const settings =
      options || {};

    const evaluation =
      evaluatePlayerToSeat(
        players,
        slots,
        playerId,
        targetSlotId,
        {
          mode:
            settings.mode ||
            getSeatRules()
              .MODES.HOST,

          sourceType:
            SOURCE_TYPES.WAITING
        }
      );

    if (
      evaluation.status ===
        "confirmation-required" ||
      !evaluation.success
    ) {
      return evaluation;
    }

    const actionResult =
      getSeatActions()
        .moveWaitingPlayerToSlot(
          players,
          slots,
          playerId,
          targetSlotId
        );

    if (!actionResult.success) {
      return createPipelineResult(
        false,
        {
          status:
            "failed",

          reason:
            actionResult.reason ||
            "玩家安排失敗",

          action:
            "waiting-to-seat",

          sourceType:
            SOURCE_TYPES.WAITING,

          targetType:
            TARGET_TYPES.SEAT,

          playerId:
            normalizeId(playerId),

          targetSlotId:
            normalizeId(targetSlotId),

          slots:
            actionResult.slots,

          players:
            cloneValue(players),

          actionResult
        }
      );
    }

    return createPipelineResult(
      true,
      {
        status:
          "completed",

        action:
          "waiting-to-seat",

        sourceType:
          SOURCE_TYPES.WAITING,

        targetType:
          TARGET_TYPES.SEAT,

        playerId:
          normalizeId(playerId),

        playerName:
          evaluation.playerName,

        targetSlotId:
          normalizeId(targetSlotId),

        slots:
          actionResult.slots,

        players:
          cloneValue(players),

        actionResult
      }
    );
  }

  // ------------------------------------------------------------
  // 席位 → 席位
  //
  // 主揪模式下，先由 Rule Engine 評估。
  // 真正交換仍交給 Seat Actions。
  // ------------------------------------------------------------

  function moveSeatedPlayer(
    players,
    slots,
    sourceSlotId,
    targetSlotId,
    options
  ) {
    const sourceSlot =
      getSlotById(
        slots,
        sourceSlotId
      );

    if (!sourceSlot) {
      return createPipelineResult(
        false,
        {
          reason:
            "找不到來源座位",

          action:
            "seat-to-seat",

          sourceSlotId:
            normalizeId(sourceSlotId),

          targetSlotId:
            normalizeId(targetSlotId),

          slots:
            cloneValue(slots),

          players:
            cloneValue(players)
        }
      );
    }

    const playerId =
      getSlotPlayerId(
        sourceSlot
      );

    if (!playerId) {
      return createPipelineResult(
        false,
        {
          reason:
            "來源座位沒有玩家",

          action:
            "seat-to-seat",

          sourceSlotId:
            normalizeId(sourceSlotId),

          targetSlotId:
            normalizeId(targetSlotId),

          slots:
            cloneValue(slots),

          players:
            cloneValue(players)
        }
      );
    }

    const evaluation =
      evaluatePlayerToSeat(
        players,
        slots,
        playerId,
        targetSlotId,
        {
          mode:
            options &&
            options.mode
              ? options.mode
              : getSeatRules()
                  .MODES.HOST,

          sourceType:
            SOURCE_TYPES.SEAT,

          sourceSlotId:
            normalizeId(
              sourceSlotId
            )
        }
      );

    if (
      evaluation.status ===
        "confirmation-required" ||
      !evaluation.success
    ) {
      return evaluation;
    }

    const actionResult =
      getSeatActions()
        .movePlayer(
          players,
          slots,
          sourceSlotId,
          targetSlotId
        );

    if (!actionResult.success) {
      return createPipelineResult(
        false,
        {
          status:
            "failed",

          reason:
            actionResult.reason ||
            "玩家移動失敗",

          action:
            "seat-to-seat",

          sourceType:
            SOURCE_TYPES.SEAT,

          targetType:
            TARGET_TYPES.SEAT,

          sourceSlotId:
            normalizeId(
              sourceSlotId
            ),

          targetSlotId:
            normalizeId(
              targetSlotId
            ),

          playerId,

          slots:
            actionResult.slots,

          players:
            cloneValue(players),

          actionResult
        }
      );
    }

    return createPipelineResult(
      true,
      {
        status:
          "completed",

        action:
          "seat-to-seat",

        sourceType:
          SOURCE_TYPES.SEAT,

        targetType:
          TARGET_TYPES.SEAT,

        sourceSlotId:
          normalizeId(
            sourceSlotId
          ),

        targetSlotId:
          normalizeId(
            targetSlotId
          ),

        playerId,

        playerName:
          evaluation.playerName,

        slots:
          actionResult.slots,

        players:
          cloneValue(players),

        actionResult
      }
    );
  }

  // ------------------------------------------------------------
  // 席位 → 等待區
  // ------------------------------------------------------------

  function movePlayerToWaiting(
    players,
    slots,
    playerId
  ) {
    const actionResult =
      getSeatActions()
        .movePlayerToWaiting(
          players,
          slots,
          playerId
        );

    if (!actionResult.success) {
      return createPipelineResult(
        false,
        {
          status:
            "failed",

          reason:
            actionResult.reason ||
            "無法移回等待安排",

          action:
            "seat-to-waiting",

          sourceType:
            SOURCE_TYPES.SEAT,

          targetType:
            TARGET_TYPES.WAITING,

          playerId:
            normalizeId(playerId),

          slots:
            actionResult.slots,

          players:
            cloneValue(players),

          actionResult
        }
      );
    }

    return createPipelineResult(
      true,
      {
        status:
          "completed",

        action:
          "seat-to-waiting",

        sourceType:
          SOURCE_TYPES.SEAT,

        targetType:
          TARGET_TYPES.WAITING,

        playerId:
          normalizeId(playerId),

        slots:
          actionResult.slots,

        players:
          cloneValue(players),

        actionResult
      }
    );
  }

  // ------------------------------------------------------------
  // 確認後繼續執行
  //
  // decision：
  // keep   保留玩家原位置
  // update 同步修改玩家 position
  // cancel 取消移動
  // ------------------------------------------------------------

  function continueAfterConfirmation(
    pendingResult,
    decision
  ) {
    if (
      !pendingResult ||
      pendingResult.status !==
        "confirmation-required"
    ) {
      return createPipelineResult(
        false,
        {
          reason:
            "找不到等待確認的移動資料"
        }
      );
    }

    if (
      decision ===
      POSITION_DECISIONS.CANCEL
    ) {
      return createPipelineResult(
        false,
        {
          status:
            "cancelled",

          reason:
            "主揪取消移動",

          action:
            pendingResult.action,

          sourceType:
            pendingResult.sourceType,

          targetType:
            pendingResult.targetType,

          sourceSlotId:
            pendingResult.sourceSlotId,

          targetSlotId:
            pendingResult.targetSlotId,

          playerId:
            pendingResult.playerId,

          playerName:
            pendingResult.playerName,

          slots:
            cloneValue(
              pendingResult.slots
            ),

          players:
            cloneValue(
              pendingResult.players
            )
        }
      );
    }

    let nextPlayers =
      cloneValue(
        pendingResult.players
      );

    if (
      decision ===
      POSITION_DECISIONS.UPDATE
    ) {
      const updateResult =
        updatePlayerPosition(
          nextPlayers,
          pendingResult.playerId,
          pendingResult
            .confirmation
            .targetPosition
        );

      nextPlayers =
        updateResult.players;
    }

    let actionResult;

    if (
      pendingResult.sourceType ===
        SOURCE_TYPES.WAITING &&
      pendingResult.targetType ===
        TARGET_TYPES.SEAT
    ) {
      actionResult =
        getSeatActions()
          .moveWaitingPlayerToSlot(
            nextPlayers,
            pendingResult.slots,
            pendingResult.playerId,
            pendingResult.targetSlotId
          );
    } else if (
      pendingResult.sourceType ===
        SOURCE_TYPES.SEAT &&
      pendingResult.targetType ===
        TARGET_TYPES.SEAT
    ) {
      /*
       * Seat Assignment 原本是嚴格模式。
       *
       * 下一階段會替 Seat Actions 增加
       * hostOverride 參數，讓主揪確認後
       * 可以正式跨分類執行。
       */
      return createPipelineResult(
        false,
        {
          status:
            "host-override-required",

          reason:
            "主揪跨分類移動尚待接入 Seat Actions",

          action:
            pendingResult.action,

          sourceType:
            pendingResult.sourceType,

          targetType:
            pendingResult.targetType,

          sourceSlotId:
            pendingResult.sourceSlotId,

          targetSlotId:
            pendingResult.targetSlotId,

          playerId:
            pendingResult.playerId,

          playerName:
            pendingResult.playerName,

          slots:
            cloneValue(
              pendingResult.slots
            ),

          players:
            nextPlayers
        }
      );
    } else {
      return createPipelineResult(
        false,
        {
          reason:
            "目前不支援這種玩家移動"
        }
      );
    }

    if (!actionResult.success) {
      return createPipelineResult(
        false,
        {
          status:
            "failed",

          reason:
            actionResult.reason ||
            "確認後仍無法完成移動",

          action:
            pendingResult.action,

          sourceType:
            pendingResult.sourceType,

          targetType:
            pendingResult.targetType,

          sourceSlotId:
            pendingResult.sourceSlotId,

          targetSlotId:
            pendingResult.targetSlotId,

          playerId:
            pendingResult.playerId,

          playerName:
            pendingResult.playerName,

          slots:
            actionResult.slots,

          players:
            nextPlayers,

          actionResult
        }
      );
    }

    return createPipelineResult(
      true,
      {
        status:
          "completed",

        action:
          pendingResult.action,

        sourceType:
          pendingResult.sourceType,

        targetType:
          pendingResult.targetType,

        sourceSlotId:
          pendingResult.sourceSlotId,

        targetSlotId:
          pendingResult.targetSlotId,

        playerId:
          pendingResult.playerId,

        playerName:
          pendingResult.playerName,

        slots:
          actionResult.slots,

        players:
          nextPlayers,

        actionResult
      }
    );
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYPlayerMovePipeline = {
    SOURCE_TYPES,

    TARGET_TYPES,

    POSITION_DECISIONS,

    getPlayerId,

    getPlayerName,

    getPlayerById,

    getPlayerIndexById,

    getSlotPlayerId,

    createPipelineResult,

    updatePlayerPosition,

    buildConfirmationData,

    evaluatePlayerToSeat,

    moveWaitingPlayerToSeat,

    moveSeatedPlayer,

    movePlayerToWaiting,

    continueAfterConfirmation
  };

  console.log(
    "✅ Player Move Pipeline V1 已載入"
  );
})();
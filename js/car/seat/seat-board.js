console.log("seat-board.js 已成功載入！");

// ============================================================
// JLY Host System
// Seat Board Controller V1
//
// 負責：
// 1. 接收 car 與 players
// 2. 整理 slots 與玩家資料
// 3. 計算等待安排玩家
// 4. 呼叫 JLYSeatRender 產生座位畫面
// 5. 提供 cardetail.js 使用的單一入口
//
// 不負責：
// - 直接寫入 Firestore
// - 直接修改 slot.playerId
// - 玩家搜尋或建立
// - 拖曳規則
// ============================================================

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 取得必要模組
  // ------------------------------------------------------------

  function getSeatRender() {
    if (!window.JLYSeatRender) {
      throw new Error(
        "JLYSeatRender 尚未載入，請先載入 seat-render.js"
      );
    }

    return window.JLYSeatRender;
  }

  // ------------------------------------------------------------
  // 基本工具
  // ------------------------------------------------------------

  function cloneValue(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function getPlayerId(
    player,
    index
  ) {
    return String(
      (
        player &&
        (
          player.playerId ||
          player.id ||
          player.profileId ||
          player.applicationId
        )
      ) ||
      `legacy-player-${Number(index || 0) + 1}`
    );
  }

  function getPlayerName(player) {
    return String(
      (
        player &&
        (
          player.hostAlias ||
          player.name ||
          player.displayName ||
          player.playerName ||
          player.nickname
        )
      ) ||
      "未命名玩家"
    );
  }

  function isCancelledPlayer(player) {
    const status =
      String(
        player &&
        player.status
          ? player.status
          : ""
      ).trim();

    return (
      status === "已取消" ||
      status === "取消" ||
      status === "cancelled" ||
      status === "canceled"
    );
  }

  function getActivePlayers(players) {
    const sourcePlayers =
      Array.isArray(players)
        ? players
        : [];

    return sourcePlayers.filter(
      function (player) {
        return !isCancelledPlayer(
          player
        );
      }
    );
  }

  // ------------------------------------------------------------
  // 取得車團席位
  //
  // 優先使用 seat.js 相容層的 getSlots()
  // ------------------------------------------------------------

  function getCarSlots(car) {
    if (!car) {
      return [];
    }

    if (
      typeof window.getSlots ===
      "function"
    ) {
      return cloneValue(
        window.getSlots(car)
      );
    }

    return Array.isArray(car.slots)
      ? cloneValue(car.slots)
      : [];
  }

  // ------------------------------------------------------------
  // 建立玩家 Map
  // ------------------------------------------------------------

  function buildPlayerMap(players) {
    const activePlayers =
      getActivePlayers(players);

    const playerMap =
      new Map();

    activePlayers.forEach(
      function (player, index) {
        const playerId =
          getPlayerId(
            player,
            index
          );

        playerMap.set(
          playerId,
          {
            player,
            playerId,
            playerIndex:
              index
          }
        );
      }
    );

    return playerMap;
  }

  // ------------------------------------------------------------
  // 將車團玩家資料補進 slots
  //
  // Firestore 裡的 slot.player 有時可能為空，
  // 但 playerId 仍然存在。
  //
  // Render 前在這裡補齊顯示名稱，
  // 不直接修改 Firestore 原始資料。
  // ------------------------------------------------------------

  function hydrateSlots(
    slots,
    players
  ) {
    const sourceSlots =
      Array.isArray(slots)
        ? cloneValue(slots)
        : [];

    const playerMap =
      buildPlayerMap(players);

    return sourceSlots.map(
      function (slot, index) {
        const slotId =
          String(
            slot.slotId ||
            slot.id ||
            `slot-${index + 1}`
          );

        const playerId =
          slot.playerId
            ? String(
                slot.playerId
              )
            : "";

        const playerItem =
          playerId
            ? playerMap.get(
                playerId
              )
            : null;

        const player =
          playerItem
            ? playerItem.player
            : null;

        return {
          ...slot,

          id:
            String(
              slot.id ||
              slotId
            ),

          slotId,

          order:
            Number(
              slot.order ||
              index + 1
            ),

          playerId:
            playerId ||
            null,

          player:
            player
              ? {
                  ...cloneValue(player),

                  id:
                    playerId,

                  playerId,

                  name:
                    getPlayerName(
                      player
                    ),

                  displayName:
                    getPlayerName(
                      player
                    ),

                  playerIndex:
                    playerItem
                      .playerIndex
                }
              : null
        };
      }
    );
  }

  // ------------------------------------------------------------
  // 計算等待安排玩家
  //
  // 等待安排 =
  // 車團有效玩家 - 已存在於 slot.playerId 的玩家
  // ------------------------------------------------------------

  function getWaitingPlayers(
    players,
    slots
  ) {
    const activePlayers =
      getActivePlayers(players);

    const occupiedIds =
      new Set();

    (
      Array.isArray(slots)
        ? slots
        : []
    ).forEach(
      function (slot) {
        if (slot.playerId) {
          occupiedIds.add(
            String(
              slot.playerId
            )
          );
        }
      }
    );

    return activePlayers
      .map(
        function (player, index) {
          const playerId =
            getPlayerId(
              player,
              index
            );

          return {
            ...cloneValue(player),

            player,

            playerId,

            id:
              playerId,

            playerIndex:
              index,

            displayName:
              getPlayerName(
                player
              ),

            waitingReason:
              "尚未安排席位"
          };
        }
      )
      .filter(
        function (waitingItem) {
          return !occupiedIds.has(
            waitingItem.playerId
          );
        }
      );
  }

  // ------------------------------------------------------------
  // 建立 Seat Board 資料
  // ------------------------------------------------------------

  function buildBoardData(
    car,
    players
  ) {
    const sourcePlayers =
      Array.isArray(players)
        ? players
        : (
            car &&
            Array.isArray(
              car.players
            )
              ? car.players
              : []
          );

    const rawSlots =
      getCarSlots(car);

    const slots =
      hydrateSlots(
        rawSlots,
        sourcePlayers
      );

    const waitingPlayers =
      getWaitingPlayers(
        sourcePlayers,
        slots
      );

    return {
      car:
        car || {},

      players:
        sourcePlayers,

      activePlayers:
        getActivePlayers(
          sourcePlayers
        ),

      slots,

      waitingPlayers
    };
  }

  // ------------------------------------------------------------
  // 建立完整座位 HTML
  //
  // cardetail.js 之後只需要：
  //
  // JLYSeatBoard.buildHtml(car, players)
  // ------------------------------------------------------------

  function buildHtml(
    car,
    players,
    options
  ) {
    const SeatRender =
      getSeatRender();

    const boardData =
      buildBoardData(
        car,
        players
      );

    const settings = {
      showSummary:
        true,

      showWaitingArea:
        true,

      includeEmptySections:
        false,

      ...(
        options || {}
      )
    };

    const result =
      SeatRender.buildSeatHtml(
        boardData.slots,
        boardData.waitingPlayers,
        settings
      );

    return {
      html:
        result.html,

      viewModel:
        result.viewModel,

      boardData
    };
  }

  // ------------------------------------------------------------
  // 畫入指定容器
  //
  // 這個方法之後可用於：
  // - 局部重新整理
  // - 拖曳完成後重畫
  // - 同步完成後重畫
  // ------------------------------------------------------------

  function render(
    container,
    car,
    players,
    options
  ) {
    const SeatRender =
      getSeatRender();

    const boardData =
      buildBoardData(
        car,
        players
      );

    const result =
      SeatRender.render(
        container,
        boardData.slots,
        boardData.waitingPlayers,
        {
          showSummary:
            true,

          showWaitingArea:
            true,

          includeEmptySections:
            false,

          ...(
            options || {}
          )
        }
      );

    return {
      ...result,
      boardData
    };
  }

  // ------------------------------------------------------------
  // 檢查模組是否已準備完成
  // ------------------------------------------------------------

  function isReady() {
    return Boolean(
      window.JLYSeatRender &&
      typeof window
        .JLYSeatRender
        .buildSeatHtml ===
        "function"
    );
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatBoard = {
    getPlayerId,
    getPlayerName,
    isCancelledPlayer,
    getActivePlayers,

    getCarSlots,
    buildPlayerMap,
    hydrateSlots,
    getWaitingPlayers,

    buildBoardData,
    buildHtml,
    render,
    isReady
  };
})();
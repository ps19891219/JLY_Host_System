console.log("seat-board.js V2 已成功載入！");

// ============================================================
// JLY Host System
// Seat Board Controller V2
//
// 負責：
// 1. 整理車團席位與玩家
// 2. 計算等待安排玩家
// 3. 呼叫 JLYSeatRender 畫面
// 4. 綁定空位與玩家點擊事件
// 5. 提供局部重新整理入口
//
// 不負責：
// - 直接安排或交換玩家
// - 直接修改 slot.playerId
// - 直接寫入 Firestore
// ============================================================

(function () {
  "use strict";

  const boardState = {
    container: null,
    car: null,
    players: [],
    options: {}
  };

  // ============================================================
  // 模組檢查
  // ============================================================

  function getSeatRender() {
    if (!window.JLYSeatRender) {
      throw new Error(
        "JLYSeatRender 尚未載入"
      );
    }

    return window.JLYSeatRender;
  }

  function isReady() {
    return Boolean(
      window.JLYSeatRender &&
      typeof window
        .JLYSeatRender
        .render === "function"
    );
  }

  // ============================================================
  // 基本工具
  // ============================================================

  function cloneValue(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function resolveContainer(container) {
    if (!container) {
      return null;
    }

    if (
      container instanceof
      HTMLElement
    ) {
      return container;
    }

    const value =
      String(container);

    return (
      document.querySelector(value) ||
      document.getElementById(
        value.replace(/^#/, "")
      )
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
    return (
      Array.isArray(players)
        ? players
        : []
    ).filter(
      function (player) {
        return !isCancelledPlayer(
          player
        );
      }
    );
  }

  // ============================================================
  // 席位資料
  // ============================================================

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

  function buildPlayerMap(players) {
    const map =
      new Map();

    (
      Array.isArray(players)
        ? players
        : []
    ).forEach(
      function (player, index) {
        const playerId =
          getPlayerId(
            player,
            index
          );

        map.set(
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

    return map;
  }

  function hydrateSlots(
    slots,
    players
  ) {
    const playerMap =
      buildPlayerMap(players);

    return (
      Array.isArray(slots)
        ? slots
        : []
    ).map(
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
          ...cloneValue(slot),

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

  // ============================================================
  // 等待安排
  // ============================================================

  function getWaitingPlayers(
    players,
    slots
  ) {
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

    return getActivePlayers(
      players
    )
      .map(
        function (player) {
          const originalIndex =
            players.indexOf(
              player
            );

          const playerId =
            getPlayerId(
              player,
              originalIndex
            );

          return {
            ...cloneValue(player),

            player:
              cloneValue(player),

            playerId,

            id:
              playerId,

            playerIndex:
              originalIndex,

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
        function (item) {
          return !occupiedIds.has(
            item.playerId
          );
        }
      );
  }

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

    const slots =
      hydrateSlots(
        getCarSlots(car),
        sourcePlayers
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

      waitingPlayers:
        getWaitingPlayers(
          sourcePlayers,
          slots
        )
    };
  }

  // ============================================================
  // 查找資料
  // ============================================================

  function findSlotById(
    boardData,
    slotId
  ) {
    const targetId =
      String(slotId || "");

    return (
      boardData.slots.find(
        function (slot) {
          return (
            String(
              slot.slotId || ""
            ) === targetId ||
            String(
              slot.id || ""
            ) === targetId ||
            String(
              slot.order || ""
            ) === targetId
          );
        }
      ) ||
      null
    );
  }

  function findPlayerIndexById(
    boardData,
    playerId
  ) {
    const targetId =
      String(playerId || "");

    return boardData.players
      .findIndex(
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

  // ============================================================
  // 點擊操作
  // ============================================================

  function openEmptySeat(slotId) {
    if (
      typeof window.openEmptySeat ===
      "function"
    ) {
      window.openEmptySeat(
        slotId
      );

      return;
    }

    if (
      typeof window.addPlayerManually ===
      "function"
    ) {
      window.addPlayerManually(
        slotId
      );

      return;
    }

    alert(
      "目前無法開啟新增玩家功能"
    );
  }

  function openPlayerEditor(
    playerIndex
  ) {
    if (
      !Number.isInteger(
        playerIndex
      ) ||
      playerIndex < 0
    ) {
      alert(
        "找不到玩家資料"
      );

      return;
    }

    if (
      typeof window
        .openExistingPlayerEditor ===
      "function"
    ) {
      window
        .openExistingPlayerEditor(
          playerIndex
        );

      return;
    }

    alert(
      "目前無法開啟玩家編輯功能"
    );
  }

  function handleBoardClick(
    event,
    boardData
  ) {
    const autoPlaceButton =
      event.target.closest(
        "[data-seat-auto-place]"
      );

    if (autoPlaceButton) {
      event.preventDefault();

      const playerId =
        autoPlaceButton.getAttribute(
          "data-player-id"
        );

      const playerIndex =
        findPlayerIndexById(
          boardData,
          playerId
        );

      if (
        playerIndex < 0
      ) {
        alert(
          "找不到等待安排的玩家"
        );

        return;
      }

      alert(
        "自動安排功能會在下一步接上。\n\n目前可以先點擊空位，選擇這位玩家。"
      );

      return;
    }

    const playerElement =
      event.target.closest(
        '[data-seat-player-drag="true"]'
      );

    if (playerElement) {
      event.preventDefault();

      const playerId =
        playerElement.getAttribute(
          "data-player-id"
        );

      const playerIndex =
        findPlayerIndexById(
          boardData,
          playerId
        );

      openPlayerEditor(
        playerIndex
      );

      return;
    }

    const menuButton =
      event.target.closest(
        "[data-seat-menu-button]"
      );

    if (menuButton) {
      event.preventDefault();

      const slotId =
        menuButton.getAttribute(
          "data-slot-id"
        );

      const slot =
        findSlotById(
          boardData,
          slotId
        );

      if (!slot) {
        alert(
          "找不到席位資料"
        );

        return;
      }

      if (!slot.playerId) {
        openEmptySeat(
          slotId
        );

        return;
      }

      const playerIndex =
        findPlayerIndexById(
          boardData,
          slot.playerId
        );

      openPlayerEditor(
        playerIndex
      );

      return;
    }

    const seatRow =
      event.target.closest(
        "[data-seat-row]"
      );

    if (!seatRow) {
      return;
    }

    const slotId =
      seatRow.getAttribute(
        "data-slot-id"
      );

    const slot =
      findSlotById(
        boardData,
        slotId
      );

    if (
      slot &&
      !slot.playerId
    ) {
      openEmptySeat(
        slotId
      );
    }
  }

  function bindBoardEvents(
    container,
    boardData
  ) {
    if (!container) {
      return;
    }

    container.onclick =
      function (event) {
        handleBoardClick(
          event,
          boardData
        );
      };
  }

  // ============================================================
  // Render
  // ============================================================

  function render(
    container,
    car,
    players,
    options
  ) {
    const target =
      resolveContainer(
        container
      );

    if (!target) {
      console.error(
        "Seat Board：找不到顯示容器",
        container
      );

      return {
        success:
          false,

        reason:
          "找不到座位顯示容器"
      };
    }

    if (!isReady()) {
      target.innerHTML = `
        <div class="seat-empty-state">
          座位模組尚未載入
        </div>
      `;

      return {
        success:
          false,

        reason:
          "Seat Render 尚未載入"
      };
    }

    const boardData =
      buildBoardData(
        car,
        players
      );

    const SeatRender =
      getSeatRender();

    const result =
      SeatRender.render(
        target,
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

    if (result.success) {
      bindBoardEvents(
        target,
        boardData
      );
    }

    boardState.container =
      target;

    boardState.car =
      car;

    boardState.players =
      players;

    boardState.options =
      options || {};

    return {
      ...result,
      boardData
    };
  }

  function refresh() {
    if (
      !boardState.container ||
      !boardState.car
    ) {
      return {
        success:
          false,

        reason:
          "尚未建立 Seat Board"
      };
    }

    return render(
      boardState.container,
      boardState.car,
      boardState.players,
      boardState.options
    );
  }

  // 保留給暫時仍需要字串 HTML 的地方
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

    const result =
      SeatRender.buildSeatHtml(
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
      html:
        result.html,

      viewModel:
        result.viewModel,

      boardData
    };
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYSeatBoard = {
    isReady,

    getPlayerId,
    getPlayerName,
    isCancelledPlayer,
    getActivePlayers,

    getCarSlots,
    buildPlayerMap,
    hydrateSlots,
    getWaitingPlayers,
    buildBoardData,

    findSlotById,
    findPlayerIndexById,

    buildHtml,
    render,
    refresh
  };
})();
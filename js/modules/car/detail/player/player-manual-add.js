/*
====================================================

JLY Host System V3

Module：
Car Detail Player Manual Add

用途：
1. 主揪手動搜尋玩家
2. 選擇既有玩家或建立訪客玩家
3. 將尚未入座的既有玩家補入指定空位
4. 開啟 Player Editor 新增本場玩家
5. 處理彈性席位的男女位轉換

規則：
- 玩家搜尋交給 Player Search
- 玩家資料輸入交給 Player Editor
- 玩家移除交給 Player Actions
- 只處理「主揪手動新增」入口
- 不處理玩家自行報名審核

依賴：
- window.db
- window.JLYCarDetailPlayerSearch
- window.JLYCarDetailPlayerEditor
- window.renderCarDetail

====================================================
*/

console.log(
  "player-manual-add.js 已成功載入！"
);

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 共用工具
  // ------------------------------------------------------------

  function getCarId() {
    if (
      typeof window.getCarId ===
        "function"
    ) {
      return window.getCarId();
    }

    return new URLSearchParams(
      location.search
    ).get("id");
  }

  function nowTime() {
    if (
      typeof window.nowTime ===
        "function"
    ) {
      return window.nowTime();
    }

    return new Date()
      .toISOString();
  }

  function getSearchModule() {
    const module =
      window.JLYCarDetailPlayerSearch;

    if (!module) {
      throw new Error(
        "Player Search 模組尚未載入"
      );
    }

    return module;
  }

  function getEditorModule() {
    const module =
      window.JLYCarDetailPlayerEditor;

    if (!module) {
      throw new Error(
        "Player Editor 模組尚未載入"
      );
    }

    return module;
  }

  async function refreshPage() {
    if (
      typeof window.renderCarDetail ===
        "function"
    ) {
      await window.renderCarDetail();
    }
  }

  function normalizePlayerName(name) {
    return getSearchModule()
      .normalizePlayerName(name);
  }

  function getPlayerDatabaseName(
    player
  ) {
    return getSearchModule()
      .getPlayerDatabaseName(
        player
      );
  }

  // ------------------------------------------------------------
  // 取得車團玩家穩定 ID
  // ------------------------------------------------------------

  function getCarPlayerId(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return String(
      source.playerId ||
      source.id ||
      source.profileId ||
      source.applicationId ||
      ""
    ).trim();
  }

  // ------------------------------------------------------------
  // 取得資料庫玩家 ID
  // ------------------------------------------------------------

  function getDatabasePlayerId(
    player
  ) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return String(
      source.id ||
      source.playerId ||
      ""
    ).trim();
  }

  // ------------------------------------------------------------
  // 取得車團玩家名稱
  // ------------------------------------------------------------

  function getCarPlayerName(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return (
      source.hostAlias ||
      source.displayName ||
      source.playerName ||
      source.name ||
      ""
    );
  }

  // ------------------------------------------------------------
  // 複製 Slots
  // ------------------------------------------------------------

  function cloneSlots(car) {
    const currentCar =
      window.currentCarData &&
      typeof window.currentCarData ===
        "object"
        ? window.currentCarData
        : null;

    const sourceSlots =
      currentCar &&
      Array.isArray(
        currentCar.slots
      )
        ? currentCar.slots
        : (
            car &&
            Array.isArray(car.slots)
              ? car.slots
              : []
          );

    return sourceSlots.map(
      function (slot) {
        return {
          ...slot,

          player:
            slot &&
            slot.player &&
            typeof slot.player ===
              "object"
              ? {
                  ...slot.player
                }
              : null
        };
      }
    );
  }

  // ------------------------------------------------------------
  // 搜尋指定 Seat
  // ------------------------------------------------------------

  function findSeat(
    slots,
    seatId
  ) {
    const targetId =
      String(
        seatId || ""
      ).trim();

    if (!targetId) {
      return null;
    }

    return (
      slots.find(
        function (seat) {
          if (!seat) {
            return false;
          }

          return (
            String(
              seat.id || ""
            ) === targetId ||
            String(
              seat.slotId || ""
            ) === targetId ||
            String(
              seat.order || ""
            ) === targetId
          );
        }
      ) || null
    );
  }

  // ------------------------------------------------------------
  // 判斷 Seat 是否已有玩家
  // ------------------------------------------------------------

  function isSeatOccupied(seat) {
    if (!seat) {
      return false;
    }

    return Boolean(
      seat.playerId ||
      (
        seat.player &&
        typeof seat.player ===
          "object"
      )
    );
  }

  // ------------------------------------------------------------
  // 找出玩家目前所在 Seat
  // ------------------------------------------------------------

  function findPlayerSeat(
    slots,
    player
  ) {
    const playerId =
      getCarPlayerId(
        player
      );

    const playerName =
      normalizePlayerName(
        getCarPlayerName(
          player
        )
      );

    return (
      slots.find(
        function (seat) {
          if (!seat) {
            return false;
          }

          const seatPlayer =
            seat.player &&
            typeof seat.player ===
              "object"
              ? seat.player
              : {};

          const seatPlayerId =
            String(
              seat.playerId ||
              seatPlayer.playerId ||
              seatPlayer.id ||
              ""
            ).trim();

          if (
            playerId &&
            seatPlayerId ===
              playerId
          ) {
            return true;
          }

          if (
            !playerId &&
            playerName
          ) {
            const seatPlayerName =
              normalizePlayerName(
                seatPlayer.hostAlias ||
                seatPlayer.displayName ||
                seatPlayer.playerName ||
                seatPlayer.name ||
                seat.hostAlias ||
                seat.displayName ||
                seat.playerName ||
                ""
              );

            return (
              seatPlayerName ===
              playerName
            );
          }

          return false;
        }
      ) || null
    );
  }

  // ------------------------------------------------------------
  // 找出資料庫玩家是否已在車上
  // ------------------------------------------------------------

  function findExistingCarPlayer(
    players,
    selectedPlayer
  ) {
    const selectedId =
      getDatabasePlayerId(
        selectedPlayer
      );

    const selectedName =
      normalizePlayerName(
        getPlayerDatabaseName(
          selectedPlayer
        )
      );

    return (
      players.find(
        function (player) {
          const carPlayerId =
            getCarPlayerId(
              player
            );

          if (
            selectedId &&
            carPlayerId ===
              selectedId
          ) {
            return true;
          }

          const carPlayerName =
            normalizePlayerName(
              getCarPlayerName(
                player
              )
            );

          return Boolean(
            selectedName &&
            carPlayerName ===
              selectedName
          );
        }
      ) || null
    );
  }

  // ------------------------------------------------------------
  // 彈性席位依玩家位置切換類型
  // ------------------------------------------------------------

  function applyFlexibleSeatType(
    seat,
    player
  ) {
    if (
      !seat ||
      seat.originalType !==
        "flexible"
    ) {
      return;
    }

    const position =
      String(
        player &&
        player.position
          ? player.position
          : ""
      );

    if (
      position === "男位" ||
      position === "male"
    ) {
      seat.type =
        "male";

      return;
    }

    if (
      position === "女位" ||
      position === "female"
    ) {
      seat.type =
        "female";

      return;
    }

    seat.type =
      "flexible";
  }

  // ------------------------------------------------------------
  // 將既有玩家安排進指定 Seat
  // ------------------------------------------------------------

  async function assignExistingPlayerToSeat(
    carRef,
    car,
    existingPlayer,
    seatId
  ) {
    const slots =
      cloneSlots(car);

    const targetSeat =
      findSeat(
        slots,
        seatId
      );

    if (!targetSeat) {
      alert(
        "找不到剛才點擊的空位"
      );

      return false;
    }

    if (
      isSeatOccupied(
        targetSeat
      )
    ) {
      alert(
        "這個位置已經有人了"
      );

      return false;
    }

    const currentSeat =
      findPlayerSeat(
        slots,
        existingPlayer
      );

    if (currentSeat) {
      alert(
        `${getCarPlayerName(
          existingPlayer
        )} 已經在這台車上，而且已有座位`
      );

      return false;
    }

    const playerId =
      getCarPlayerId(
        existingPlayer
      );

    if (!playerId) {
      alert(
        "這位玩家缺少玩家 ID，請重新整理後再試"
      );

      return false;
    }

    targetSeat.playerId =
      playerId;

    targetSeat.player = {
      ...existingPlayer
    };

    targetSeat.updatedAt =
      nowTime();

    applyFlexibleSeatType(
      targetSeat,
      existingPlayer
    );

    await carRef.update({
      slots,

      updatedAt:
        nowTime()
    });

    window.currentAddingSeatId =
      "";

    alert(
      `${getCarPlayerName(
        existingPlayer
      )} 已補入空位`
    );

    await refreshPage();

    return true;
  }

  // ------------------------------------------------------------
  // 選擇或建立玩家
  // ------------------------------------------------------------

  async function choosePlayer(
    playerName
  ) {
    const searchModule =
      getSearchModule();

    const matches =
      await searchModule
        .searchPlayersByName(
          playerName
        );

    const selection =
      searchModule
        .selectPlayerFromMatches(
          matches
        );

    if (
      selection.cancelled
    ) {
      return null;
    }

    if (
      selection.selectedPlayer
    ) {
      return selection
        .selectedPlayer;
    }

    const createGuest =
      confirm(
        matches.length > 0
          ? `確定要建立另一位新的「${playerName}」嗎？`
          : `目前沒有「${playerName}」的資料，是否建立為訪客玩家？`
      );

    if (!createGuest) {
      return null;
    }

    return searchModule
      .createGuestPlayer(
        playerName
      );
  }

  // ------------------------------------------------------------
  // 主揪手動新增玩家
  // ------------------------------------------------------------

  async function addPlayerManually(
    seatId
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

    window.currentAddingSeatId =
      seatId || "";

    const inputName =
      prompt(
        "請輸入玩家名稱：",
        ""
      );

    if (
      !inputName ||
      !inputName.trim()
    ) {
      window.currentAddingSeatId =
        "";

      return;
    }

    const playerName =
      inputName.trim();

    try {
      const selectedPlayer =
        await choosePlayer(
          playerName
        );

      if (!selectedPlayer) {
        window.currentAddingSeatId =
          "";

        return;
      }

      const carRef =
        db
          .collection("cars")
          .doc(carId);

      const carDoc =
        await carRef.get();

      if (!carDoc.exists) {
        alert(
          "找不到這台車"
        );

        return;
      }

      const car =
        carDoc.data() ||
        {};

      const players =
        Array.isArray(
          car.players
        )
          ? [...car.players]
          : [];

      const existingPlayer =
        findExistingCarPlayer(
          players,
          selectedPlayer
        );

      // --------------------------------------------------------
      // 玩家已在車上
      // --------------------------------------------------------

      if (existingPlayer) {
        const addingSeatId =
          window.currentAddingSeatId ||
          "";

        if (!addingSeatId) {
          alert(
            `${getPlayerDatabaseName(
              selectedPlayer
            )} 已經在這台車上`
          );

          return;
        }

        await assignExistingPlayerToSeat(
          carRef,
          car,
          existingPlayer,
          addingSeatId
        );

        return;
      }

      // --------------------------------------------------------
      // 玩家尚未加入車團
      // 交給 Player Editor 輸入本場資料
      // --------------------------------------------------------

      getEditorModule()
        .openPlayerEditor({
          mode:
            "add",

          selectedPlayer,

          seatId:
            seatId || ""
        });
    } catch (error) {
      console.error(
        "addPlayerManually 發生錯誤：",
        error
      );

      alert(
        "新增玩家失敗：" +
        (
          error &&
          error.message
            ? error.message
            : "未知錯誤"
        )
      );

      window.currentAddingSeatId =
        "";
    }
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailPlayerManualAdd = {
    getCarPlayerId,

    getDatabasePlayerId,

    getCarPlayerName,

    cloneSlots,

    findSeat,

    isSeatOccupied,

    findPlayerSeat,

    findExistingCarPlayer,

    applyFlexibleSeatType,

    assignExistingPlayerToSeat,

    choosePlayer,

    addPlayerManually
  };

  console.log(
    "✅ Car Detail Player Manual Add 已載入"
  );
})();
/*
====================================================

JLY Host System V3

Module：
Car Detail Player Manual Add V2

用途：
1. 主揪手動搜尋玩家
2. 選擇既有玩家或建立訪客玩家
3. 將尚未入座的既有玩家補入指定空位
4. 開啟 Player Editor 新增本場玩家
5. 處理彈性席位的男女位轉換
6. 所有操作完成後保留原本位置

規則：
- 玩家搜尋交給 Player Search
- 玩家資料輸入交給 Player Editor
- 玩家移除交給 Player Actions
- 只處理「主揪手動新增」入口
- 不處理玩家自行報名審核
- 不主動將頁面捲到最上方

依賴：
- window.db
- window.JLYCarDetailController
- window.JLYCarDetailPlayerSearch
- window.JLYCarDetailPlayerEditor
- window.renderCarDetail（僅作舊版相容）

====================================================
*/

console.log(
  "player-manual-add.js V2 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // JLY Cloud View Core V1 Phase F
  // Direct Slot Mutation → Car Detail View
  // ============================================================

  let jlyManualAddViewRuntimePromise =
    null;

  async function ensureJLYManualAddViewRuntime() {
    if (
      window.JLYViewRuntimeLoader
    ) {
      return window
        .JLYViewRuntimeLoader
        .ensure();
    }

    if (
      jlyManualAddViewRuntimePromise
    ) {
      return jlyManualAddViewRuntimePromise;
    }

    jlyManualAddViewRuntimePromise =
      new Promise(
        function (
          resolve,
          reject
        ) {
          const script =
            document.createElement(
              "script"
            );

          script.src =
            "/js/data-view/view-runtime-loader.js?v=1";

          script.async =
            true;

          script.onload =
            async function () {
              try {
                if (
                  !window
                    .JLYViewRuntimeLoader
                ) {
                  throw new Error(
                    "View Runtime Loader 未初始化"
                  );
                }

                resolve(
                  await window
                    .JLYViewRuntimeLoader
                    .ensure()
                );
              } catch (error) {
                reject(error);
              }
            };

          script.onerror =
            reject;

          document.head
            .appendChild(
              script
            );
        }
      );

    return jlyManualAddViewRuntimePromise;
  }

  async function syncManualAddSlotsView(
    beforeCar,
    afterCar
  ) {
    try {
      const runtime =
        await ensureJLYManualAddViewRuntime();

      const coordinator =
        runtime &&
        runtime.coordinator;

      if (
        !coordinator ||
        typeof coordinator
          .updateCarViews !==
            "function"
      ) {
        return [];
      }

      return await coordinator
        .updateCarViews({
          beforeCar,
          afterCar,
          changedFields: [
            "slots"
          ]
        });
    } catch (error) {
      console.warn(
        "手動補位 View 同步失敗：",
        error
      );

      return [];
    }
  }



  // ============================================================
  // 共用工具
  // ============================================================

  function getText(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

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

  function getController() {
    return (
      window.JLYCarDetailController ||
      null
    );
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

  // ============================================================
  // 席位 Selector
  // ============================================================

  function escapeCssValue(value) {
    const text =
      getText(value);

    if (!text) {
      return "";
    }

    if (
      window.CSS &&
      typeof window.CSS.escape ===
        "function"
    ) {
      return window.CSS.escape(
        text
      );
    }

    return text.replace(
      /["\\]/g,
      "\\$&"
    );
  }

  function buildSeatSelector(
    seatId
  ) {
    const targetId =
      getText(
        seatId
      );

    if (!targetId) {
      return "";
    }

    const escapedId =
      escapeCssValue(
        targetId
      );

    /*
     * Seat Engine 現行主要使用 data-slot-id。
     * 舊版席位可能使用 data-seat-id 或元素 id，
     * 因此保留多組相容選擇器。
     */
    return [
      `[data-slot-id="${escapedId}"]`,
      `[data-seat-id="${escapedId}"]`,
      `#${escapedId}`
    ].join(",");
  }

  // ============================================================
  // 保存目前操作位置
  // ============================================================

  function captureCurrentPosition(
    seatId,
    sourceElement
  ) {
    const controller =
      getController();

    const anchorSelector =
      buildSeatSelector(
        seatId
      );

    /*
     * 保存給 Player Editor 使用。
     * 新玩家要等編輯器按下儲存後才會重新 Render，
     * 因此把此次操作的席位留在全域暫存。
     */
    window.JLYPendingCarDetailPosition = {
      seatId:
        getText(
          seatId
        ),

      anchorSelector,

      scrollX:
        window.scrollX ||
        window.pageXOffset ||
        0,

      scrollY:
        window.scrollY ||
        window.pageYOffset ||
        0
    };

    if (
      controller &&
      typeof controller
        .captureScrollPosition ===
        "function"
    ) {
      controller
        .captureScrollPosition({
          sourceElement:
            sourceElement || null,

          anchorSelector
        });
    }

    return {
      ...window
        .JLYPendingCarDetailPosition
    };
  }

  function clearPendingPosition() {
    window.JLYPendingCarDetailPosition =
      null;
  }

  // ============================================================
  // 保留原位重新整理
  // ============================================================

  async function refreshPage(
    options
  ) {
    const settings = {
      seatId:
        "",

      anchorSelector:
        "",

      ...(
        options || {}
      )
    };

    const controller =
      getController();

    const anchorSelector =
      getText(
        settings.anchorSelector
      ) ||
      buildSeatSelector(
        settings.seatId
      ) ||
      getText(
        window
          .JLYPendingCarDetailPosition &&
        window
          .JLYPendingCarDetailPosition
          .anchorSelector
      );

    if (
      controller &&
      typeof controller.refreshPage ===
        "function"
    ) {
      return controller
        .refreshPage({
          preservePosition:
            true,

          anchorSelector
        });
    }

    /*
     * 舊版相容：
     * Controller 尚未載入時，至少保存 scrollY。
     */
    const scrollX =
      window.scrollX ||
      window.pageXOffset ||
      0;

    const scrollY =
      window.scrollY ||
      window.pageYOffset ||
      0;

    if (
      typeof window.renderCarDetail ===
        "function"
    ) {
      await window.renderCarDetail();

      await new Promise(
        function (resolve) {
          window.requestAnimationFrame(
            function () {
              window.requestAnimationFrame(
                resolve
              );
            }
          );
        }
      );

      window.scrollTo({
        left:
          scrollX,

        top:
          scrollY,

        behavior:
          "auto"
      });
    }
  }

  function normalizePlayerName(name) {
    return getSearchModule()
      .normalizePlayerName(
        name
      );
  }

  function getPlayerDatabaseName(
    player
  ) {
    return getSearchModule()
      .getPlayerDatabaseName(
        player
      );
  }

  // ============================================================
  // 取得車團玩家穩定 ID
  // ============================================================

  function getCarPlayerId(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return getText(
      source.playerId ||
      source.id ||
      source.profileId ||
      source.applicationId
    );
  }

  // ============================================================
  // 取得資料庫玩家 ID
  // ============================================================

  function getDatabasePlayerId(
    player
  ) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return getText(
      source.id ||
      source.playerId
    );
  }

  // ============================================================
  // 取得車團玩家名稱
  // ============================================================

  function getCarPlayerName(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return getText(
      source.hostAlias ||
      source.displayName ||
      source.playerName ||
      source.name
    );
  }

  // ============================================================
  // 複製 Slots
  // ============================================================

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
            Array.isArray(
              car.slots
            )
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

  // ============================================================
  // 搜尋指定 Seat
  // ============================================================

  function findSeat(
    slots,
    seatId
  ) {
    const targetId =
      getText(
        seatId
      );

    if (!targetId) {
      return null;
    }

    return (
      (
        Array.isArray(slots)
          ? slots
          : []
      ).find(
        function (seat) {
          if (!seat) {
            return false;
          }

          return (
            getText(
              seat.id
            ) === targetId ||
            getText(
              seat.slotId
            ) === targetId ||
            getText(
              seat.order
            ) === targetId
          );
        }
      ) ||
      null
    );
  }

  // ============================================================
  // 判斷 Seat 是否已有玩家
  // ============================================================

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

  // ============================================================
  // 找出玩家目前所在 Seat
  // ============================================================

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
      (
        Array.isArray(slots)
          ? slots
          : []
      ).find(
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
            getText(
              seat.playerId ||
              seatPlayer.playerId ||
              seatPlayer.id
            );

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
      ) ||
      null
    );
  }

  // ============================================================
  // 找出資料庫玩家是否已在車上
  // ============================================================

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
      (
        Array.isArray(players)
          ? players
          : []
      ).find(
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
      ) ||
      null
    );
  }

  // ============================================================
  // 彈性席位依玩家位置切換類型
  // ============================================================

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
      getText(
        player &&
        player.position
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

  // ============================================================
  // 將既有玩家安排進指定 Seat
  // ============================================================

  async function assignExistingPlayerToSeat(
    carRef,
    car,
    existingPlayer,
    seatId
  ) {
    const targetSeatId =
      getText(
        seatId
      );

    const slots =
      cloneSlots(
        car
      );

    const targetSeat =
      findSeat(
        slots,
        targetSeatId
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

    const updatedAt =
      nowTime();

    const beforeCar = {
      id: carId,
      ...car
    };

    const afterCar = {
      id: carId,
      ...car,
      slots,
      updatedAt
    };

    await carRef.update({
      slots,
      updatedAt
    });

    await syncManualAddSlotsView(
      beforeCar,
      afterCar
    );

    /*
     * 先更新本地資料，讓重新 Render 時立即使用新 Slots。
     */
    if (
      window.currentCarData &&
      typeof window.currentCarData ===
        "object"
    ) {
      window.currentCarData.slots =
        slots;
    }

    window.currentAddingSeatId =
      "";

    alert(
      `${getCarPlayerName(
        existingPlayer
      )} 已補入空位`
    );

    await refreshPage({
      seatId:
        targetSeatId
    });

    clearPendingPosition();

    return true;
  }

  // ============================================================
  // 選擇或建立玩家
  // ============================================================

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

  // ============================================================
  // 主揪手動新增玩家
  // ============================================================

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

    const targetSeatId =
      getText(
        seatId
      );

    /*
     * prompt 出現之前就記住目前位置。
     * 避免 prompt 關閉後 activeElement 改變，
     * 導致抓不到原本點擊的席位。
     */
    captureCurrentPosition(
      targetSeatId,
      document.activeElement
    );

    window.currentAddingSeatId =
      targetSeatId;

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

      clearPendingPosition();

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

        clearPendingPosition();

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

        window.currentAddingSeatId =
          "";

        clearPendingPosition();

        return;
      }

      const car =
        carDoc.data() ||
        {};

      car.id =
        carDoc.id ||
        carId;

      const players =
        Array.isArray(
          car.players
        )
          ? [
              ...car.players
            ]
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
          getText(
            window.currentAddingSeatId
          );

        if (!addingSeatId) {
          alert(
            `${getPlayerDatabaseName(
              selectedPlayer
            )} 已經在這台車上`
          );

          clearPendingPosition();

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
            targetSeatId,

          /*
           * Player Editor 下一步可直接讀取，
           * 儲存後精準回到原本席位。
           */
          returnPosition: {
            seatId:
              targetSeatId,

            anchorSelector:
              buildSeatSelector(
                targetSeatId
              ),

            scrollX:
              window.scrollX ||
              window.pageXOffset ||
              0,

            scrollY:
              window.scrollY ||
              window.pageYOffset ||
              0
          }
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

      clearPendingPosition();
    }
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYCarDetailPlayerManualAdd = {
    getText,

    getCarId,

    nowTime,

    getController,

    getSearchModule,

    getEditorModule,

    escapeCssValue,

    buildSeatSelector,

    captureCurrentPosition,

    clearPendingPosition,

    refreshPage,

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
    "✅ Car Detail Player Manual Add V2 已載入"
  );
})();
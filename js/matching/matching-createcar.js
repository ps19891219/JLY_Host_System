(function () {
  "use strict";

  let selectedSlotId = "";
  let isCreatingCar = false;

  function nowTime() {
    return new Date()
      .toISOString();
  }

  function escapeHtml(value) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createPlayerId(
    responseId,
    index
  ) {
    const cleanId =
      String(responseId || "")
        .trim();

    if (cleanId) {
      return (
        "matching-player-" +
        cleanId
      );
    }

    return (
      "matching-player-" +
      Date.now() +
      "-" +
      (index + 1)
    );
  }

  function parseDateKey(dateKey) {
    const parts =
      String(dateKey || "")
        .split("-")
        .map(Number);

    if (
      parts.length !== 3 ||
      parts.some(Number.isNaN)
    ) {
      return null;
    }

    return new Date(
      parts[0],
      parts[1] - 1,
      parts[2]
    );
  }

  function formatDate(dateKey) {
    const date =
      parseDateKey(dateKey);

    if (!date) {
      return dateKey;
    }

    const weekdays = [
      "日",
      "一",
      "二",
      "三",
      "四",
      "五",
      "六"
    ];

    return (
      date.getFullYear() +
      "/" +
      String(
        date.getMonth() + 1
      ).padStart(2, "0") +
      "/" +
      String(
        date.getDate()
      ).padStart(2, "0") +
      "（" +
      weekdays[
        date.getDay()
      ] +
      "）"
    );
  }

  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    return window.db;
  }

  function getSourceCar() {
    return (
      window.currentMatchingCar ||
      null
    );
  }

  function getMatching() {
    const car =
      getSourceCar();

    if (
      !car ||
      !car.matching ||
      typeof car.matching !==
        "object"
    ) {
      return null;
    }

    return car.matching;
  }

  function getEnabledSlots(
    matching
  ) {
    return (
      Array.isArray(
        matching &&
        matching.candidateSlots
      )
        ? matching.candidateSlots
        : []
    ).filter(
      function (slot) {
        return (
          slot &&
          slot.enabled !== false &&
          slot.id &&
          slot.date &&
          slot.time
        );
      }
    );
  }

  function getResponses(
    matching
  ) {
    const responseMap =
      matching &&
      matching.responses &&
      typeof matching.responses ===
        "object"
        ? matching.responses
        : {};

    return Object
      .values(responseMap)
      .filter(
        function (response) {
          return (
            response &&
            response.status !==
              "deleted"
          );
        }
      );
  }

  function findSlot(
    matching,
    slotId
  ) {
    return (
      getEnabledSlots(
        matching
      ).find(
        function (slot) {
          return (
            String(slot.id) ===
            String(slotId)
          );
        }
      ) ||
      null
    );
  }

  function getAvailableResponses(
    matching,
    slotId
  ) {
    return getResponses(
      matching
    ).filter(
      function (response) {
        return (
          Array.isArray(
            response.slotIds
          ) &&
          response.slotIds.includes(
            slotId
          )
        );
      }
    );
  }

  function clearSelectedRows() {
    document
      .querySelectorAll(
        ".matching-matrix-row.is-selected"
      )
      .forEach(
        function (row) {
          row.classList.remove(
            "is-selected"
          );
        }
      );
  }

  function highlightSelectedRows(
    slotId
  ) {
    clearSelectedRows();

    document
      .querySelectorAll(
        ".matching-matrix-row"
      )
      .forEach(
        function (row) {
          if (
            String(
              row.dataset.slotId ||
              ""
            ) ===
            String(slotId)
          ) {
            row.classList.add(
              "is-selected"
            );
          }
        }
      );
  }

  function setCreateButtonBusy(
    isBusy
  ) {
    const button =
      document.getElementById(
        "matchingCreateFormalCarButton"
      );

    if (!button) {
      return;
    }

    button.disabled =
      isBusy;

    button.textContent =
   isBusy
     ? "確認中…"
     : "確定此時間並開團";
  }

  function renderSelectedSlotCard() {
    const container =
      document.getElementById(
        "matchingCreateCarContainer"
      );

    if (!container) {
      return;
    }

    const matching =
      getMatching();

    if (
      !matching ||
      !selectedSlotId
    ) {
      container.hidden =
        true;

      container.innerHTML =
        "";

      return;
    }

    const slot =
      findSlot(
        matching,
        selectedSlotId
      );

    if (!slot) {
      cancelMatchingSlotSelection();
      return;
    }

    const availableResponses =
      getAvailableResponses(
        matching,
        selectedSlotId
      );

    container.hidden =
      false;

    container.innerHTML = `
      <section class="matching-create-car-card">

        <div class="matching-create-car-heading">

          <div>
            <div class="matching-create-car-label">
              已選擇候選時間
            </div>

            <h3>
              ${escapeHtml(
                formatDate(
                  slot.date
                )
              )}
            </h3>
          </div>

          <button
            type="button"
            class="matching-create-car-cancel"
            onclick="cancelMatchingSlotSelection()"
          >
            取消
          </button>

        </div>

        <div class="matching-create-car-time">

          <span>
            ${escapeHtml(
              slot.icon ||
              "🕒"
            )}
          </span>

          <div>
            <strong>
              ${escapeHtml(
                slot.label ||
                "時段"
              )}
            </strong>

            <small>
              ${escapeHtml(
                slot.time
              )}
            </small>
          </div>

        </div>

        <div class="matching-create-car-player-section">

          <div class="matching-create-car-player-title">
            可參加回覆者

            <strong>
              ${availableResponses.length} 人
            </strong>
          </div>

          ${
            availableResponses.length > 0
              ? `
                <div class="matching-create-car-player-list">

                  ${
                    availableResponses
                      .map(
                        function (
                          response,
                          index
                        ) {
                          const name =
                            response.name ||
                            (
                              "回覆者 " +
                              (index + 1)
                            );

                          return `
                            <label class="matching-create-car-player">

                              <input
                                type="checkbox"
                                class="matching-create-player-checkbox"
                                value="${escapeHtml(
                                  response.id ||
                                  ""
                                )}"
                                data-player-name="${escapeHtml(
                                  name
                                )}"
                                checked
                              >

                              <span>
                                ${escapeHtml(
                                  name
                                )}
                              </span>

                            </label>
                          `;
                        }
                      )
                      .join("")
                  }

                </div>
              `
              : `
                <div class="matching-create-car-empty">
                  目前沒有人勾選這個時段。
                </div>
              `
          }

        </div>

        <button
          type="button"
          id="matchingCreateFormalCarButton"
          class="matching-primary-button matching-create-car-next"
          onclick="createFormalCarFromMatching()"
          ${
            availableResponses.length ===
            0
              ? "disabled"
              : ""
          }
        >
          確定此時間並開團
        </button>

      </section>
    `;

    container.scrollIntoView({
      behavior:
        "smooth",

      block:
        "nearest"
    });
  }

  function selectMatchingSlot(
    slotId
  ) {
    const matching =
      getMatching();

    if (
      !matching ||
      !findSlot(
        matching,
        slotId
      )
    ) {
      return;
    }

    selectedSlotId =
      slotId;

    highlightSelectedRows(
      slotId
    );

    renderSelectedSlotCard();
  }

  function cancelMatchingSlotSelection() {
    selectedSlotId =
      "";

    clearSelectedRows();
    renderSelectedSlotCard();
  }

  function getSelectedMatchingCarDraft() {
    const matching =
      getMatching();

    const sourceCar =
      getSourceCar();

    if (
      !matching ||
      !sourceCar ||
      !selectedSlotId
    ) {
      return null;
    }

    const slot =
      findSlot(
        matching,
        selectedSlotId
      );

    if (!slot) {
      return null;
    }

    const checkedInputs =
      Array.from(
        document.querySelectorAll(
          ".matching-create-player-checkbox:checked"
        )
      );

    const players =
      checkedInputs.map(
        function (
          input,
          index
        ) {
          const playerName =
            String(
              input.dataset
                .playerName ||
              ""
            ).trim();

          const responseId =
            String(
              input.value ||
              ""
            ).trim();

          const playerId =
            createPlayerId(
              responseId,
              index
            );

          return {
            id:
              playerId,

            playerId,

            responseId,

            playerName,

            displayName:
              playerName,

            name:
              playerName,

            hostAlias:
              playerName,

            hostNote:
              "",

            position:
              "不限",

            roleChoice:
              "",

            isCrossPlay:
              false,

            status:
              "已加入",

            source:
              "matching",

            joinedAt:
              nowTime(),

            createdAt:
              nowTime(),

            updatedAt:
              nowTime(),

            order:
              index + 1
          };
        }
      );

    return {
      sourceCarId:
        sourceCar.id ||
        "",

      scriptName:
        sourceCar.scriptName ||
        sourceCar.activityName ||
        "未命名劇本",

      gameDate:
        slot.date,

      gameTime:
        slot.time,

      slotId:
        slot.id,

      slotLabel:
        slot.label ||
        "",

      players
    };
  }

  function getSeatConfiguration(
    sourceCar,
    playerCount
  ) {
    const sourceMode =
      sourceCar.peopleMode ===
        "total"
        ? "total"
        : "gender";

    let maleSlots =
      Math.max(
        0,
        Number(
          sourceCar.maleSlots ||
          0
        )
      );

    let femaleSlots =
      Math.max(
        0,
        Number(
          sourceCar.femaleSlots ||
          0
        )
      );

    let flexibleSlots =
      Math.max(
        0,
        Number(
          sourceCar.flexibleSlots ||
          sourceCar.flexSlots ||
          0
        )
      );

    let totalPeople =
      Math.max(
        0,
        Number(
          sourceCar.totalPeople ||
          sourceCar.capacity ||
          0
        )
      );

    if (
      sourceMode === "total"
    ) {
      totalPeople =
        Math.max(
          totalPeople,
          playerCount,
          1
        );

      maleSlots = 0;
      femaleSlots = 0;
      flexibleSlots =
        totalPeople;
    } else {
      const configuredTotal =
        maleSlots +
        femaleSlots +
        flexibleSlots;

      if (
        configuredTotal <
        playerCount
      ) {
        flexibleSlots +=
          playerCount -
          configuredTotal;
      }

      totalPeople =
        maleSlots +
        femaleSlots +
        flexibleSlots;

      if (
        totalPeople <= 0
      ) {
        flexibleSlots =
          Math.max(
            playerCount,
            1
          );

        totalPeople =
          flexibleSlots;
      }
    }

    return {
      peopleMode:
        sourceMode,

      maleSlots,

      femaleSlots,

      flexibleSlots,

      totalPeople
    };
  }

    function normalizeMatchingSeatType(
    value
  ) {
    const text =
      String(value || "")
        .trim()
        .toLowerCase();

    if (
      text === "male" ||
      text === "男" ||
      text === "男位"
    ) {
      return "male";
    }

    if (
      text === "female" ||
      text === "女" ||
      text === "女位"
    ) {
      return "female";
    }

    return "flexible";
  }

  function buildMatchingSlotsFallback(
    car
  ) {
    const maleSlots =
      Math.max(
        0,
        Number(
          car.maleSlots || 0
        )
      );

    const femaleSlots =
      Math.max(
        0,
        Number(
          car.femaleSlots || 0
        )
      );

    let flexibleSlots =
      Math.max(
        0,
        Number(
          car.flexibleSlots ||
          car.flexSlots ||
          0
        )
      );

    const totalPeople =
      Math.max(
        0,
        Number(
          car.totalPeople ||
          car.capacity ||
          0
        )
      );

    const configuredTotal =
      maleSlots +
      femaleSlots +
      flexibleSlots;

    if (
      totalPeople >
      configuredTotal
    ) {
      flexibleSlots +=
        totalPeople -
        configuredTotal;
    }

    const slots = [];
    const createdAt =
      nowTime();

    let order = 1;

    function addSlots(
      count,
      type
    ) {
      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        const slotId =
          "slot-" +
          order;

        slots.push({
          id:
            slotId,

          slotId,

          order,

          originalType:
            type,

          type,

          playerId:
            null,

          player:
            null,

          createdAt,

          updatedAt:
            createdAt
        });

        order += 1;
      }
    }

    addSlots(
      maleSlots,
      "male"
    );

    addSlots(
      femaleSlots,
      "female"
    );

    addSlots(
      flexibleSlots,
      "flexible"
    );

    return slots;
  }

  function buildMatchingSlots(
    car
  ) {
    /*
      第一順位：
      Seat Engine V2 Data 模組。
    */
    if (
      window.JLYSeatData &&
      typeof window
        .JLYSeatData
        .buildSlots ===
        "function"
    ) {
      try {
        const slots =
          window
            .JLYSeatData
            .buildSlots(
              car
            );

        if (
          Array.isArray(slots) &&
          slots.length > 0
        ) {
          return slots;
        }
      } catch (error) {
        console.warn(
          "JLYSeatData 建立席位失敗，改用安全流程：",
          error
        );
      }
    }

    /*
      第二順位：
      舊相容橋接函式。
    */
    if (
      typeof window.buildSlots ===
        "function"
    ) {
      try {
        const slots =
          window.buildSlots(
            car
          );

        if (
          Array.isArray(slots) &&
          slots.length > 0
        ) {
          return slots;
        }
      } catch (error) {
        console.warn(
          "window.buildSlots 建立失敗，改用安全流程：",
          error
        );
      }
    }

    /*
      最後保底：
      直接建立 Seat Engine V2 相容格式。
    */
    return buildMatchingSlotsFallback(
      car
    );
  }

  function syncMatchingPlayersFallback(
    slots,
    players
  ) {
    const nextSlots =
      Array.isArray(slots)
        ? slots.map(
            function (slot) {
              return {
                ...slot,

                playerId:
                  slot.playerId ||
                  null,

                player:
                  slot.player ||
                  null
              };
            }
          )
        : [];

    const assignedPlayers = [];
    const remainingPlayers = [];

    function findEmptySlot(
      position
    ) {
      const type =
        normalizeMatchingSeatType(
          position
        );

      if (
        type === "male" ||
        type === "female"
      ) {
        const matchingSlot =
          nextSlots.find(
            function (slot) {
              return (
                !slot.playerId &&
                slot.originalType ===
                  type
              );
            }
          );

        if (matchingSlot) {
          return matchingSlot;
        }
      }

      const flexibleSlot =
        nextSlots.find(
          function (slot) {
            return (
              !slot.playerId &&
              slot.originalType ===
                "flexible"
            );
          }
        );

      if (flexibleSlot) {
        return flexibleSlot;
      }

      return (
        nextSlots.find(
          function (slot) {
            return !slot.playerId;
          }
        ) ||
        null
      );
    }

    (
      Array.isArray(players)
        ? players
        : []
    ).forEach(
      function (player) {
        const targetSlot =
          findEmptySlot(
            player.position
          );

        if (!targetSlot) {
          remainingPlayers.push(
            player
          );

          return;
        }

        targetSlot.playerId =
          player.playerId;

        targetSlot.player = {
          id:
            player.playerId,

          name:
            player.hostAlias ||
            player.displayName ||
            player.playerName ||
            player.name ||
            "未命名玩家"
        };

        if (
          targetSlot.originalType ===
            "flexible"
        ) {
          targetSlot.type =
            normalizeMatchingSeatType(
              player.position
            );
        } else {
          targetSlot.type =
            targetSlot.originalType;
        }

        targetSlot.updatedAt =
          nowTime();

        assignedPlayers.push({
          player,

          playerId:
            player.playerId,

          slotId:
            targetSlot.slotId
        });
      }
    );

    return {
      success:
        true,

      slots:
        nextSlots,

      assignedPlayers,

      importedPlayers:
        assignedPlayers.map(
          function (item) {
            return item.player;
          }
        ),

      waitingPlayers:
        remainingPlayers,

      remainingPlayers,

      needsSelection:
        remainingPlayers.length > 0
    };
  }

  function syncMatchingPlayersToSeats(
    car
  ) {
    /*
      第一順位：
      正式 Seat Engine V2。
    */
    if (
      window.JLYSeatAssignment &&
      typeof window
        .JLYSeatAssignment
        .syncPlayersToSeats ===
        "function"
    ) {
      const attempts = [
        function () {
          return window
            .JLYSeatAssignment
            .syncPlayersToSeats(
              car.slots,
              car.players,
              {
                car
              }
            );
        },

        function () {
          return window
            .JLYSeatAssignment
            .syncPlayersToSeats({
              slots:
                car.slots,

              players:
                car.players,

              car
            });
        }
      ];

      for (
        let index = 0;
        index < attempts.length;
        index += 1
      ) {
        try {
          const result =
            attempts[index]();

          if (
            result &&
            Array.isArray(
              result.slots
            )
          ) {
            return result;
          }
        } catch (error) {
          console.warn(
            "Seat Assignment 介面無法使用：",
            error
          );
        }
      }
    }

    /*
      第二順位：
      Seat Bridge。
    */
    if (
      window.JLYSeatBridge &&
      typeof window
        .JLYSeatBridge
        .runSeatSyncEngine ===
        "function"
    ) {
      try {
        const result =
          window
            .JLYSeatBridge
            .runSeatSyncEngine(
              car.slots,
              car.players,
              car
            );

        if (
          result &&
          Array.isArray(
            result.slots
          )
        ) {
          return result;
        }
      } catch (error) {
        console.warn(
          "Seat Bridge 同步失敗，改用安全流程：",
          error
        );
      }
    }

    return syncMatchingPlayersFallback(
      car.slots,
      car.players
    );
  }

  function buildDefaultCalendarData() {
    return {
      provider:
        "google",

      syncEnabled:
        false,

      calendarId:
        "primary",

      eventId:
        "",

      eventUrl:
        "",

      eventDurationMinutes:
        60,

      syncStatus:
        "not_synced",

      lastSyncAt:
        "",

      lastError:
        ""
    };
  }

  function buildFormalCar(
    draft,
    sourceCar
  ) {
    const now =
      nowTime();

    const seatConfig =
      getSeatConfiguration(
        sourceCar,
        draft.players.length
      );

    const car = {
      activityType:
        sourceCar.activityType ||
        "劇本",

      activityName:
        draft.scriptName,

      scriptName:
        draft.scriptName,

      gameDate:
        draft.gameDate,

      gameTime:
        draft.gameTime,

      location:
        sourceCar.location ||
        sourceCar.locationName ||
        "",

      locationName:
        sourceCar.locationName ||
        sourceCar.location ||
        "",

      organizer:
        sourceCar.organizer ||
        sourceCar.organizerName ||
        sourceCar.studioName ||
        "",

      organizerName:
        sourceCar.organizerName ||
        sourceCar.organizer ||
        sourceCar.studioName ||
        "",

      studioName:
        sourceCar.studioName ||
        sourceCar.organizerName ||
        sourceCar.organizer ||
        "",

      dmName:
        sourceCar.dmName ||
        "",

      dmList:
        Array.isArray(
          sourceCar.dmList
        )
          ? sourceCar.dmList
          : [],

      price:
        sourceCar.price == null
          ? null
          : Number(
              sourceCar.price
            ),

      note:
        sourceCar.note ||
        "",

      peopleMode:
        seatConfig.peopleMode,

      maleSlots:
        seatConfig.maleSlots,

      femaleSlots:
        seatConfig.femaleSlots,

      flexibleSlots:
        seatConfig.flexibleSlots,

      totalPeople:
        seatConfig.totalPeople,

      capacity:
        seatConfig.totalPeople,

      slots: [],

      showFlexibleSlotSource:
        false,

      dataVersion: 1,

      seatSystemVersion: 2,

      schemaVersion: 2,

      myRole:
        "host",

      isHost:
        true,

      isPlayer:
        false,

      isFavoriteCar:
        false,

      visibility:
        sourceCar.visibility ||
        "private",

      guestListVisibility:
        sourceCar
          .guestListVisibility ||
        "approved_only",

      players:
        draft.players,

      applications: [],

      staffSlots:
        Array.isArray(
          sourceCar.staffSlots
        )
          ? sourceCar.staffSlots
          : [],

      history: [
        {
          type:
            "建立車團",

          text:
            "由時間媒合建立正式車團",

          time:
            now
        },
        {
          type:
            "媒合匯入玩家",

          text:
            "由媒合結果加入 " +
            draft.players.length +
            " 位玩家",

          time:
            now
        }
      ],

      conflictStatus:
        "none",

      conflictWithCarIds:
        [],

      conflictNote:
        "",

      calendar:
        buildDefaultCalendarData(),

      calendarStatus:
        "not_added",

      calendarEventId:
        null,

      status:
        "招募中",

      planningStatus:
        "scheduled",

      source:
        "matching",

      sourceMatchingCarId:
        draft.sourceCarId,

      sourceMatchingSlotId:
        draft.slotId,

      sourceMatchingSlotLabel:
        draft.slotLabel,

      createdAt:
        now,

      updatedAt:
        now
    };

        car.slots =
      buildMatchingSlots(
        car
      );

    if (
      !Array.isArray(
        car.slots
      ) ||
      car.slots.length === 0
    ) {
      throw new Error(
        "無法建立正式車團席位"
      );
    }

    const syncResult =
      syncMatchingPlayersToSeats(
        car
      );

    if (
      !syncResult ||
      !Array.isArray(
        syncResult.slots
      )
    ) {
      throw new Error(
        "Seat Engine 沒有回傳有效席位資料"
      );
    }

    car.slots =
      syncResult.slots;

    const remainingPlayers =
      Array.isArray(
        syncResult.remainingPlayers
      )
        ? syncResult
            .remainingPlayers
        : (
            Array.isArray(
              syncResult.waitingPlayers
            )
              ? syncResult
                  .waitingPlayers
              : []
          );

    const assignedPlayers =
      Array.isArray(
        syncResult.assignedPlayers
      )
        ? syncResult
            .assignedPlayers
        : (
            Array.isArray(
              syncResult.importedPlayers
            )
              ? syncResult
                  .importedPlayers
              : []
          );

    car.waitingPlayers =
      remainingPlayers;

    car.seatSyncResult = {
      assignedCount:
        assignedPlayers.length,

      waitingCount:
        remainingPlayers.length,

      needsSelection:
        remainingPlayers.length >
        0,

      syncedAt:
        now
    };

    return car;
  }

    function normalizeMatchingName(
    value
  ) {
    return String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function getFormalPlayerName(
    player
  ) {
    return String(
      player.hostAlias ||
      player.displayName ||
      player.playerName ||
      player.name ||
      ""
    ).trim();
  }

  function findResponseForPlayer(
    player,
    responses
  ) {
    const playerId =
      String(
        player.playerId ||
        player.id ||
        ""
      ).trim();

    /*
      未來會員正式綁定後，
      優先使用 playerId / memberId。
    */
    if (playerId) {
      const byId =
        responses.find(
          function (response) {
            const responsePlayerId =
              String(
                response.playerId ||
                response.memberId ||
                response.userId ||
                ""
              ).trim();

            return (
              responsePlayerId &&
              responsePlayerId ===
                playerId
            );
          }
        );

      if (byId) {
        return byId;
      }
    }

    /*
      現階段舊媒合資料可能還沒有會員 ID，
      暫時以顯示名稱相容。
    */
    const playerName =
      normalizeMatchingName(
        getFormalPlayerName(
          player
        )
      );

    if (!playerName) {
      return null;
    }

    return (
      responses.find(
        function (response) {
          const responseName =
            normalizeMatchingName(
              response.name ||
              response.playerName ||
              response.displayName ||
              ""
            );

          return (
            responseName ===
            playerName
          );
        }
      ) ||
      null
    );
  }

  function buildMatchingConfirmation(
    sourceCar,
    matching,
    selectedSlotId
  ) {
    const players =
      Array.isArray(
        sourceCar.players
      )
        ? sourceCar.players
        : [];

    const responses =
      getResponses(
        matching
      );

    const confirmationPlayers =
      players.map(
        function (player) {
          const response =
            findResponseForPlayer(
              player,
              responses
            );

          let availability =
            "no_response";

          if (response) {
            const selected =
              Array.isArray(
                response.slotIds
              ) &&
              response.slotIds.includes(
                selectedSlotId
              );

            availability =
              selected
                ? "available"
                : "unavailable";
          }

          return {
            playerId:
              player.playerId ||
              player.id ||
              "",

            playerName:
              getFormalPlayerName(
                player
              ),

            availability,

            resolved:
              availability ===
              "available",

            action:
              availability ===
              "available"
                ? "keep"
                : "",

            responseId:
              response
                ? (
                    response.id ||
                    ""
                  )
                : ""
          };
        }
      );

    const pendingPlayers =
      confirmationPlayers.filter(
        function (item) {
          return (
            item.availability !==
            "available"
          );
        }
      );

    return {
      status:
        pendingPlayers.length > 0
          ? "pending"
          : "completed",

      selectedSlotId,

      createdAt:
        nowTime(),

      completedAt:
        pendingPlayers.length === 0
          ? nowTime()
          : "",

      players:
        confirmationPlayers,

      pendingCount:
        pendingPlayers.length
    };
  }

  async function findSameDayCars(
    gameDate,
    sourceCarId
  ) {
    const snapshot =
      await getDb()
        .collection("cars")
        .where(
          "gameDate",
          "==",
          gameDate
        )
        .get();

    return snapshot.docs
      .map(
        function (doc) {
          return {
            id:
              doc.id,

            ...doc.data()
          };
        }
      )
      .filter(
        function (car) {
          return (
            car.id !==
              sourceCarId &&
            car.status !==
              "已取消" &&
            car.status !==
              "取消"
          );
        }
      );
  }

  function buildConflictMessage(
    sameDayCars
  ) {
    const lines = [
      "⚠️ 這一天已有其他車團：",
      ""
    ];

    sameDayCars.forEach(
      function (car) {
        lines.push(
          "🎭 " +
          (
            car.scriptName ||
            "未命名劇本"
          ) +
          "｜" +
          (
            car.gameTime ||
            "時間未填"
          )
        );
      }
    );

    lines.push(
      "",
      "仍要建立這台正式車團嗎？"
    );

    return lines.join("\n");
  }

    async function createFormalCarFromMatching() {
    if (isCreatingCar) {
      return;
    }

    const draft =
      getSelectedMatchingCarDraft();

    const sourceCar =
      getSourceCar();

    const matching =
      getMatching();

    if (
      !draft ||
      !sourceCar ||
      !matching
    ) {
      alert(
        "找不到已選擇的媒合資料。"
      );

      return;
    }

    const originalPlayers =
      Array.isArray(
        sourceCar.players
      )
        ? sourceCar.players
        : [];

    const confirmation =
      buildMatchingConfirmation(
        sourceCar,
        matching,
        draft.slotId
      );

    const pendingCount =
      Number(
        confirmation.pendingCount ||
        0
      );

    let confirmText =
      "確定使用這個時間開團嗎？\n\n" +
      formatDate(
        draft.gameDate
      ) +
      "\n" +
      draft.gameTime +
      "\n\n" +
      "原車玩家：" +
      originalPlayers.length +
      " 人";

    if (
      pendingCount > 0
    ) {
      confirmText +=
        "\n\n⚠️ 有 " +
        pendingCount +
        " 位玩家需要確認時間。";
    } else {
      confirmText +=
        "\n\n✓ 原車玩家皆可參加此時段。";
    }

    const confirmed =
      confirm(
        confirmText
      );

    if (!confirmed) {
      return;
    }

    isCreatingCar =
      true;

    setCreateButtonBusy(
      true
    );

    try {
      const sameDayCars =
        await findSameDayCars(
          draft.gameDate,
          draft.sourceCarId
        );

      if (
        sameDayCars.length > 0
      ) {
        const keepGoing =
          confirm(
            buildConflictMessage(
              sameDayCars
            )
          );

        if (!keepGoing) {
          return;
        }
      }

      const db =
        getDb();

      const sourceCarRef =
        db
          .collection("cars")
          .doc(
            draft.sourceCarId
          );

      const completedAt =
        nowTime();

      const sourceHistory =
        Array.isArray(
          sourceCar.history
        )
          ? [
              ...sourceCar.history
            ]
          : [];

      sourceHistory.push({
        type:
          "媒合選定時間",

        text:
          "媒合完成，選定 " +
          draft.gameDate +
          " " +
          draft.gameTime +
          "，原車轉為招募中",

        time:
          completedAt
      });

      if (
        pendingCount > 0
      ) {
        sourceHistory.push({
          type:
            "媒合待確認",

          text:
            "選定時間後有 " +
            pendingCount +
            " 位玩家需要確認",

          time:
            completedAt
        });
      }

      const updateData = {
        gameDate:
          draft.gameDate,

        gameTime:
          draft.gameTime,

        status:
          "招募中",

        planningStatus:
          "scheduled",

        conflictStatus:
          sameDayCars.length > 0
            ? "pending"
            : "none",

        conflictWithCarIds:
          sameDayCars.map(
            function (car) {
              return car.id;
            }
          ),

        "matching.status":
          "completed",

        "matching.currentStep":
          4,

        "matching.selectedSlotId":
          draft.slotId,

        "matching.selectedDate":
          draft.gameDate,

        "matching.selectedTime":
          draft.gameTime,

        "matching.completedAt":
          completedAt,

        "matching.updatedAt":
          completedAt,

        matchingConfirmation:
          confirmation,

        history:
          sourceHistory,

        updatedAt:
          completedAt
      };

      /*
        注意：
        不更新 players。
        不更新 slots。
        不更新 DM。
        不更新工作室。
        不建立第二台 Car。

        原車所有正式資料完整保留。
      */

      await sourceCarRef.update(
        updateData
      );

      location.href =
        "/pages/car-detail.html?id=" +
        encodeURIComponent(
          draft.sourceCarId
        );
    } catch (error) {
      console.error(
        "媒合確認開團失敗：",
        error
      );

      alert(
        "確認失敗：" +
        (
          error &&
          error.message
            ? error.message
            : "未知錯誤"
        )
      );
    } finally {
      isCreatingCar =
        false;

      setCreateButtonBusy(
        false
      );
    }
  }

  function refreshSelection() {
    if (!selectedSlotId) {
      return;
    }

    const matching =
      getMatching();

    if (
      !matching ||
      !findSlot(
        matching,
        selectedSlotId
      )
    ) {
      cancelMatchingSlotSelection();
      return;
    }

    highlightSelectedRows(
      selectedSlotId
    );

    renderSelectedSlotCard();
  }

  window.selectMatchingSlot =
    selectMatchingSlot;

  window.cancelMatchingSlotSelection =
    cancelMatchingSlotSelection;

  window.createFormalCarFromMatching =
    createFormalCarFromMatching;

  window.JLYMatchingCreateCar = {
    refresh:
      refreshSelection,

    getDraft:
      getSelectedMatchingCarDraft,

    create:
      createFormalCarFromMatching
  };

  console.log(
    "✅ Matching Create Car V2 已載入"
  );
})();
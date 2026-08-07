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
        ? "建立中…"
        : "建立正式車團";
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
          建立正式車團
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

    if (
      typeof window.buildSlots !==
        "function"
    ) {
      throw new Error(
        "Seat Engine 尚未載入"
      );
    }

    car.slots =
      window.buildSlots(
        car
      );

    if (
      window.JLYSeatBridge &&
      typeof window
        .JLYSeatBridge
        .runSeatSyncEngine ===
        "function"
    ) {
      const syncResult =
        window
          .JLYSeatBridge
          .runSeatSyncEngine(
            car.slots,
            car.players,
            car
          );

      if (
        syncResult &&
        Array.isArray(
          syncResult.slots
        )
      ) {
        car.slots =
          syncResult.slots;

        car.waitingPlayers =
          Array.isArray(
            syncResult.remainingPlayers
          )
            ? syncResult
                .remainingPlayers
            : [];

        car.seatSyncResult = {
          assignedCount:
            Array.isArray(
              syncResult.assignedPlayers
            )
              ? syncResult
                  .assignedPlayers
                  .length
              : 0,

          waitingCount:
            Array.isArray(
              syncResult.remainingPlayers
            )
              ? syncResult
                  .remainingPlayers
                  .length
              : 0,

          syncedAt:
            now
        };
      }
    }

    return car;
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

    if (
      !draft ||
      !sourceCar
    ) {
      alert(
        "找不到已選擇的媒合資料。"
      );

      return;
    }

    if (
      draft.players.length === 0
    ) {
      alert(
        "請至少保留一位玩家。"
      );

      return;
    }

    const confirmed =
      confirm(
        "確定建立正式車團嗎？\n\n" +
        formatDate(
          draft.gameDate
        ) +
        "\n" +
        draft.gameTime +
        "\n\n加入玩家：" +
        draft.players.length +
        " 人"
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

      const formalCar =
        buildFormalCar(
          draft,
          sourceCar
        );

      formalCar.conflictStatus =
        sameDayCars.length > 0
          ? "pending"
          : "none";

      formalCar.conflictWithCarIds =
        sameDayCars.map(
          function (car) {
            return car.id;
          }
        );

      const db =
        getDb();

      const newCarRef =
        db
          .collection("cars")
          .doc();

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
          "媒合完成",

        text:
          "已建立正式車團：" +
          draft.gameDate +
          " " +
          draft.gameTime,

        formalCarId:
          newCarRef.id,

        time:
          completedAt
      });

      const batch =
        db.batch();

      batch.set(
        newCarRef,
        formalCar
      );

      batch.update(
        sourceCarRef,
        {
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

          "matching.formalCarId":
            newCarRef.id,

          "matching.completedAt":
            completedAt,

          "matching.updatedAt":
            completedAt,

          history:
            sourceHistory,

          updatedAt:
            completedAt
        }
      );

      await batch.commit();

      location.href =
        "/pages/car-detail.html?id=" +
        encodeURIComponent(
          newCarRef.id
        );
    } catch (error) {
      console.error(
        "媒合建立正式車團失敗：",
        error
      );

      alert(
        "建立失敗：" +
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
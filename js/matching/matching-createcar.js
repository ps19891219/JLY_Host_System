(function () {
  "use strict";

  let selectedSlotId = "";

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

  function getMatching() {
    const car =
      window.currentMatchingCar;

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
    return getEnabledSlots(
      matching
    ).find(
      function (slot) {
        return (
          slot.id ===
          slotId
        );
      }
    ) || null;
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
        '.matching-matrix-row[data-slot-id="' +
        CSS.escape(slotId) +
        '"]'
      )
      .forEach(
        function (row) {
          row.classList.add(
            "is-selected"
          );
        }
      );
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
          class="matching-primary-button matching-create-car-next"
          onclick="prepareMatchingFormalCar()"
          ${
            availableResponses.length ===
            0
              ? "disabled"
              : ""
          }
        >
          下一步：建立正式車團
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
      window.currentMatchingCar;

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

    const selectedInputs =
      Array.from(
        document.querySelectorAll(
          ".matching-create-player-checkbox:checked"
        )
      );

    const players =
      selectedInputs.map(
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

          return {
            responseId:
              input.value ||
              "",

            playerName,

            displayName:
              playerName,

            name:
              playerName,

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
              new Date()
                .toISOString(),

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

  function prepareMatchingFormalCar() {
    const draft =
      getSelectedMatchingCarDraft();

    if (!draft) {
      alert(
        "找不到已選擇的媒合時段。"
      );

      return;
    }

    if (
      draft.players.length === 0
    ) {
      alert(
        "請至少保留一位可參加玩家。"
      );

      return;
    }

    /*
      下一批會把這裡接到正式 Car 建立。

      現階段先確認 Matrix 選擇、
      玩家勾選與資料整理全部正確。
    */
    console.log(
      "Matching 正式車團草稿：",
      draft
    );

    const names =
      draft.players
        .map(
          function (player) {
            return (
              "・" +
              player.playerName
            );
          }
        )
        .join("\n");

    alert(
      "已準備正式車團資料：\n\n" +
      draft.gameDate +
      " " +
      draft.gameTime +
      "\n\n可參加玩家：\n" +
      names +
      "\n\n下一步將接上正式建立流程。"
    );
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

  window.prepareMatchingFormalCar =
    prepareMatchingFormalCar;

  window.JLYMatchingCreateCar = {
    refresh:
      refreshSelection,

    getDraft:
      getSelectedMatchingCarDraft
  };

  console.log(
    "✅ Matching Create Car V1 已載入"
  );
})();
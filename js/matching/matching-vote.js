(function () {
  "use strict";

  let currentCar = null;
  let selectedPlayerKey = "";

  function getCarId() {
    return new URLSearchParams(
      location.search
    ).get("id");
  }

  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    return window.db;
  }

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

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
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
      date.getMonth() + 1 +
      "/" +
      date.getDate() +
      "（" +
      weekdays[date.getDay()] +
      "）"
    );
  }

  function getMatching() {
    if (
      !currentCar ||
      !currentCar.matching ||
      typeof currentCar.matching !==
        "object"
    ) {
      return null;
    }

    return currentCar.matching;
  }

  function getPlayerName(
    player,
    index
  ) {
    const name =
      String(
        player.hostAlias ||
        player.displayName ||
        player.playerName ||
        player.name ||
        ""
      ).trim();

    return (
      name ||
      "玩家 " + (index + 1)
    );
  }

  function getPlayerKey(
    player,
    index
  ) {
    const directId =
      String(
        player.playerId ||
        player.id ||
        ""
      ).trim();

    if (directId) {
      return directId;
    }

    return [
      "legacy",
      index + 1,
      normalizeText(
        getPlayerName(
          player,
          index
        )
      ) || "player"
    ].join("-");
  }

  function getOriginalPlayers() {
    const players =
      Array.isArray(
        currentCar &&
        currentCar.players
      )
        ? currentCar.players
        : [];

    return players
      .map(
        function (
          player,
          index
        ) {
          return {
            raw:
              player,

            index,

            playerKey:
              getPlayerKey(
                player,
                index
              ),

            playerId:
              String(
                player.playerId ||
                player.id ||
                ""
              ).trim(),

            playerName:
              getPlayerName(
                player,
                index
              ),

            position:
              String(
                player.position ||
                "不限"
              ).trim() ||
              "不限"
          };
        }
      )
      .filter(
        function (item) {
          const status =
            String(
              item.raw.status ||
              ""
            ).trim();

          return ![
            "已取消",
            "取消",
            "removed",
            "deleted"
          ].includes(status);
        }
      );
  }

  function getPlayerStorageKey(
    carId
  ) {
    return (
      "jlyMatchingPlayerKey:" +
      carId
    );
  }

  function getSavedPlayerKey(
    carId
  ) {
    return (
      localStorage.getItem(
        getPlayerStorageKey(
          carId
        )
      ) ||
      ""
    );
  }

  function savePlayerKey(
    carId,
    playerKey
  ) {
    localStorage.setItem(
      getPlayerStorageKey(
        carId
      ),
      playerKey
    );
  }

  function clearSavedPlayerKey(
    carId
  ) {
    localStorage.removeItem(
      getPlayerStorageKey(
        carId
      )
    );
  }

  function findPlayerByKey(
    playerKey
  ) {
    return (
      getOriginalPlayers()
        .find(
          function (player) {
            return (
              String(
                player.playerKey
              ) ===
              String(playerKey)
            );
          }
        ) ||
      null
    );
  }

  function makeResponseKey(
    playerKey
  ) {
    const safeKey =
      String(playerKey || "")
        .trim()
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "_"
        )
        .slice(0, 120);

    return (
      "player-" +
      (
        safeKey ||
        "unknown"
      )
    );
  }

  function getResponses() {
    const matching =
      getMatching();

    return (
      matching &&
      matching.responses &&
      typeof matching.responses ===
        "object"
        ? matching.responses
        : {}
    );
  }

  function findExistingResponseForPlayer(
    player
  ) {
    if (!player) {
      return null;
    }

    const responses =
      getResponses();

    const entries =
      Object.entries(
        responses
      );

    const byKey =
      entries.find(
        function (
          entry
        ) {
          const response =
            entry[1];

          return (
            response &&
            String(
              response.playerKey ||
              ""
            ) ===
            String(
              player.playerKey
            )
          );
        }
      );

    if (byKey) {
      return {
        responseId:
          byKey[0],

        response:
          byKey[1]
      };
    }

    if (player.playerId) {
      const byPlayerId =
        entries.find(
          function (
            entry
          ) {
            const response =
              entry[1];

            return (
              response &&
              String(
                response.playerId ||
                ""
              ) ===
              String(
                player.playerId
              )
            );
          }
        );

      if (byPlayerId) {
        return {
          responseId:
            byPlayerId[0],

          response:
            byPlayerId[1]
        };
      }
    }

    /*
      相容舊版自由輸入名字的回覆。
    */
    const normalizedName =
      normalizeText(
        player.playerName
      );

    const byLegacyName =
      entries.find(
        function (
          entry
        ) {
          const response =
            entry[1];

          return (
            response &&
            normalizeText(
              response.playerName ||
              response.displayName ||
              response.name ||
              ""
            ) ===
            normalizedName
          );
        }
      );

    return byLegacyName
      ? {
          responseId:
            byLegacyName[0],

          response:
            byLegacyName[1]
        }
      : null;
  }

  function getEnabledSlots() {
    const matching =
      getMatching();

    if (!matching) {
      return [];
    }

    return (
      Array.isArray(
        matching.candidateSlots
      )
        ? matching.candidateSlots
        : []
    )
      .filter(
        function (slot) {
          return (
            slot.enabled !==
              false &&
            slot.id &&
            slot.date &&
            slot.time
          );
        }
      )
      .sort(
        function (a, b) {
          return (
            (
              a.date +
              "|" +
              a.time
            ).localeCompare(
              b.date +
              "|" +
              b.time
            )
          );
        }
      );
  }

  function buildSlotGroups(
    slots
  ) {
    const grouped = {};

    slots.forEach(
      function (slot) {
        if (
          !grouped[slot.date]
        ) {
          grouped[slot.date] =
            [];
        }

        grouped[slot.date]
          .push(slot);
      }
    );

    return grouped;
  }

  function renderUnavailable(
    message
  ) {
    const app =
      document.getElementById(
        "matchingVoteApp"
      );

    if (!app) {
      return;
    }

    app.innerHTML = `
      <section class="matching-vote-card">

        <div class="matching-vote-empty">
          ${escapeHtml(message)}
        </div>

      </section>
    `;
  }

  function renderPlayerPicker() {
    const app =
      document.getElementById(
        "matchingVoteApp"
      );

    if (!app) {
      return;
    }

    const matching =
      getMatching();

    if (
      !matching ||
      matching.status !==
        "published"
    ) {
      renderUnavailable(
        "這份時間媒合尚未開放。"
      );

      return;
    }

        const players =
      getOriginalPlayers();

    if (
      players.length === 0
    ) {
      renderUnavailable(
        "這台車目前沒有可以參與媒合的玩家。"
      );

      return;
    }

    app.innerHTML = `
      <section class="matching-vote-card">

        <div class="matching-vote-status">
          選擇身分
        </div>

        <h2 class="matching-vote-title">
          請選擇你是誰
        </h2>

        <p class="matching-vote-description">
          請點選你在這台車上的名字。
          未來綁定 LINE 後，系統會自動辨認。
        </p>

        <div class="matching-vote-player-list">

          ${
            players
              .map(
                function (player) {
                  const existing =
                    findExistingResponseForPlayer(
                      player
                    );

                  return `
                    <button
                      type="button"
                      class="matching-vote-player-button"
                      onclick="selectMatchingVotePlayer('${escapeHtml(
                        player.playerKey
                      )}')"
                    >

                      <span class="matching-vote-player-main">

                        <strong>
                          ${escapeHtml(
                            player.playerName
                          )}
                        </strong>

                        <small>
                          ${escapeHtml(
                            player.position
                          )}
                        </small>

                      </span>

                      <span class="matching-vote-player-state">
                        ${
                          existing
                            ? "已回覆"
                            : "尚未回覆"
                        }
                      </span>

                    </button>
                  `;
                }
              )
              .join("")
          }

        </div>

      </section>
    `;
  }

  function selectMatchingVotePlayer(
    playerKey
  ) {
    const player =
      findPlayerByKey(
        playerKey
      );

    if (!player) {
      alert(
        "找不到這位玩家，請重新整理頁面。"
      );

      return;
    }

    const confirmed =
      confirm(
        "你是「" +
        player.playerName +
        "」嗎？"
      );

    if (!confirmed) {
      return;
    }

    selectedPlayerKey =
      player.playerKey;

    savePlayerKey(
      getCarId(),
      selectedPlayerKey
    );

    renderVoteForm();
  }

  function changeMatchingVotePlayer() {
    selectedPlayerKey =
      "";

    clearSavedPlayerKey(
      getCarId()
    );

    renderPlayerPicker();
  }

  function renderVoteForm() {
    const app =
      document.getElementById(
        "matchingVoteApp"
      );

    if (!app) {
      return;
    }

    const matching =
      getMatching();

    const slots =
      getEnabledSlots();

    const player =
      findPlayerByKey(
        selectedPlayerKey
      );

    if (
      !matching ||
      matching.status !==
        "published"
    ) {
      renderUnavailable(
        "這份時間媒合尚未開放。"
      );

      return;
    }

    if (!player) {
      renderPlayerPicker();
      return;
    }

    if (
      slots.length === 0
    ) {
      renderUnavailable(
        "目前沒有可填寫的候選時段。"
      );

      return;
    }

    const existingInfo =
      findExistingResponseForPlayer(
        player
      );

    const existing =
      existingInfo
        ? existingInfo.response
        : null;

    const selectedIds =
      existing &&
      Array.isArray(
        existing.slotIds
      )
        ? existing.slotIds
        : [];

    const grouped =
      buildSlotGroups(
        slots
      );

    app.innerHTML = `
      <section class="matching-vote-card">

        <div class="matching-vote-status">
          ${
            existing
              ? "修改回覆"
              : "填寫時間"
          }
        </div>

        <div class="matching-vote-player-summary">

          <div>
            <small>
              目前身分
            </small>

            <strong>
              ${escapeHtml(
                player.playerName
              )}
            </strong>
          </div>

          <button
            type="button"
            onclick="changeMatchingVotePlayer()"
          >
            不是我
          </button>

        </div>

        <h2 class="matching-vote-title">
          請勾選你可以的時間
        </h2>

        <p class="matching-vote-description">
          可以複選多個時段。
          主揪會依大家的回覆決定最後開團時間。
        </p>

        <div class="matching-vote-days">

          ${
            Object.keys(grouped)
              .sort()
              .map(
                function (
                  dateKey
                ) {
                  return `
                    <section class="matching-vote-day">

                      <div class="matching-vote-day-title">
                        📅 ${formatDate(
                          dateKey
                        )}
                      </div>

                      <div class="matching-vote-slots">

                        ${
                          grouped[dateKey]
                            .map(
                              function (
                                slot
                              ) {
                                return `
                                  <label class="matching-vote-slot">

                                    <input
                                      type="checkbox"
                                      class="matching-vote-slot-checkbox"
                                      value="${escapeHtml(
                                        slot.id
                                      )}"
                                      ${
                                        selectedIds.includes(
                                          slot.id
                                        )
                                          ? "checked"
                                          : ""
                                      }
                                    >

                                    <span class="matching-vote-slot-icon">
                                      ${escapeHtml(
                                        slot.icon ||
                                        "🕒"
                                      )}
                                    </span>

                                    <span class="matching-vote-slot-info">

                                      <span class="matching-vote-slot-main">
                                        ${escapeHtml(
                                          slot.label ||
                                          "時段"
                                        )}
                                      </span>

                                      <span class="matching-vote-slot-time">
                                        ${escapeHtml(
                                          slot.time
                                        )}
                                      </span>

                                    </span>

                                  </label>
                                `;
                              }
                            )
                            .join("")
                        }

                      </div>

                    </section>
                  `;
                }
              )
              .join("")
          }

        </div>

        <button
          type="button"
          id="matchingVoteSubmitButton"
          class="matching-vote-submit"
          onclick="submitMatchingVote()"
        >
          ${
            existing
              ? "更新我的回覆"
              : "送出我的時間"
          }
        </button>

      </section>
    `;
  }

  function renderSaved() {
    const app =
      document.getElementById(
        "matchingVoteApp"
      );

    if (!app) {
      return;
    }

    const player =
      findPlayerByKey(
        selectedPlayerKey
      );

    const playerName =
      player
        ? player.playerName
        : "玩家";

    app.innerHTML = `
      <section class="
        matching-vote-card
        matching-vote-saved
      ">

        <div class="matching-vote-saved-icon">
          ✅
        </div>

        <h2 class="matching-vote-saved-title">
          已收到你的時間
        </h2>

        <p class="matching-vote-saved-text">
          ${escapeHtml(playerName)}，
          主揪確認最終時間後會再通知大家。
        </p>

        <button
          type="button"
          class="matching-vote-secondary"
          onclick="renderMatchingVoteForm()"
        >
          修改我的回覆
        </button>

        <button
          type="button"
          class="
            matching-vote-secondary
            matching-vote-change-player
          "
          onclick="changeMatchingVotePlayer()"
        >
          不是我，重新選擇
        </button>

      </section>
    `;
  }

  async function submitMatchingVote() {
    const carId =
      getCarId();

    const player =
      findPlayerByKey(
        selectedPlayerKey
      );

    const button =
      document.getElementById(
        "matchingVoteSubmitButton"
      );

    const slotIds =
      Array.from(
        document.querySelectorAll(
          ".matching-vote-slot-checkbox:checked"
        )
      )
        .map(
          function (checkbox) {
            return checkbox.value;
          }
        );

    if (!player) {
      alert(
        "請先選擇你是誰。"
      );

      renderPlayerPicker();
      return;
    }

    if (
      slotIds.length === 0
    ) {
      alert(
        "請至少勾選一個可以的時段。"
      );

      return;
    }

    try {
      if (button) {
        button.disabled =
          true;

        button.textContent =
          "送出中…";
      }

      const carRef =
        getDb()
          .collection("cars")
          .doc(carId);

                const existingInfo =
        findExistingResponseForPlayer(
          player
        );

      const responseId =
        existingInfo
          ? existingInfo.responseId
          : makeResponseKey(
              player.playerKey
            );

      await getDb()
        .runTransaction(
          async function (
            transaction
          ) {
            const snapshot =
              await transaction.get(
                carRef
              );

            if (!snapshot.exists) {
              throw new Error(
                "找不到這份媒合"
              );
            }

            const car =
              snapshot.data();

            const matching =
              car.matching &&
              typeof car.matching ===
                "object"
                ? car.matching
                : null;

            if (
              !matching ||
              matching.status !==
                "published"
            ) {
              throw new Error(
                "這份媒合目前未開放"
              );
            }

            /*
              確認這位玩家仍在原車名單中。
            */
            const sourcePlayers =
              Array.isArray(
                car.players
              )
                ? car.players
                : [];

            const stillExists =
              sourcePlayers.some(
                function (
                  sourcePlayer,
                  index
                ) {
                  return (
                    getPlayerKey(
                      sourcePlayer,
                      index
                    ) ===
                    player.playerKey
                  );
                }
              );

            if (!stillExists) {
              throw new Error(
                "你已不在這台車的玩家名單中"
              );
            }

            const responses =
              matching.responses &&
              typeof matching.responses ===
                "object"
                ? {
                    ...matching.responses
                  }
                : {};

            const oldResponse =
              responses[
                responseId
              ];

            const timestamp =
              nowTime();

            responses[
              responseId
            ] = {
              id:
                responseId,

              playerKey:
                player.playerKey,

              playerId:
                player.playerId,

              playerName:
                player.playerName,

              displayName:
                player.playerName,

              /*
                保留 name 欄位，
                相容主揪端目前 Matrix。
              */
              name:
                player.playerName,

              position:
                player.position,

              slotIds,

              status:
                "submitted",

              source:
                "car_player",

              createdAt:
                oldResponse &&
                oldResponse.createdAt
                  ? oldResponse.createdAt
                  : timestamp,

              updatedAt:
                timestamp
            };

            transaction.update(
              carRef,
              {
                "matching.responses":
                  responses,

                "matching.updatedAt":
                  timestamp,

                updatedAt:
                  firebase.firestore
                    .FieldValue
                    .serverTimestamp()
              }
            );
          }
        );

      savePlayerKey(
        carId,
        player.playerKey
      );

      const latest =
        await carRef.get();

      currentCar = {
        id:
          latest.id,

        ...latest.data()
      };

      renderSaved();
    } catch (error) {
      console.error(
        "送出媒合回覆失敗：",
        error
      );

      alert(
        "送出失敗：" +
        (
          error.message ||
          "未知錯誤"
        )
      );

      if (button) {
        button.disabled =
          false;

        button.textContent =
          "送出我的時間";
      }
    }
  }

  async function loadMatchingVote() {
    const carId =
      getCarId();

    const app =
      document.getElementById(
        "matchingVoteApp"
      );

    if (!carId) {
      if (app) {
        app.innerHTML = `
          <section class="matching-vote-card">

            <div class="matching-vote-error">
              網址缺少車團 ID。
            </div>

          </section>
        `;
      }

      return;
    }

    try {
      const snapshot =
        await getDb()
          .collection("cars")
          .doc(carId)
          .get();

      if (!snapshot.exists) {
        throw new Error(
          "找不到這份媒合"
        );
      }

      currentCar = {
        id:
          snapshot.id,

        ...snapshot.data()
      };

      const title =
        document.getElementById(
          "matchingVoteScriptName"
        );

      if (title) {
        title.textContent =
          currentCar.scriptName ||
          "未命名劇本";
      }

      const savedKey =
        getSavedPlayerKey(
          carId
        );

      /*
        同一個瀏覽器曾選過玩家，
        直接進入該玩家的表單。
      */
      if (
        savedKey &&
        findPlayerByKey(
          savedKey
        )
      ) {
        selectedPlayerKey =
          savedKey;

        renderVoteForm();
      } else {
        selectedPlayerKey =
          "";

        renderPlayerPicker();
      }
    } catch (error) {
      console.error(
        "載入媒合投票失敗：",
        error
      );

      if (app) {
        app.innerHTML = `
          <section class="matching-vote-card">

            <div class="matching-vote-error">
              ${escapeHtml(
                error.message ||
                "載入失敗"
              )}
            </div>

          </section>
        `;
      }
    }
  }

  function waitForFirebase() {
    if (window.db) {
      loadMatchingVote();
      return;
    }

    let attempts = 0;

    const timer =
      setInterval(
        function () {
          attempts += 1;

          if (window.db) {
            clearInterval(
              timer
            );

            loadMatchingVote();
            return;
          }

          if (
            attempts >= 40
          ) {
            clearInterval(
              timer
            );

            renderUnavailable(
              "Firebase 載入失敗，請重新整理頁面。"
            );
          }
        },
        250
      );
  }

  window.selectMatchingVotePlayer =
    selectMatchingVotePlayer;

  window.changeMatchingVotePlayer =
    changeMatchingVotePlayer;

  window.submitMatchingVote =
    submitMatchingVote;

  window.renderMatchingVoteForm =
    renderVoteForm;

  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      waitForFirebase
    );
  } else {
    waitForFirebase();
  }

  console.log(
    "✅ Matching Vote V2 已載入"
  );
})();
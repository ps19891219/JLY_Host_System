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

    function getDmName(
    dm,
    index
  ) {
    if (
      typeof dm ===
      "string"
    ) {
      const text =
        dm.trim();

      return (
        text ||
        "DM " + (index + 1)
      );
    }

    if (
      !dm ||
      typeof dm !==
        "object"
    ) {
      return (
        "DM " + (index + 1)
      );
    }

    const name =
      String(
        dm.dmName ||
        dm.displayName ||
        dm.name ||
        dm.nickname ||
        dm.title ||
        ""
      ).trim();

    return (
      name ||
      "DM " + (index + 1)
    );
  }

  function getDmId(
    dm
  ) {
    if (
      !dm ||
      typeof dm !==
        "object"
    ) {
      return "";
    }

    return String(
      dm.dmId ||
      dm.memberId ||
      dm.userId ||
      dm.playerId ||
      dm.id ||
      ""
    ).trim();
  }

  function getDmKey(
    dm,
    index
  ) {
    const directId =
      getDmId(dm);

    if (directId) {
      return (
        "dm:" +
        directId
      );
    }

    return (
      "dm:legacy:" +
      (index + 1) +
      ":" +
      (
        normalizeText(
          getDmName(
            dm,
            index
          )
        ) ||
        "dm"
      )
    );
  }

    function getParticipantsFromCar(
    car
  ) {
    const sourceCar =
      car &&
      typeof car ===
        "object"
        ? car
        : {};

    // ============================================================
    // 玩家
    // ============================================================

    const players =
      Array.isArray(
        sourceCar.players
      )
        ? sourceCar.players
        : [];

    const playerParticipants =
      players
        .map(
          function (
            player,
            index
          ) {
            const playerKey =
              getPlayerKey(
                player,
                index
              );

            const playerName =
              getPlayerName(
                player,
                index
              );

            return {
              raw:
                player,

              index,

              participantType:
                "player",

              participantKey:
                playerKey,

              participantId:
                String(
                  player.playerId ||
                  player.id ||
                  ""
                ).trim(),

              participantName:
                playerName,

              // 舊版 V2 相容
              playerKey:
                playerKey,

              playerId:
                String(
                  player.playerId ||
                  player.id ||
                  ""
                ).trim(),

              playerName:
                playerName,

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

    // ============================================================
    // DM / 工作人員
    //
    // 新版正式資料來源：
    // car.staffSlots
    //
    // 不再使用舊 dmName / dmList，
    // 避免把已過期的 DM 抓回來。
    // ============================================================

    const staffSlots =
      Array.isArray(
        sourceCar.staffSlots
      )
        ? sourceCar.staffSlots
        : [];

    const seenDmKeys =
      new Set();

    const dmParticipants =
      staffSlots
        .map(
          function (
            staff,
            index
          ) {
            if (
              !staff ||
              typeof staff !==
                "object"
            ) {
              return null;
            }

            const dmName =
              String(
                staff.displayName ||
                (
                  staff.memberSnapshot &&
                  staff.memberSnapshot
                    .displayName
                ) ||
                staff.name ||
                ""
              ).trim();

            if (!dmName) {
              return null;
            }

            const dmId =
              String(
                staff.memberId ||
                (
                  staff.memberSnapshot &&
                  staff.memberSnapshot
                    .memberId
                ) ||
                staff.id ||
                ""
              ).trim();

            const dedupeKey =
              dmId
                ? (
                    "id:" +
                    dmId
                  )
                : (
                    "name:" +
                    normalizeText(
                      dmName
                    )
                  );

            if (
              seenDmKeys.has(
                dedupeKey
              )
            ) {
              return null;
            }

            seenDmKeys.add(
              dedupeKey
            );

            const dmKey =
              dmId
                ? (
                    "dm:" +
                    dmId
                  )
                : (
                    "dm:staff:" +
                    (index + 1) +
                    ":" +
                    normalizeText(
                      dmName
                    )
                  );

            return {
              raw:
                staff,

              index,

              participantType:
                "dm",

              participantKey:
                dmKey,

              participantId:
                dmId,

              participantName:
                dmName,

              // 舊變數名稱相容
              playerKey:
                dmKey,

              playerId:
                "",

              playerName:
                dmName,

              position:
                "DM",

              staffOrder:
                Number(
                  staff.order ||
                  index + 1
                ),

              staffLabel:
                String(
                  staff.label ||
                  ""
                ).trim(),

              source:
                "staff_slot"
            };
          }
        )
        .filter(Boolean);

    // ============================================================
    // 合併媒合參與者
    // DM 先、玩家後
    // ============================================================

    return [
      ...dmParticipants,
      ...playerParticipants
    ];
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
    playerKey,
    participantType = "player"
  ) {
    const safeKey =
      String(playerKey || "")
        .trim()
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "_"
        )
        .slice(0, 120);

    const prefix =
      participantType ===
        "dm"
        ? "dm-"
        : "player-";

    return (
      prefix +
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

    const participantType =
      player.participantType ||
      "player";

    const participantKey =
      player.participantKey ||
      player.playerKey ||
      "";

    const participantId =
      player.participantId ||
      player.playerId ||
      "";

    /*
      第一順位：
      新版 participantKey
    */

    const byParticipantKey =
      entries.find(
        function (
          entry
        ) {
          const response =
            entry[1];

          return (
            response &&
            String(
              response.participantKey ||
              response.playerKey ||
              ""
            ) ===
            String(
              participantKey
            ) &&
            (
              !response.participantType ||
              response.participantType ===
                participantType
            )
          );
        }
      );

    if (byParticipantKey) {
      return {
        responseId:
          byParticipantKey[0],

        response:
          byParticipantKey[1]
      };
    }

    /*
      第二順位：
      participantId
    */

    if (participantId) {
      const byParticipantId =
        entries.find(
          function (
            entry
          ) {
            const response =
              entry[1];

            return (
              response &&
              String(
                response.participantId ||
                response.playerId ||
                ""
              ) ===
              String(
                participantId
              ) &&
              (
                !response.participantType ||
                response.participantType ===
                  participantType
              )
            );
          }
        );

      if (byParticipantId) {
        return {
          responseId:
            byParticipantId[0],

          response:
            byParticipantId[1]
        };
      }
    }

    /*
      舊版玩家資料相容。

      只有 player 可以用舊版
      姓名回覆做 fallback。

      DM 不使用這個 fallback，
      避免 DM 與玩家同名時撞資料。
    */

    if (
      participantType !==
      "player"
    ) {
      return null;
    }

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

          if (
            response &&
            response.participantType ===
              "dm"
          ) {
            return false;
          }

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

    function renderParticipantButtons(
    participants
  ) {
    return participants
      .map(
        function (
          participant
        ) {
          const existing =
            findExistingResponseForPlayer(
              participant
            );

          const roleText =
            participant.participantType ===
              "dm"
              ? "DM"
              : participant.position;

          return `
            <button
              type="button"
              class="matching-vote-player-button"
              onclick="selectMatchingVotePlayer('${escapeHtml(
                participant.playerKey
              )}')"
            >

              <span class="matching-vote-player-main">

                <strong>
                  ${escapeHtml(
                    participant.playerName
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    roleText
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
      .join("");
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

    const participants =
      getOriginalPlayers();

    const players =
      participants.filter(
        function (
          participant
        ) {
          return (
            participant
              .participantType ===
            "player"
          );
        }
      );

    const dms =
      participants.filter(
        function (
          participant
        ) {
          return (
            participant
              .participantType ===
            "dm"
          );
        }
      );

    if (
      participants.length === 0
    ) {
      renderUnavailable(
        "這台車目前沒有可以參與媒合的人員。"
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
          玩家與 DM 都可以填寫可配合時間。
        </p>

                ${
          dms.length > 0
            ? `
              <section
                class="matching-vote-participant-section"
              >
                <div
                  class="matching-vote-participant-title"
                >
                  🎭 DM
                </div>

                <div
                  class="matching-vote-player-list"
                >
                  ${renderParticipantButtons(
                    dms
                  )}
                </div>
              </section>
            `
            : ""
        }

        ${
          players.length > 0
            ? `
              <section
                class="matching-vote-participant-section"
              >
                <div
                  class="matching-vote-participant-title"
                >
                  👥 玩家
                </div>

                <div
                  class="matching-vote-player-list"
                >
                  ${renderParticipantButtons(
                    players
                  )}
                </div>
              </section>
            `
            : ""
        }

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
              player.playerKey,
              player.participantType
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

                        /*
              確認這位參與者仍存在於原車。

              player → car.players
              dm     → car.dmName / car.dmList
            */

            const sourceParticipants =
              getParticipantsFromCar(
                car
              );

            const stillExists =
              sourceParticipants.some(
                function (
                  sourceParticipant
                ) {
                  return (
                    String(
                      sourceParticipant
                        .participantKey ||
                      sourceParticipant
                        .playerKey ||
                      ""
                    ) ===
                    String(
                      player
                        .participantKey ||
                      player.playerKey ||
                      ""
                    ) &&
                    (
                      sourceParticipant
                        .participantType ===
                      player
                        .participantType
                    )
                  );
                }
              );

            if (!stillExists) {
              throw new Error(
                player.participantType ===
                  "dm"
                  ? "你已不在這台車的 DM 名單中"
                  : "你已不在這台車的玩家名單中"
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

                        const participantType =
              player.participantType ||
              "player";

            const participantKey =
              player.participantKey ||
              player.playerKey ||
              "";

            const participantId =
              player.participantId ||
              player.playerId ||
              "";

            const participantName =
              player.participantName ||
              player.playerName ||
              "";

            responses[
              responseId
            ] = {
              id:
                responseId,

              /*
                Matching Participant V1
              */

              participantType,

              participantKey,

              participantId,

              participantName,

              /*
                玩家欄位保留，
                舊 Matrix / 舊媒合資料仍可讀。
              */

              playerKey:
                participantType ===
                  "player"
                  ? player.playerKey
                  : "",

              playerId:
                participantType ===
                  "player"
                  ? player.playerId
                  : "",

              playerName:
                participantType ===
                  "player"
                  ? participantName
                  : "",

              /*
                DM 專用欄位
              */

              dmId:
                participantType ===
                  "dm"
                  ? participantId
                  : "",

              dmName:
                participantType ===
                  "dm"
                  ? participantName
                  : "",

              /*
                共用顯示名稱。
                Matrix 現在仍可直接讀 name。
              */

              displayName:
                participantName,

              name:
                participantName,

              position:
                participantType ===
                  "dm"
                  ? "DM"
                  : player.position,

              slotIds,

              status:
                "submitted",

              source:
                participantType ===
                  "dm"
                  ? "car_dm"
                  : "car_player",

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
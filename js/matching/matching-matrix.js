/*
====================================================

JLY Host System

Matching Matrix V2

用途：
1. 顯示時間媒合 Matrix
2. DM 與玩家分組
3. DM 固定顯示在玩家前面
4. 尚未回覆的人也會顯示
5. 統計真正以全車 DM + 玩家為基準
6. 保留點擊時段 selectMatchingSlot()

資料來源：
- window.currentMatchingCar
- car.players
- car.staffSlots
- car.matching.responses
- car.matching.candidateSlots

====================================================
*/

(function () {
  "use strict";

  let isMatrixOpen = false;

  // ============================================================
  // 基礎工具
  // ============================================================

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
    return String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function parseDateKey(dateKey) {
    const parts =
      String(
        dateKey || ""
      )
        .split("-")
        .map(Number);

    if (
      parts.length !== 3 ||
      parts.some(
        Number.isNaN
      )
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
      parseDateKey(
        dateKey
      );

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
      (date.getMonth() + 1) +
      "/" +
      date.getDate() +
      "（" +
      weekdays[
        date.getDay()
      ] +
      "）"
    );
  }

  function getCurrentCar() {
    return (
      window.currentMatchingCar ||
      null
    );
  }

  // ============================================================
  // Candidate Slots
  // ============================================================

  function getCandidateSlots(
    matching
  ) {
    return (
      Array.isArray(
        matching &&
        matching.candidateSlots
      )
        ? matching.candidateSlots
        : []
    )
      .filter(
        function (slot) {
          return (
            slot &&
            slot.enabled !== false &&
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

  // ============================================================
  // Responses
  // ============================================================

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
      .values(
        responseMap
      )
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

  function getResponseType(
    response
  ) {
    if (!response) {
      return "player";
    }

    if (
      response.participantType ===
        "dm" ||
      response.source ===
        "car_dm" ||
      response.dmName
    ) {
      return "dm";
    }

    return "player";
  }

  function getResponseName(
    response
  ) {
    if (!response) {
      return "";
    }

    return String(
      response.participantName ||
      response.dmName ||
      response.playerName ||
      response.displayName ||
      response.name ||
      ""
    ).trim();
  }

  function hasSelectedSlot(
    response,
    slotId
  ) {
    return (
      response &&
      Array.isArray(
        response.slotIds
      ) &&
      response.slotIds.includes(
        slotId
      )
    );
  }

  // ============================================================
  // Participant：
  // DM + 玩家
  // ============================================================

  function getPlayerName(
    player,
    index
  ) {
    const name =
      String(
        player &&
        (
          player.hostAlias ||
          player.displayName ||
          player.playerName ||
          player.name
        ) ||
        ""
      ).trim();

    return (
      name ||
      "玩家 " +
      (index + 1)
    );
  }

  function getPlayerKey(
    player,
    index
  ) {
    const id =
      String(
        player &&
        (
          player.playerId ||
          player.id
        ) ||
        ""
      ).trim();

    if (id) {
      return id;
    }

    return (
      "legacy-" +
      (index + 1) +
      "-" +
      (
        normalizeText(
          getPlayerName(
            player,
            index
          )
        ) ||
        "player"
      )
    );
  }

  function buildPlayerParticipants(
    car
  ) {
    const players =
      Array.isArray(
        car &&
        car.players
      )
        ? car.players
        : [];

    return players
      .map(
        function (
          player,
          index
        ) {
          const status =
            String(
              player.status ||
              ""
            ).trim();

          if (
            [
              "已取消",
              "取消",
              "removed",
              "deleted"
            ].includes(
              status
            )
          ) {
            return null;
          }

          const name =
            getPlayerName(
              player,
              index
            );

          const key =
            getPlayerKey(
              player,
              index
            );

          return {
            participantType:
              "player",

            participantKey:
              key,

            participantId:
              String(
                player.playerId ||
                player.id ||
                ""
              ).trim(),

            participantName:
              name,

            position:
              String(
                player.position ||
                "不限"
              ).trim() ||
              "不限",

            raw:
              player
          };
        }
      )
      .filter(Boolean);
  }

    function buildDmParticipants(
    car
  ) {
    const staffSlots =
      Array.isArray(
        car &&
        car.staffSlots
      )
        ? car.staffSlots
        : [];

    const seen =
      new Set();

    return staffSlots
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

          const name =
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

          if (!name) {
            return null;
          }

          const memberId =
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
            memberId
              ? (
                  "id:" +
                  memberId
                )
              : (
                  "name:" +
                  normalizeText(
                    name
                  )
                );

          if (
            seen.has(
              dedupeKey
            )
          ) {
            return null;
          }

          seen.add(
            dedupeKey
          );

          const participantKey =
            memberId
              ? (
                  "dm:" +
                  memberId
                )
              : (
                  "dm:staff:" +
                  (index + 1) +
                  ":" +
                  normalizeText(
                    name
                  )
                );

          return {
            participantType:
              "dm",

            participantKey,

            participantId:
              memberId,

            participantName:
              name,

            position:
              "DM",

            raw:
              staff
          };
        }
      )
      .filter(Boolean);
  }

  function getParticipants() {
    const car =
      getCurrentCar() ||
      {};

    const dms =
      buildDmParticipants(
        car
      );

    const players =
      buildPlayerParticipants(
        car
      );

    return [
      ...dms,
      ...players
    ];
  }

  // ============================================================
  // Response ↔ Participant 配對
  // ============================================================

  function findResponseForParticipant(
    participant,
    responses
  ) {
    if (!participant) {
      return null;
    }

    const type =
      participant
        .participantType;

    const key =
      String(
        participant
          .participantKey ||
        ""
      );

    const id =
      String(
        participant
          .participantId ||
        ""
      );

    const name =
      normalizeText(
        participant
          .participantName
      );

    // ----------------------------------------------------------
    // 1. participantKey
    // ----------------------------------------------------------

    const byKey =
      responses.find(
        function (
          response
        ) {
          if (!response) {
            return false;
          }

          const responseType =
            getResponseType(
              response
            );

          const responseKey =
            String(
              response
                .participantKey ||
              (
                type === "player"
                  ? response.playerKey
                  : ""
              ) ||
              ""
            );

          return (
            responseType ===
              type &&
            responseKey &&
            responseKey === key
          );
        }
      );

    if (byKey) {
      return byKey;
    }

    // ----------------------------------------------------------
    // 2. participantId
    // ----------------------------------------------------------

    if (id) {
      const byId =
        responses.find(
          function (
            response
          ) {
            if (!response) {
              return false;
            }

            if (
              getResponseType(
                response
              ) !== type
            ) {
              return false;
            }

            const responseId =
              String(
                response
                  .participantId ||
                (
                  type === "dm"
                    ? response.dmId
                    : response.playerId
                ) ||
                ""
              );

            return (
              responseId &&
              responseId === id
            );
          }
        );

      if (byId) {
        return byId;
      }
    }

    // ----------------------------------------------------------
    // 3. 名稱 fallback
    // 舊玩家回覆相容
    // ----------------------------------------------------------

    if (!name) {
      return null;
    }

    return (
      responses.find(
        function (
          response
        ) {
          if (!response) {
            return false;
          }

          const responseType =
            getResponseType(
              response
            );

          if (
            responseType !==
              type
          ) {
            return false;
          }

          return (
            normalizeText(
              getResponseName(
                response
              )
            ) ===
            name
          );
        }
      ) ||
      null
    );
  }

  function attachResponses(
    participants,
    responses
  ) {
    return participants.map(
      function (
        participant
      ) {
        return {
          ...participant,

          response:
            findResponseForParticipant(
              participant,
              responses
            )
        };
      }
    );
  }

  // ============================================================
  // Slot 統計
  // ============================================================

  function getSlotStats(
    participants,
    slotId
  ) {
    const dmParticipants =
      participants.filter(
        function (item) {
          return (
            item.participantType ===
            "dm"
          );
        }
      );

    const playerParticipants =
      participants.filter(
        function (item) {
          return (
            item.participantType ===
            "player"
          );
        }
      );

    function calculate(
      list
    ) {
      const total =
        list.length;

      const responded =
        list.filter(
          function (item) {
            return Boolean(
              item.response
            );
          }
        ).length;

      const available =
        list.filter(
          function (item) {
            return (
              item.response &&
              hasSelectedSlot(
                item.response,
                slotId
              )
            );
          }
        ).length;

      const notSelected =
        list.filter(
          function (item) {
            return (
              item.response &&
              !hasSelectedSlot(
                item.response,
                slotId
              )
            );
          }
        ).length;

      const pending =
        total -
        responded;

      return {
        total,
        responded,
        available,
        notSelected,
        pending
      };
    }

    const dm =
      calculate(
        dmParticipants
      );

    const player =
      calculate(
        playerParticipants
      );

    const total = {
      total:
        dm.total +
        player.total,

      responded:
        dm.responded +
        player.responded,

      available:
        dm.available +
        player.available,

      notSelected:
        dm.notSelected +
        player.notSelected,

      pending:
        dm.pending +
        player.pending
    };

    return {
      dm,
      player,
      total
    };
  }

  // ============================================================
  // 左側日期表
  // ============================================================

  function buildLeftTable(
    slots
  ) {
    return `
      <table
        class="
          matching-matrix-table
          matching-matrix-left-table
        "
      >

        <thead>

  <tr
    class="
      matching-matrix-group-row
      matching-matrix-side-group-row
    "
  >
    <th
      aria-hidden="true"
    ></th>
  </tr>

  <tr
    class="
      matching-matrix-name-row
      matching-matrix-side-name-row
    "
  >
    <th>
      日期時間
    </th>
  </tr>

</thead>

      <tbody>

          ${
            slots
              .map(
                function (
                  slot
                ) {
                  return `
                    <tr
                      class="matching-matrix-row"
                      data-slot-id="${escapeHtml(
                        slot.id
                      )}"
                      onclick="selectMatchingSlot('${escapeHtml(
                        slot.id
                      )}')"
                    >

                      <th
                        scope="row"
                        title="${escapeHtml(
                          formatDate(
                            slot.date
                          ) +
                          " " +
                          (
                            slot.label ||
                            ""
                          ) +
                          " " +
                          slot.time
                        )}"
                      >

                        <span
                          class="matching-matrix-date"
                        >
                          ${escapeHtml(
                            formatDate(
                              slot.date
                            )
                          )}
                        </span>

                        <span
                          class="matching-matrix-slot-label"
                        >
                          ${escapeHtml(
                            slot.label ||
                            "時段"
                          )}
                        </span>

                        <span
                          class="matching-matrix-slot-time"
                        >
                          ${escapeHtml(
                            slot.time
                          )}
                        </span>

                      </th>

                    </tr>
                  `;
                }
              )
              .join("")
          }

        </tbody>

      </table>
    `;
  }

    // ============================================================
  // 中央 DM + 玩家 Matrix
  // ============================================================

  function buildParticipantHeader(
    participant
  ) {
    const isDm =
      participant
        .participantType ===
      "dm";

    const icon =
      isDm
        ? "🎭"
        : "👥";

    const roleClass =
      isDm
        ? "is-dm"
        : "is-player";

    return `
      <th
        class="
          matching-matrix-person-header
          ${roleClass}
        "
        title="${escapeHtml(
          (
            isDm
              ? "DM："
              : "玩家："
          ) +
          participant.participantName
        )}"
      >

        <span
          class="matching-matrix-person-role"
        >
          ${icon}
        </span>

        <span
          class="matching-matrix-player-name"
        >
          ${escapeHtml(
            participant
              .participantName
          )}
        </span>

      </th>
    `;
  }

  function buildParticipantCell(
    participant,
    slot
  ) {
    const response =
      participant.response;

    const hasResponded =
      Boolean(
        response
      );

    const selected =
      hasResponded &&
      hasSelectedSlot(
        response,
        slot.id
      );

    let className =
      "matching-matrix-person-cell";

    let content =
      "";

    let label =
      "";

    if (!hasResponded) {
      className +=
        " is-pending";

      content =
        "·";

      label =
        "尚未回覆";
    } else if (selected) {
      className +=
        " is-available";

      content =
        "✓";

      label =
        "可以";
    } else {
      className +=
        " is-unavailable";

      content =
        "";

      label =
        "已回覆但未勾選";
    }

    if (
      participant
        .participantType ===
      "dm"
    ) {
      className +=
        " is-dm";
    } else {
      className +=
        " is-player";
    }

    return `
      <td
        class="${className}"
        aria-label="${escapeHtml(
          participant
            .participantName +
          "：" +
          label
        )}"
        title="${escapeHtml(
          participant
            .participantName +
          "：" +
          label
        )}"
      >
        ${content}
      </td>
    `;
  }

  function buildCenterTable(
    slots,
    participants
  ) {
    const dmCount =
      participants.filter(
        function (item) {
          return (
            item.participantType ===
            "dm"
          );
        }
      ).length;

    const playerCount =
      participants.filter(
        function (item) {
          return (
            item.participantType ===
            "player"
          );
        }
      ).length;

    const minimumWidth =
      Math.max(
        participants.length *
          72,
        150
      );

    return `
      <table
        class="
          matching-matrix-table
          matching-matrix-center-table
          matching-matrix-v2
        "
        style="
          min-width:
          ${minimumWidth}px
        "
      >

        <thead>

          <tr
            class="
              matching-matrix-group-row
            "
          >

            ${
              dmCount > 0
                ? `
                  <th
                    colspan="${dmCount}"
                    class="
                      matching-matrix-group-header
                      is-dm
                    "
                  >
                    🎭 DM
                  </th>
                `
                : ""
            }

            ${
              playerCount > 0
                ? `
                  <th
                    colspan="${playerCount}"
                    class="
                      matching-matrix-group-header
                      is-player
                    "
                  >
                    👥 玩家
                  </th>
                `
                : ""
            }

          </tr>

          <tr
            class="
              matching-matrix-name-row
            "
          >

            ${
              participants
                .map(
                  buildParticipantHeader
                )
                .join("")
            }

          </tr>

        </thead>

        <tbody>

          ${
            slots
              .map(
                function (
                  slot
                ) {
                  return `
                    <tr
                      class="
                        matching-matrix-row
                      "
                      data-slot-id="${escapeHtml(
                        slot.id
                      )}"
                      onclick="selectMatchingSlot('${escapeHtml(
                        slot.id
                      )}')"
                    >

                      ${
                        participants
                          .map(
                            function (
                              participant
                            ) {
                              return buildParticipantCell(
                                participant,
                                slot
                              );
                            }
                          )
                          .join("")
                      }

                    </tr>
                  `;
                }
              )
              .join("")
          }

        </tbody>

      </table>
    `;
  }

  // ============================================================
  // 右側合計
  // ============================================================

  function buildRightTable(
    slots,
    participants
  ) {
    const totalParticipants =
      participants.length;

    return `
      <table
        class="
          matching-matrix-table
          matching-matrix-right-table
          matching-matrix-right-v2
        "
      >

        <thead>

  <tr
    class="
      matching-matrix-group-row
      matching-matrix-side-group-row
    "
  >
    <th
      aria-hidden="true"
    ></th>
  </tr>

  <tr
    class="
      matching-matrix-name-row
      matching-matrix-side-name-row
    "
  >
    <th>
      合計
    </th>
  </tr>

</thead>

        <tbody>

          ${
            slots
              .map(
                function (
                  slot
                ) {
                  const stats =
                    getSlotStats(
                      participants,
                      slot.id
                    );

                  const isEveryone =
                    totalParticipants >
                      0 &&
                    stats.total
                      .available ===
                    totalParticipants;

                  return `
                    <tr
                      class="
                        matching-matrix-row
                      "
                      data-slot-id="${escapeHtml(
                        slot.id
                      )}"
                      onclick="selectMatchingSlot('${escapeHtml(
                        slot.id
                      )}')"
                    >

                      <td
                        class="
                          matching-matrix-total-cell
                          ${
                            isEveryone
                              ? "is-complete"
                              : ""
                          }
                        "
                      >

                        <div
                          class="
                            matching-matrix-total-main
                          "
                        >

                          <strong>
                            ${stats.total.available}
                          </strong>

                          <span>
                            /
                            ${stats.total.total}
                          </span>

                          ${
                            isEveryone
                              ? `
                                <small>
                                  ✓
                                </small>
                              `
                              : ""
                          }

                        </div>

                        <div
                          class="
                            matching-matrix-total-detail
                          "
                        >

                          ${
                            stats.dm.total >
                              0
                              ? `
                                <span>
                                  🎭
                                  ${stats.dm.available}/${stats.dm.total}
                                </span>
                              `
                              : ""
                          }

                          ${
                            stats.player.total >
                              0
                              ? `
                                <span>
                                  👥
                                  ${stats.player.available}/${stats.player.total}
                                </span>
                              `
                              : ""
                          }

                        </div>

                      </td>

                    </tr>
                  `;
                }
              )
              .join("")
          }

        </tbody>

      </table>
    `;
  }

    // ============================================================
  // Legend
  // ============================================================

  function buildLegendHtml() {
  return `
    <div class="matching-matrix-legend">

      <span class="is-available">
        <strong>✓</strong>
        可以
      </span>

      <span class="is-pending">
        <strong>·</strong>
        未回覆
      </span>

      <span class="is-unavailable">
        <strong>－</strong>
        不可以
      </span>

    </div>
  `;
}

  // ============================================================
  // Matrix HTML
  // ============================================================

  function buildMatrixHtml(
    matching
  ) {
    const responses =
      getResponses(
        matching
      );

    const slots =
      getCandidateSlots(
        matching
      );

    const rawParticipants =
      getParticipants();

    const participants =
      attachResponses(
        rawParticipants,
        responses
      );

    if (
      participants.length ===
      0
    ) {
      return `
        <div
          class="matching-matrix-empty"
        >
          這台車目前沒有可參與媒合的 DM 或玩家。
        </div>
      `;
    }

    if (
      slots.length ===
      0
    ) {
      return `
        <div
          class="matching-matrix-empty"
        >
          目前沒有可統計的候選時段。
        </div>
      `;
    }

    const dmCount =
      participants.filter(
        function (item) {
          return (
            item.participantType ===
            "dm"
          );
        }
      ).length;

    const playerCount =
      participants.filter(
        function (item) {
          return (
            item.participantType ===
            "player"
          );
        }
      ).length;

    const respondedCount =
      participants.filter(
        function (item) {
          return Boolean(
            item.response
          );
        }
      ).length;

    return `
      <section
        class="
          matching-matrix-panel
          matching-matrix-panel-v2
        "
      >

        <div
          class="
            matching-matrix-heading
          "
        >

          <div>

            <h3>
              媒合結果
            </h3>

            <p>
              🎭 DM ${dmCount} 位
              ・
              👥 玩家 ${playerCount} 位
              ・
              已回覆 ${respondedCount}/${participants.length}
            </p>

          </div>

          <button
            type="button"
            class="
              matching-matrix-close-button
            "
            onclick="
              toggleMatchingMatrix(false)
            "
          >
            收起
          </button>

        </div>

        ${buildLegendHtml()}

        <div
          class="
            matching-matrix-layout
            matching-matrix-layout-v2
          "
        >

          <div
            class="
              matching-matrix-fixed-left
            "
          >
            ${buildLeftTable(
              slots
            )}
          </div>

          <div
            class="
              matching-matrix-scroll-middle
            "
          >
            ${buildCenterTable(
              slots,
              participants
            )}
          </div>

          <div
            class="
              matching-matrix-fixed-right
            "
          >
            ${buildRightTable(
              slots,
              participants
            )}
          </div>

        </div>

      </section>
    `;
  }

  // ============================================================
  // Render
  // ============================================================

  function renderMatchingMatrix(
    matching
  ) {
    const container =
      document.getElementById(
        "matchingMatrixContainer"
      );

    if (!container) {
      return;
    }

    container.hidden =
      !isMatrixOpen;

    if (!isMatrixOpen) {
      container.innerHTML =
        "";

      return;
    }

    container.innerHTML =
      buildMatrixHtml(
        matching
      );
  }

  // ============================================================
  // Toggle
  // ============================================================

  function toggleMatchingMatrix(
    forceState
  ) {
    if (
      typeof forceState ===
        "boolean"
    ) {
      isMatrixOpen =
        forceState;
    } else {
      isMatrixOpen =
        !isMatrixOpen;
    }

    const car =
      getCurrentCar();

    if (
      !car ||
      !car.matching
    ) {
      return;
    }

    renderMatchingMatrix(
      car.matching
    );

    if (isMatrixOpen) {
      const container =
        document.getElementById(
          "matchingMatrixContainer"
        );

      if (container) {
        container.scrollIntoView({
          behavior:
            "smooth",

          block:
            "start"
        });
      }
    }
  }

  // ============================================================
  // Refresh
  // ============================================================

  function refreshMatchingMatrix(
    matching
  ) {
    if (!isMatrixOpen) {
      return;
    }

    renderMatchingMatrix(
      matching
    );
  }

  // ============================================================
  // Public API
  // ============================================================

  window.toggleMatchingMatrix =
    toggleMatchingMatrix;

  window.JLYMatchingMatrix = {
    render:
      renderMatchingMatrix,

    refresh:
      refreshMatchingMatrix,

    toggle:
      toggleMatchingMatrix,

    getParticipants:
      getParticipants,

    getSlotStats:
      function (
        matching,
        slotId
      ) {
        const participants =
          attachResponses(
            getParticipants(),
            getResponses(
              matching
            )
          );

        return getSlotStats(
          participants,
          slotId
        );
      }
  };

  console.log(
    "✅ Matching Matrix V2 已載入"
  );
})();
(function () {
  "use strict";

  let isMatrixOpen = false;

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

  function getResponses(matching) {
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
      )
      .sort(
        function (a, b) {
          return String(
            a.createdAt || ""
          ).localeCompare(
            String(
              b.createdAt || ""
            )
          );
        }
      );
  }

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

  function getSlotTotal(
    responses,
    slotId
  ) {
    return responses.filter(
      function (response) {
        return hasSelectedSlot(
          response,
          slotId
        );
      }
    ).length;
  }

  function buildLeftTable(
    slots
  ) {
    return `
      <table class="matching-matrix-table matching-matrix-left-table">

        <thead>
          <tr>
            <th>日期時間</th>
          </tr>
        </thead>

        <tbody>
          ${
            slots.map(
              function (slot) {
                return `
                  <tr>
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
                      <span class="matching-matrix-date">
                        ${escapeHtml(
                          formatDate(
                            slot.date
                          )
                        )}
                      </span>

                      <span class="matching-matrix-slot-label">
                        ${escapeHtml(
                          slot.label ||
                          "時段"
                        )}
                      </span>

                      <span class="matching-matrix-slot-time">
                        ${escapeHtml(
                          slot.time
                        )}
                      </span>
                    </th>
                  </tr>
                `;
              }
            ).join("")
          }
        </tbody>

      </table>
    `;
  }

  function buildCenterTable(
    slots,
    responses
  ) {
    const minimumWidth =
      Math.max(
        responses.length * 68,
        100
      );

    return `
      <table
        class="matching-matrix-table matching-matrix-center-table"
        style="min-width:${minimumWidth}px"
      >

        <thead>
          <tr>
            ${
              responses.map(
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
                    <th
                      title="${escapeHtml(
                        name
                      )}"
                    >
                      <span class="matching-matrix-player-name">
                        ${escapeHtml(
                          name
                        )}
                      </span>
                    </th>
                  `;
                }
              ).join("")
            }
          </tr>
        </thead>

        <tbody>
          ${
            slots.map(
              function (slot) {
                return `
                  <tr>
                    ${
                      responses.map(
                        function (
                          response
                        ) {
                          const selected =
                            hasSelectedSlot(
                              response,
                              slot.id
                            );

                          return `
                            <td
                              class="${
                                selected
                                  ? "is-available"
                                  : "is-unavailable"
                              }"
                              aria-label="${
                                selected
                                  ? "可以"
                                  : "未勾選"
                              }"
                            >
                              ${
                                selected
                                  ? "✓"
                                  : ""
                              }
                            </td>
                          `;
                        }
                      ).join("")
                    }
                  </tr>
                `;
              }
            ).join("")
          }
        </tbody>

      </table>
    `;
  }

  function buildRightTable(
    slots,
    responses
  ) {
    const totalResponses =
      responses.length;

    return `
      <table class="matching-matrix-table matching-matrix-right-table">

        <thead>
          <tr>
            <th>合計</th>
          </tr>
        </thead>

        <tbody>
          ${
            slots.map(
              function (slot) {
                const total =
                  getSlotTotal(
                    responses,
                    slot.id
                  );

                const isEveryone =
                  totalResponses > 0 &&
                  total ===
                    totalResponses;

                return `
                  <tr>
                    <td
                      class="${
                        isEveryone
                          ? "is-complete"
                          : ""
                      }"
                    >
                      <strong>
                        ${total}
                      </strong>

                      <span>
                        / ${totalResponses}
                      </span>

                      ${
                        isEveryone
                          ? `
                            <small>✓</small>
                          `
                          : ""
                      }
                    </td>
                  </tr>
                `;
              }
            ).join("")
          }
        </tbody>

      </table>
    `;
  }

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

    if (
      responses.length === 0
    ) {
      return `
        <div class="matching-matrix-empty">
          尚未收到任何回覆。
        </div>
      `;
    }

    if (
      slots.length === 0
    ) {
      return `
        <div class="matching-matrix-empty">
          目前沒有可統計的候選時段。
        </div>
      `;
    }

    return `
      <section class="matching-matrix-panel">

        <div class="matching-matrix-heading">

          <div>
            <h3>
              媒合結果
            </h3>

            <p>
              左右滑動中間區域，
              查看每位回覆者的選擇。
            </p>
          </div>

          <button
            type="button"
            class="matching-matrix-close-button"
            onclick="toggleMatchingMatrix(false)"
          >
            收起
          </button>

        </div>

        <div class="matching-matrix-layout">

          <div class="matching-matrix-fixed-left">
            ${buildLeftTable(
              slots
            )}
          </div>

          <div class="matching-matrix-scroll-middle">
            ${buildCenterTable(
              slots,
              responses
            )}
          </div>

          <div class="matching-matrix-fixed-right">
            ${buildRightTable(
              slots,
              responses
            )}
          </div>

        </div>

      </section>
    `;
  }

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
      window.currentMatchingCar;

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

  window.toggleMatchingMatrix =
    toggleMatchingMatrix;

  window.JLYMatchingMatrix = {
    render:
      renderMatchingMatrix,

    refresh:
      refreshMatchingMatrix,

    toggle:
      toggleMatchingMatrix
  };

  console.log(
    "✅ Matching Matrix Beta V1 已載入"
  );
})();
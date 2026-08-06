(function () {
  "use strict";

  let currentCar = null;

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

  function createResponseId() {
    return (
      "response-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 9)
    );
  }

  function getResponseStorageKey(
    carId
  ) {
    return (
      "jlyMatchingResponseId:" +
      carId
    );
  }

  function getSavedResponseId(
    carId
  ) {
    return localStorage.getItem(
      getResponseStorageKey(
        carId
      )
    ) || "";
  }

  function saveResponseId(
    carId,
    responseId
  ) {
    localStorage.setItem(
      getResponseStorageKey(
        carId
      ),
      responseId
    );
  }

  function parseDateKey(
    dateKey
  ) {
    const parts =
      String(dateKey || "")
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

  function formatDate(
    dateKey
  ) {
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

    function getExistingResponse() {
    const carId =
      getCarId();

    const responseId =
      getSavedResponseId(
        carId
      );

    const matching =
      getMatching();

    const responses =
      matching &&
      matching.responses &&
      typeof matching.responses ===
        "object"
        ? matching.responses
        : {};

    if (
      !responseId ||
      !responses[responseId]
    ) {
      return null;
    }

    return responses[
      responseId
    ];
  }

  function buildSlotGroups(
    slots
  ) {
    const grouped = {};

    slots.forEach(
      function (slot) {
        if (!grouped[slot.date]) {
          grouped[slot.date] =
            [];
        }

        grouped[slot.date]
          .push(slot);
      }
    );

    return grouped;
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

    if (
      !matching ||
      matching.status !==
        "published"
    ) {
      app.innerHTML = `
        <section class="matching-vote-card">
          <div class="matching-vote-empty">
            這份時間媒合尚未開放。
          </div>
        </section>
      `;

      return;
    }

    if (
      slots.length === 0
    ) {
      app.innerHTML = `
        <section class="matching-vote-card">
          <div class="matching-vote-empty">
            目前沒有可填寫的候選時段。
          </div>
        </section>
      `;

      return;
    }

    const existing =
      getExistingResponse();

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

        <h2 class="matching-vote-title">
          請勾選你可以的時間
        </h2>

        <p class="matching-vote-description">
          可以複選多個時段。
          主揪會依大家的回覆決定最後開團時間。
        </p>

        <label
          class="matching-vote-name-label"
          for="matchingVoteName"
        >
          你的暱稱
        </label>

        <input
          id="matchingVoteName"
          class="matching-vote-name-input"
          type="text"
          value="${escapeHtml(
            existing &&
            existing.name
              ? existing.name
              : ""
          )}"
          placeholder="請輸入暱稱"
          maxlength="30"
        >

        <div class="matching-vote-days">

          ${
            Object.keys(grouped)
              .sort()
              .map(function (
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
                          .map(function (
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
                                    selectedIds
                                      .includes(
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
                          })
                          .join("")
                      }

                    </div>

                  </section>
                `;
              })
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
          主揪確認最終時間後，
          會再通知大家。
        </p>

        <button
          type="button"
          class="matching-vote-secondary"
          onclick="renderMatchingVoteForm()"
        >
          修改我的回覆
        </button>

      </section>
    `;
  }

    async function submitMatchingVote() {
    const carId =
      getCarId();

    const nameInput =
      document.getElementById(
        "matchingVoteName"
      );

    const button =
      document.getElementById(
        "matchingVoteSubmitButton"
      );

    const name =
      nameInput
        ? nameInput.value.trim()
        : "";

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

    if (!name) {
      alert(
        "請輸入你的暱稱。"
      );

      if (nameInput) {
        nameInput.focus();
      }

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

      let responseId =
        getSavedResponseId(
          carId
        );

      if (!responseId) {
        responseId =
          createResponseId();
      }

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

              name,

              slotIds,

              status:
                "submitted",

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

      saveResponseId(
        carId,
        responseId
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

      renderVoteForm();
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

            const app =
              document.getElementById(
                "matchingVoteApp"
              );

            if (app) {
              app.innerHTML = `
                <section class="matching-vote-card">
                  <div class="matching-vote-error">
                    Firebase 載入失敗，
                    請重新整理頁面。
                  </div>
                </section>
              `;
            }
          }
        },
        250
      );
  }

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
    "✅ Matching Vote V1 已載入"
  );
})();
"use strict";

console.log(
  "dm-application-actions.js V1 已成功載入！"
);

(function () {
  function text(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function esc(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getCarId() {
    return text(
      new URLSearchParams(
        location.search
      ).get("id")
    );
  }

  function getApplications(car) {
    return Array.isArray(
      car && car.dmApplications
    )
      ? car.dmApplications
      : [];
  }

  function getPending(car) {
    return getApplications(car)
      .filter(function (app) {
        return (
          app &&
          app.status === "pending"
        );
      });
  }

  function buildApplicationHtml(app) {
    const id =
      esc(app.id || "");

    const name =
      esc(
        app.displayName ||
        "未命名"
      );

    const claimText =
      app.claimType ===
        "existing_slot"
        ? (
            "認領：" +
            esc(
              (
                app.targetStaffLabel
                  ? app.targetStaffLabel +
                    "｜"
                  : ""
              ) +
              (
                app.targetStaffName ||
                "既有 DM"
              )
            )
          )
        : "新增為本場 DM";

    return `
      <div
        class="card"
        data-dm-application-id="${id}"
        style="
          margin-top:12px;
        "
      >
        <h4>
          🎭 DM 身分申請
        </h4>

        <p>
          申請人：
          <strong>
            ${name}
          </strong>
        </p>

        <p>
          ${claimText}
        </p>

        <div
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          "
        >
          <button
            type="button"
            onclick="
              JLYDmApplicationActions
                .approve(
                  '${id}'
                )
            "
          >
            核准
          </button>

          <button
            type="button"
            onclick="
              JLYDmApplicationActions
                .reject(
                  '${id}'
                )
            "
          >
            拒絕
          </button>
        </div>
      </div>
    `;
  }

  function renderIntoDetail(car) {
    const root =
      document.getElementById(
        "detailBox"
      );

    if (!root) {
      return;
    }

    const old =
      document.getElementById(
        "dmApplicationReviewSection"
      );

    if (old) {
      old.remove();
    }

    const pending =
      getPending(car);

    if (!pending.length) {
      return;
    }

    const section =
      document.createElement(
        "section"
      );

    section.id =
      "dmApplicationReviewSection";

    section.className =
      "card";

    section.innerHTML = `
      <h3>
        🎭 DM 待審核申請
      </h3>

      <p>
        核准後才會正式加入工作人員。
      </p>

      ${pending
        .map(buildApplicationHtml)
        .join("")}
    `;

    root.appendChild(
      section
    );
  }

  async function readCar() {
    const carId =
      getCarId();

    if (!window.db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    if (!carId) {
      throw new Error(
        "找不到車團 ID"
      );
    }

    const snap =
      await window.db
        .collection("cars")
        .doc(carId)
        .get();

    if (!snap.exists) {
      throw new Error(
        "找不到這台車"
      );
    }

    return {
      id: snap.id,
      ...snap.data()
    };
  }

  function createStaffSlot(
    app,
    order
  ) {
    return {
      id:
        "staff_" +
        Date.now() +
        "_" +
        Math.random()
          .toString(36)
          .slice(2, 8),

      order:
        Number(order || 1),

      label:
        "DM",

      memberId:
        text(
          app.memberId ||
          app.profileId
        ),

      displayName:
        text(
          app.displayName
        ),

      source:
        "dm_application_approved"
    };
  }

  async function approve(
    applicationId
  ) {
    const carId =
      getCarId();

    try {
      const carRef =
        window.db
          .collection("cars")
          .doc(carId);

      let resultLabel =
        "DM 已加入工作人員";

      await window.db
        .runTransaction(
          async function (
            transaction
          ) {
            const snap =
              await transaction.get(
                carRef
              );

            if (!snap.exists) {
              throw new Error(
                "找不到這台車"
              );
            }

            const car =
              snap.data() || {};

            const applications =
              getApplications(car)
                .map(function (app) {
                  return {
                    ...app
                  };
                });

            const index =
              applications
                .findIndex(
                  function (app) {
                    return (
                      text(app.id) ===
                      text(
                        applicationId
                      )
                    );
                  }
                );

            if (index < 0) {
              throw new Error(
                "找不到這筆 DM 申請"
              );
            }

            const app =
              applications[index];

            if (
              app.status !==
                "pending"
            ) {
              throw new Error(
                "這筆 DM 申請已處理"
              );
            }

            const staffSlots =
              Array.isArray(
                car.staffSlots
              )
                ? car.staffSlots.map(
                    function (slot) {
                      return {
                        ...slot
                      };
                    }
                  )
                : [];

            const memberId =
              text(
                app.memberId ||
                app.profileId
              );

            if (
              staffSlots.some(
                function (slot) {
                  return (
                    memberId &&
                    text(
                      slot.memberId
                    ) ===
                    memberId
                  );
                }
              )
            ) {
              throw new Error(
                "這位 DM 已經在工作人員名單"
              );
            }

            let linkedExisting =
              false;

            if (
              app.claimType ===
                "existing_slot" &&
              app.targetStaffId
            ) {
              const target =
                staffSlots.find(
                  function (slot) {
                    return (
                      text(slot.id) ===
                      text(
                        app.targetStaffId
                      )
                    );
                  }
                );

              if (
                target &&
                !text(
                  target.memberId
                )
              ) {
                target.memberId =
                  memberId;

                target.source =
                  "dm_application_claimed";

                if (
                  !text(
                    target.displayName
                  )
                ) {
                  target.displayName =
                    text(
                      app.displayName
                    );
                }

                if (
                  !text(
                    target.label
                  )
                ) {
                  target.label =
                    "DM";
                }

                linkedExisting =
                  true;

                resultLabel =
                  "已連結既有 DM 名單";
              }
            }

            if (!linkedExisting) {
              staffSlots.push(
                createStaffSlot(
                  app,
                  staffSlots.length +
                    1
                )
              );

              resultLabel =
                app.claimType ===
                  "existing_slot"
                  ? "原 DM 名單已被使用，已自動新增 DM 欄位"
                  : "已自動新增 DM 欄位";
            }

            applications[
              index
            ] = {
              ...app,
              status:
                "approved",
              approvedAt:
                new Date()
                  .toISOString(),
              updatedAt:
                new Date()
                  .toISOString()
            };

            const updateData = {
              staffSlots,
              dmApplications:
                applications
            };

            if (
              window.firebase &&
              window.firebase.firestore &&
              window.firebase.firestore
                .FieldValue
            ) {
              updateData.updatedAt =
                window.firebase.firestore
                  .FieldValue
                  .serverTimestamp();
            }

            transaction.update(
              carRef,
              updateData
            );
          }
        );

      alert(
        "✅ " + resultLabel
      );

      await refresh();
    } catch (error) {
      console.error(
        "核准 DM 申請失敗：",
        error
      );

      alert(
        "核准失敗：" +
        (
          error.message ||
          "未知錯誤"
        )
      );
    }
  }

  async function reject(
    applicationId
  ) {
    const carId =
      getCarId();

    try {
      const carRef =
        window.db
          .collection("cars")
          .doc(carId);

      await window.db
        .runTransaction(
          async function (
            transaction
          ) {
            const snap =
              await transaction.get(
                carRef
              );

            if (!snap.exists) {
              throw new Error(
                "找不到這台車"
              );
            }

            const car =
              snap.data() || {};

            const applications =
              getApplications(car)
                .map(function (app) {
                  return {
                    ...app
                  };
                });

            const index =
              applications
                .findIndex(
                  function (app) {
                    return (
                      text(app.id) ===
                      text(
                        applicationId
                      )
                    );
                  }
                );

            if (index < 0) {
              throw new Error(
                "找不到這筆 DM 申請"
              );
            }

            applications[
              index
            ] = {
              ...applications[index],
              status:
                "rejected",
              rejectedAt:
                new Date()
                  .toISOString(),
              updatedAt:
                new Date()
                  .toISOString()
            };

            transaction.update(
              carRef,
              {
                dmApplications:
                  applications
              }
            );
          }
        );

      alert(
        "已拒絕 DM 身分申請"
      );

      await refresh();
    } catch (error) {
      console.error(
        "拒絕 DM 申請失敗：",
        error
      );

      alert(
        "拒絕失敗：" +
        (
          error.message ||
          "未知錯誤"
        )
      );
    }
  }

  async function refresh() {
    if (
      window.JLYCarDetailController &&
      typeof window
        .JLYCarDetailController
        .refreshPage ===
          "function"
    ) {
      await window
        .JLYCarDetailController
        .refreshPage();
    }

    const car =
      await readCar();

    renderIntoDetail(
      car
    );
  }

  function init() {
    refresh()
      .catch(function (error) {
        console.warn(
          "DM Application Review 初始化失敗：",
          error
        );
      });

    document.addEventListener(
      "jly:car-detail:refreshed",
      function () {
        readCar()
          .then(
            renderIntoDetail
          )
          .catch(function (
            error
          ) {
            console.warn(
              "重新渲染 DM Application 失敗：",
              error
            );
          });
      }
    );
  }

  window.JLYDmApplicationActions = {
    approve,
    reject,
    renderIntoDetail,
    refresh
  };

  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();

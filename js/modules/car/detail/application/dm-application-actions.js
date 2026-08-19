"use strict";

console.log(
  "dm-application-actions.js V2 已成功載入！"
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

  function list(value) {
    return Array.isArray(value)
      ? value
      : [];
  }

  function getCarId() {
    const params =
      new URLSearchParams(
        location.search
      );

    return text(
      params.get("id") ||
      params.get("carId")
    );
  }

  function getPendingApplications(
    car
  ) {
    return list(
      car && car.dmApplications
    ).filter(
      function (app) {
        return (
          app &&
          app.status === "pending"
        );
      }
    );
  }

  function buildApplicationCard(
    app
  ) {
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
        class="player-card"
        data-dm-application-id="${id}"
      >
        <p>
          🎭 <strong>${name}</strong>
        </p>

        <p>
          ${claimText}
        </p>

        <div class="row">
          <button
            type="button"
            onclick="
              JLYDmApplicationActions
                .approve('${id}')
            "
          >
            ✅ 核准
          </button>

          <button
            type="button"
            class="danger"
            onclick="
              JLYDmApplicationActions
                .reject('${id}')
            "
          >
            ❌ 拒絕
          </button>
        </div>
      </div>
    `;
  }

  function buildSectionHtml(
    car
  ) {
    const pending =
      getPendingApplications(
        car
      );

    if (
      pending.length === 0
    ) {
      return "";
    }

    return `
      <div
        class="card"
        id="dmApplicationReviewSection"
      >
        <h3>
          🎭 DM 待審核
        </h3>

        <p class="empty-text">
          核准後才會正式加入工作人員。
        </p>

        ${pending
          .map(
            buildApplicationCard
          )
          .join("")}
      </div>
    `;
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

  async function refreshDetail() {
    if (
      window.JLYCarDetailController &&
      typeof window
        .JLYCarDetailController
        .refreshPage === "function"
    ) {
      await window
        .JLYCarDetailController
        .refreshPage();

      return;
    }

    if (
      typeof window
        .renderCarDetail === "function"
    ) {
      await window
        .renderCarDetail();
    }
  }

  async function approve(
    applicationId
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

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      let resultText =
        "DM 已加入工作人員";

      await db.runTransaction(
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
            list(
              car.dmApplications
            ).map(
              function (app) {
                return {
                  ...app
                };
              }
            );

          const index =
            applications.findIndex(
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
            app.status !== "pending"
          ) {
            throw new Error(
              "這筆 DM 申請已經處理"
            );
          }

          const staffSlots =
            list(
              car.staffSlots
            ).map(
              function (slot) {
                return {
                  ...slot
                };
              }
            );

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
                  ) === memberId
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

              resultText =
                "已連結既有 DM";
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

            resultText =
              "已新增 DM 工作人員位置";
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
        "✅ " + resultText
      );

      await refreshDetail();
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
    const db =
      window.db;

    const carId =
      getCarId();

    if (!db || !carId) {
      alert(
        "車團資料尚未載入"
      );
      return;
    }

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      await db.runTransaction(
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
            list(
              car.dmApplications
            ).map(
              function (app) {
                return {
                  ...app
                };
              }
            );

          const index =
            applications.findIndex(
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

      await refreshDetail();
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

  window.JLYDmApplicationActions = {
    getPendingApplications,
    buildSectionHtml,
    approve,
    reject
  };
})();

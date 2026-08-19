"use strict";

console.log(
  "dm-join.js V2 已成功載入！"
);

let currentCar = null;
let currentCarId = "";
let currentMember = null;

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
  const p =
    new URLSearchParams(
      location.search
    );

  return text(
    p.get("id") ||
    p.get("carId")
  );
}

function getIdentityIds() {
  if (
    window.JLYIdentity &&
    typeof window.JLYIdentity
      .getAllPlayerIdentityIds ===
        "function"
  ) {
    return window.JLYIdentity
      .getAllPlayerIdentityIds()
      .map(text)
      .filter(Boolean);
  }

  return [
    localStorage.getItem(
      "currentPlayerProfileId"
    ),
    localStorage.getItem(
      "currentPlayerId"
    )
  ]
    .map(text)
    .filter(Boolean);
}

async function getMember() {
  const profileId =
    text(
      localStorage.getItem(
        "currentPlayerProfileId"
      )
    );

  if (!profileId || !window.db) {
    return null;
  }

  const snap =
    await window.db
      .collection("players")
      .doc(profileId)
      .get();

  if (!snap.exists) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data()
  };
}

function getDisplayName(member) {
  return (
    text(
      member &&
      (
        member.displayName ||
        member.nickname ||
        member.name
      )
    ) ||
    text(
      localStorage.getItem(
        "currentPlayerName"
      )
    ) ||
    "我的 JLY 身分"
  );
}

function getStaffSlots(car) {
  return Array.isArray(
    car && car.staffSlots
  )
    ? car.staffSlots
    : [];
}

function isDmLike(slot) {
  const label =
    text(
      slot &&
      (
        slot.label ||
        slot.roleLabel ||
        slot.title
      )
    ).toLowerCase();

  return (
    !label ||
    label.includes("dm")
  );
}

function getClaimableDmSlots(car) {
  return getStaffSlots(car)
    .filter(function (slot) {
      return (
        isDmLike(slot) &&
        !text(
          slot && slot.memberId
        ) &&
        text(
          slot && slot.displayName
        )
      );
    });
}

function findExistingStaff(
  car,
  identityIds
) {
  const ids =
    new Set(
      identityIds
        .map(text)
        .filter(Boolean)
    );

  return getStaffSlots(car)
    .find(function (slot) {
      const memberId =
        text(
          slot && slot.memberId
        );

      return (
        memberId &&
        ids.has(memberId)
      );
    }) || null;
}

function getDmApplications(car) {
  return Array.isArray(
    car && car.dmApplications
  )
    ? car.dmApplications
    : [];
}

function findPendingApplication(
  car,
  identityIds
) {
  const ids =
    new Set(
      identityIds
        .map(text)
        .filter(Boolean)
    );

  return getDmApplications(car)
    .find(function (app) {
      if (
        !app ||
        app.status !== "pending"
      ) {
        return false;
      }

      return [
        app.memberId,
        app.profileId,
        app.identityId
      ]
        .map(text)
        .some(function (id) {
          return (
            id &&
            ids.has(id)
          );
        });
    }) || null;
}

function startDmLineLogin() {
  if (
    !window.JLYLineLogin ||
    typeof window.JLYLineLogin
      .start !== "function"
  ) {
    alert(
      "LINE 登入模組尚未載入"
    );
    return;
  }

  window.JLYLineLogin.start({
    returnUrl:
      location.pathname +
      location.search
  });
}

function renderLogin(car) {
  document
    .getElementById("dmJoinBox")
    .innerHTML = `
      <h2>
        ${esc(
          car.scriptName ||
          car.name ||
          "這台車"
        )}
      </h2>

      <p>
        請先使用 LINE 登入，
        JLY 才能確認你的正式身分。
      </p>

      <button
        type="button"
        class="primary"
        onclick="startDmLineLogin()"
      >
        使用 LINE 登入
      </button>
    `;
}

function renderAlreadyJoined(
  car,
  slot
) {
  document
    .getElementById("dmJoinBox")
    .innerHTML = `
      <h2>
        ${esc(
          car.scriptName ||
          car.name ||
          "這台車"
        )}
      </h2>

      <p>
        ✅ 你的 JLY 身分已經是本場工作人員。
      </p>

      <p>
        <strong>
          ${esc(slot.label || "DM")}
        </strong>
        ${esc(
          slot.displayName || ""
        )}
      </p>
    `;
}

function renderPending(
  car,
  app
) {
  const target =
    app.claimType ===
      "existing_slot"
      ? (
          "認領：" +
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
      : "新增為本場 DM";

  document
    .getElementById("dmJoinBox")
    .innerHTML = `
      <h2>
        ${esc(
          car.scriptName ||
          car.name ||
          "這台車"
        )}
      </h2>

      <p>
        🟡 DM 身分申請已送出，
        目前等待主揪審核。
      </p>

      <p>
        ${esc(target)}
      </p>
    `;
}

function renderReady(
  car,
  member
) {
  const slots =
    getClaimableDmSlots(car);

  const slotChoices =
    slots
      .map(function (
        slot,
        index
      ) {
        const label =
          text(slot.label) ||
          "DM";

        return `
          <label
            class="checkbox-row"
            style="
              display:block;
              margin:10px 0;
            "
          >
            <input
              type="radio"
              name="dmClaimChoice"
              value="existing"
              data-staff-id="${esc(
                slot.id || ""
              )}"
            >
            我是
            <strong>
              ${esc(label)}
              ｜${esc(
                slot.displayName
              )}
            </strong>
          </label>
        `;
      })
      .join("");

  document
    .getElementById("dmJoinBox")
    .innerHTML = `
      <h2>
        ${esc(
          car.scriptName ||
          car.name ||
          "這台車"
        )}
      </h2>

      <p>
        JLY 身分：
        <strong>
          ${esc(
            getDisplayName(member)
          )}
        </strong>
      </p>

      <p>
        請選擇你在這台車的 DM 身分。
        送出後會由主揪審核，
        不會直接加入工作人員。
      </p>

      ${
        slotChoices
          ? `
            <div
              style="
                margin:14px 0;
                padding:12px;
                border:1px solid #eee;
                border-radius:12px;
              "
            >
              <strong>
                已有但尚未綁定的 DM
              </strong>

              ${slotChoices}
            </div>
          `
          : ""
      }

      <label
        class="checkbox-row"
        style="
          display:block;
          margin:12px 0;
        "
      >
        <input
          type="radio"
          name="dmClaimChoice"
          value="new"
          checked
        >
        名單沒有我，新增我
      </label>

      <button
        id="submitDmApplication"
        type="button"
        class="primary"
        onclick="submitDmApplication()"
      >
        🎭 送出 DM 身分申請
      </button>
    `;
}

function getSelectedClaim() {
  const selected =
    document.querySelector(
      'input[name="dmClaimChoice"]:checked'
    );

  if (!selected) {
    return {
      claimType: "new"
    };
  }

  if (
    selected.value ===
      "existing"
  ) {
    return {
      claimType:
        "existing_slot",

      targetStaffId:
        text(
          selected.dataset
            .staffId
        )
    };
  }

  return {
    claimType:
      "new"
  };
}

async function loadDmJoinPage() {
  const box =
    document.getElementById(
      "dmJoinBox"
    );

  try {
    currentCarId =
      getCarId();

    if (!currentCarId) {
      throw new Error(
        "報名連結缺少車團 ID"
      );
    }

    if (!window.db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    const snap =
      await window.db
        .collection("cars")
        .doc(currentCarId)
        .get();

    if (!snap.exists) {
      throw new Error(
        "找不到這台車"
      );
    }

    currentCar = {
      id: snap.id,
      ...snap.data()
    };

    const identityIds =
      getIdentityIds();

    const existing =
      findExistingStaff(
        currentCar,
        identityIds
      );

    if (existing) {
      renderAlreadyJoined(
        currentCar,
        existing
      );

      return;
    }

    currentMember =
      await getMember();

    if (!currentMember) {
      renderLogin(
        currentCar
      );

      return;
    }

    const memberIds =
      Array.from(
        new Set([
          ...identityIds,
          currentMember.id
        ]
          .map(text)
          .filter(Boolean))
      );

    const pending =
      findPendingApplication(
        currentCar,
        memberIds
      );

    if (pending) {
      renderPending(
        currentCar,
        pending
      );

      return;
    }

    renderReady(
      currentCar,
      currentMember
    );
  } catch (error) {
    console.error(
      "讀取 DM 身分申請頁失敗：",
      error
    );

    if (box) {
      box.innerHTML = `
        <h3>讀取失敗</h3>
        <p>
          ${esc(
            error.message ||
            "未知錯誤"
          )}
        </p>
      `;
    }
  }
}

async function submitDmApplication() {
  const button =
    document.getElementById(
      "submitDmApplication"
    );

  try {
    if (button) {
      button.disabled = true;
      button.textContent =
        "送出中...";
    }

    const member =
      currentMember ||
      await getMember();

    if (!member) {
      alert(
        "請先完成 LINE 登入"
      );

      return;
    }

    const memberId =
      text(
        localStorage.getItem(
          "currentPlayerProfileId"
        )
      ) ||
      text(member.id);

    const displayName =
      getDisplayName(member);

    if (!memberId) {
      throw new Error(
        "找不到你的 JLY Person ID"
      );
    }

    const claim =
      getSelectedClaim();

    const carRef =
      window.db
        .collection("cars")
        .doc(currentCarId);

    await window.db.runTransaction(
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

        const car = {
          id: snap.id,
          ...snap.data()
        };

        const ids =
          Array.from(
            new Set([
              ...getIdentityIds(),
              memberId,
              member.id
            ]
              .map(text)
              .filter(Boolean))
          );

        if (
          findExistingStaff(
            car,
            ids
          )
        ) {
          throw new Error(
            "你已經是這台車的工作人員"
          );
        }

        if (
          findPendingApplication(
            car,
            ids
          )
        ) {
          throw new Error(
            "你已經送出 DM 身分申請"
          );
        }

        const applications =
          getDmApplications(car)
            .map(function (app) {
              return {
                ...app
              };
            });

        let targetStaffId = "";
        let targetStaffName = "";
        let targetStaffLabel = "";

        if (
          claim.claimType ===
            "existing_slot"
        ) {
          const target =
            getClaimableDmSlots(car)
              .find(
                function (slot) {
                  return (
                    text(slot.id) ===
                    text(
                      claim.targetStaffId
                    )
                  );
                }
              );

          if (!target) {
            throw new Error(
              "這個 DM 名單已被其他人綁定，請重新選擇"
            );
          }

          targetStaffId =
            text(target.id);

          targetStaffName =
            text(
              target.displayName
            );

          targetStaffLabel =
            text(target.label) ||
            "DM";
        }

        applications.push({
          id:
            "dm_app_" +
            Date.now() +
            "_" +
            Math.random()
              .toString(36)
              .slice(2, 8),

          applicationType:
            "dm",

          participantRole:
            "dm",

          status:
            "pending",

          memberId,
          profileId:
            text(member.id),
          displayName,

          claimType:
            claim.claimType,

          targetStaffId,
          targetStaffName,
          targetStaffLabel,

          source:
            "dm_join_page",

          createdAt:
            new Date()
              .toISOString(),

          updatedAt:
            new Date()
              .toISOString()
        });

        const updateData = {
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
      "🎭 DM 身分申請已送出！等待主揪審核。"
    );

    await loadDmJoinPage();
  } catch (error) {
    console.error(
      "DM 身分申請失敗：",
      error
    );

    alert(
      "DM 身分申請失敗：" +
      (
        error.message ||
        "未知錯誤"
      )
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "🎭 送出 DM 身分申請";
    }
  }
}

window.startDmLineLogin =
  startDmLineLogin;

window.submitDmApplication =
  submitDmApplication;

if (
  document.readyState ===
    "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    loadDmJoinPage
  );
} else {
  loadDmJoinPage();
}

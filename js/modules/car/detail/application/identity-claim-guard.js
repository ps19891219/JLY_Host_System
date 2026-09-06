"use strict";

(function () {
  function text(value) { return String(value == null ? "" : value).trim(); }
  function esc(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function list(value) { return Array.isArray(value) ? value : []; }
  function getCarId() {
    const params = new URLSearchParams(location.search);
    return text(params.get("id") || params.get("carId"));
  }
  function isSynthetic(value) { return /^line:/i.test(text(value)); }
  function isUnsafeLegacyProvisional(app) {
    if (!app || !text(app.lineUserId)) return false;
    if (app.source === "car_view_identity_claim") return false;
    return isSynthetic(app.memberId) || isSynthetic(app.profileId) || app.provisionalIdentity === true;
  }
  function claimant(app) {
    return text(app && (app.lineDisplayName || app.claimantDisplayName || app.displayName));
  }
  function targetName(app, role) {
    if (role === "dm") return text(app && app.targetStaffName);
    return text(app && app.targetPlayerName);
  }
  function isExistingClaim(app) {
    return Boolean(app && ["existing_person", "existing_slot"].includes(text(app.claimType)));
  }
  function claimReviewLabel(app, role) {
    const who = claimant(app) || "LINE 使用者";
    const target = targetName(app, role);
    if (isExistingClaim(app) && target) {
      return `LINE「${who}」→ 認領「${target}」`;
    }
    if (app && app.claimType === "new_person") {
      return `LINE「${who}」→ 名單沒有我／申請新增 Person`;
    }
    return who;
  }

  async function loadCar() {
    const db = window.db;
    if (!db) throw new Error("Firebase 尚未載入");
    const snap = await db.collection("cars").doc(getCarId()).get();
    return snap.exists ? snap.data() || {} : null;
  }

  function installApprovalGuards() {
    const playerActions = window.JLYCarDetailApplicationActions;
    const dmActions = window.JLYDmApplicationActions;
    if (!playerActions || !dmActions) return;

    const playerApprove = playerActions.approveApplication.bind(playerActions);
    playerActions.approveApplication = async function (index) {
      try {
        const car = await loadCar();
        const app = car && list(car.applications)[Number(index)];
        if (isUnsafeLegacyProvisional(app)) {
          alert("這是舊版 provisional LINE 申請，當時尚未選擇要認領的 Person。為避免 line:* 變成正式 Person ID，這筆不能直接核准；請拒絕後讓使用者從新版車團頁重新選擇『我是 XXX』或『名單沒有我』。");
          return;
        }
      } catch (error) {
        console.warn("檢查舊版玩家 provisional 申請失敗：", error);
      }
      return playerApprove(index);
    };

    const dmApprove = dmActions.approve.bind(dmActions);
    dmActions.approve = async function (applicationId) {
      try {
        const car = await loadCar();
        const app = car && list(car.dmApplications).find(item => text(item.id) === text(applicationId));
        if (isUnsafeLegacyProvisional(app)) {
          alert("這是舊版 provisional LINE DM 申請，當時尚未選擇要認領的 Person。為避免 line:* 進入正式 Staff Membership，這筆不能直接核准；請拒絕後讓使用者從新版車團頁重新選擇既有 DM／工作人員名字。");
          return;
        }
      } catch (error) {
        console.warn("檢查舊版 DM provisional 申請失敗：", error);
      }
      return dmApprove(applicationId);
    };
  }

  function installPlayerReviewLabel() {
    if (typeof window.buildApplicationsHtml !== "function" || window.buildApplicationsHtml.__identityClaimReviewWrapped) return;
    const original = window.buildApplicationsHtml;
    const wrapped = function (applications) {
      const mapped = list(applications).map(function (app) {
        if (!app || app.source !== "car_view_identity_claim") return app;
        const label = claimReviewLabel(app, "player");
        return {
          ...app,
          name: label,
          playerName: label,
          displayName: label
        };
      });
      return original(mapped);
    };
    wrapped.__identityClaimReviewWrapped = true;
    window.buildApplicationsHtml = wrapped;
  }

  function installDmReviewUi() {
    const actions = window.JLYDmApplicationActions;
    if (!actions || typeof actions.buildSectionHtml !== "function") return;
    const original = actions.buildSectionHtml.bind(actions);
    actions.buildSectionHtml = function (car) {
      const pending = list(car && car.dmApplications).filter(app => app && app.status === "pending");
      if (!pending.some(app => app.source === "car_view_identity_claim" || isUnsafeLegacyProvisional(app))) {
        return original(car);
      }
      if (!pending.length) return "";
      const cards = pending.map(function (app) {
        const id = esc(app.id);
        const label = app.source === "car_view_identity_claim"
          ? claimReviewLabel(app, "dm")
          : `舊版 LINE「${claimant(app) || "使用者"}」申請，需拒絕後重新認領`;
        const role = app.source === "car_view_identity_claim" && isExistingClaim(app)
          ? `角色：本場 DM／工作人員${text(app.targetStaffLabel) ? `（${text(app.targetStaffLabel)}）` : ""}`
          : "角色：本場 DM";
        return `
          <div class="player-card" data-dm-application-id="${id}">
            <p>🎭 <strong>${esc(label)}</strong></p>
            <p>${esc(role)}</p>
            <div class="row">
              <button type="button" onclick="JLYDmApplicationActions.approve('${id}')">✅ 核准</button>
              <button type="button" class="danger" onclick="JLYDmApplicationActions.reject('${id}')">❌ 拒絕</button>
            </div>
          </div>`;
      }).join("");
      return `
        <div class="card" id="dmApplicationReviewSection">
          <h3>🎭 DM 身分認領待審核</h3>
          <p class="empty-text">核准後才會正式把 LINE Identity 綁到 Person，並確認本場 Membership。</p>
          ${cards}
        </div>`;
    };
  }

  installApprovalGuards();
  installPlayerReviewLabel();
  installDmReviewUi();
  window.JLYIdentityClaimGuard = { isUnsafeLegacyProvisional, claimReviewLabel };
})();

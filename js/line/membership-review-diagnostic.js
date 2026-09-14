(function () {
  "use strict";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function identityIds() {
    const ids = new Set();
    const identity = window.JLYIdentity;
    const add = value => {
      const id = text(value);
      if (id) ids.add(id);
    };
    const addMany = values => (Array.isArray(values) ? values : []).forEach(add);

    if (identity) {
      if (typeof identity.getCurrentPlayerId === "function") add(identity.getCurrentPlayerId());
      if (typeof identity.getCurrentPlayerProfileId === "function") add(identity.getCurrentPlayerProfileId());
      if (typeof identity.getAllPlayerIdentityIds === "function") addMany(identity.getAllPlayerIdentityIds());
      if (typeof identity.getLinkedPlayerIds === "function") addMany(identity.getLinkedPlayerIds());
    }

    try {
      add(localStorage.getItem("currentPlayerId"));
      add(localStorage.getItem("currentPlayerProfileId"));
    } catch (_) {}

    return Array.from(ids);
  }

  async function loadSnapshots() {
    if (!window.db) return [];
    const map = new Map();

    for (const ownerId of identityIds()) {
      try {
        const snap = await window.db
          .collection("lineGroupMembershipSnapshots")
          .where("ownerId", "==", ownerId)
          .get();

        snap.docs.forEach(doc => map.set(doc.id, { id: doc.id, ...(doc.data() || {}) }));
      } catch (error) {
        console.warn("LINE membership diagnostic snapshot read skipped", ownerId, error);
      }
    }

    return Array.from(map.values());
  }

  function diagnosticHtml(row) {
    const groupId = text(row.groupId || row.id);
    const apiCountAvailable = row.lineMemberCountStatus !== "unavailable" && row.lineMemberCount != null;
    const apiCount = apiCountAvailable ? Number(row.lineMemberCount) : null;
    const idsAvailable = row.lineMemberIdsStatus === "available" && Array.isArray(row.lineUserIds);
    const idsCount = idsAvailable ? row.lineUserIds.length : null;
    const mismatch = apiCountAvailable && idsAvailable && apiCount !== idsCount;
    const groupName = text(row.lineGroupName || row.groupName);

    return `
      <div class="line-api-diagnostic" style="margin:10px 0;padding:10px;border-radius:10px;background:#fff8e8;font-size:13px;line-height:1.7;">
        <strong>LINE 即時抓取診斷</strong><br>
        ${groupName ? `群組名稱：${escapeHtml(groupName)}<br>` : ""}
        groupId：<code>${escapeHtml(groupId)}</code><br>
        /members/count：${apiCountAvailable ? apiCount + " 人" : "未取得"}<br>
        /members/ids：${idsAvailable ? idsCount + " 人" : "未取得"}<br>
        ${mismatch
          ? `<strong>⚠️ LINE 兩個官方端點回傳人數不一致，這筆不可直接視為正確。</strong>`
          : apiCountAvailable && idsAvailable
            ? `兩個 LINE 官方端點目前一致。若 LINE App 實際人數仍不同，優先檢查是否綁到錯的群組。`
            : `目前資料不足，請按「重新抓取 LINE 最新名單」再核對。`}
      </div>
    `;
  }

  async function enhance() {
    const rows = await loadSnapshots();
    rows.forEach(row => {
      const groupId = text(row.groupId || row.id);
      if (!groupId) return;
      const card = document.getElementById(`review-${groupId}`);
      if (!card) return;

      const old = card.querySelector(".line-api-diagnostic");
      if (old) old.remove();

      const actions = card.querySelector(".review-actions");
      const holder = document.createElement("div");
      holder.innerHTML = diagnosticHtml(row).trim();
      const block = holder.firstElementChild;
      if (actions) card.insertBefore(block, actions);
      else card.appendChild(block);
    });
  }

  function scheduleEnhance() {
    clearTimeout(scheduleEnhance.timer);
    scheduleEnhance.timer = setTimeout(() => enhance().catch(console.error), 80);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const list = document.getElementById("reviewList");
    if (list) {
      new MutationObserver(scheduleEnhance).observe(list, { childList: true, subtree: true });
    }
    scheduleEnhance();
  });
})();

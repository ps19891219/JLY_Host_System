"use strict";

(function () {
  function currentOwnerId() {
    if (window.JLYIdentity && typeof window.JLYIdentity.getCurrentPlayerId === "function") {
      return String(window.JLYIdentity.getCurrentPlayerId() || "").trim();
    }
    return String(localStorage.getItem("currentPlayerId") || "").trim();
  }

  function installCard() {
    const heading = Array.from(document.querySelectorAll(".card h2"))
      .find(node => String(node.textContent || "").includes("待我處理"));
    const card = heading && heading.parentElement;
    if (!card || document.getElementById("lineMembershipPendingButton")) return;
    const button = document.createElement("button");
    button.id = "lineMembershipPendingButton";
    button.type = "button";
    button.style.cssText = "width:100%;text-align:left;margin-bottom:10px;";
    button.innerHTML = "👥 LINE 名單核對 <strong id=\"lineMembershipPendingCount\" style=\"float:right\">0</strong><div id=\"lineMembershipPendingText\" style=\"margin-top:4px;font-size:13px;opacity:.7\">目前無待處理</div>";
    button.addEventListener("click", function () {
      location.href = "pages/line-membership-review.html";
    });
    const firstButton = card.querySelector("button");
    if (firstButton) card.insertBefore(button, firstButton);
    else card.appendChild(button);
  }

  async function render() {
    installCard();
    const ownerId = currentOwnerId();
    const count = document.getElementById("lineMembershipPendingCount");
    const text = document.getElementById("lineMembershipPendingText");
    if (!ownerId || !window.db) return;
    try {
      const snapshot = await window.db.collection("lineGroupMembershipSnapshots")
        .where("ownerId", "==", ownerId).get();
      const pending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => item.status === "needs_review");
      if (count) count.textContent = String(pending.length);
      if (text) text.textContent = pending.length > 0 ? `${pending.length} 個群組需要核對` : "目前無待處理";
      if (pending.length === 1) {
        const item = pending[0];
        document.getElementById("lineMembershipPendingButton").onclick = function () {
          location.href = `pages/line-membership-review.html?carId=${encodeURIComponent(item.carId || "")}&groupId=${encodeURIComponent(item.groupId || item.id)}`;
        };
      }
    } catch (error) {
      console.error("LINE membership pending read failed.", error);
      if (text) text.textContent = "名單提醒讀取失敗";
    }
  }

  document.addEventListener("DOMContentLoaded", render);
})();

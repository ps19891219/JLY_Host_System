"use strict";

(function () {
  const params = new URLSearchParams(location.search);
  const carId = String(params.get("id") || "").trim();
  const groupId = String(params.get("groupId") || "").trim();
  if (params.get("lineReview") !== "1" || !carId || !groupId) return;

  function reviewUrl() {
    return `/pages/line-membership-review.html?carId=${encodeURIComponent(carId)}&groupId=${encodeURIComponent(groupId)}`;
  }
  async function verify() {
    const button = document.getElementById("lineReviewVerifyButton");
    if (button) button.disabled = true;
    try {
      const response = await fetch("/api/line-group-pairing-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", carId, groupId })
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.result || !data.result.verified) throw new Error(data.error || "verify_failed");
      location.href = reviewUrl();
    } catch (error) {
      console.error(error);
      alert("確認失敗，請稍後再試。");
      if (button) button.disabled = false;
    }
  }
  function mount() {
    if (document.getElementById("lineMembershipReviewPanel")) return;
    const container = document.querySelector(".container");
    const detail = document.getElementById("detailBox");
    if (!container || !detail) return;
    const panel = document.createElement("section");
    panel.id = "lineMembershipReviewPanel";
    panel.style.cssText = "position:sticky;top:0;z-index:30;background:#f2fbf6;border:1px solid #78b596;border-radius:14px;padding:12px;margin:8px 0 14px;box-shadow:0 4px 14px rgba(0,0,0,.08)";
    panel.innerHTML = `<div style="font-weight:800;margin-bottom:5px">LINE 名單核對中</div><div style="font-size:14px;line-height:1.55;margin-bottom:10px">請確認這台車目前的玩家／人員配置。確認代表目前實際狀態正確，不要求 LINE 人數與玩家人數相等。</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="lineReviewVerifyButton" type="button" style="flex:1;min-width:190px">✓ 確認目前人員名單</button><button id="lineReviewBackButton" type="button" style="flex:1;min-width:150px">← 返回核對清單</button></div>`;
    container.insertBefore(panel, detail);
    document.getElementById("lineReviewVerifyButton").addEventListener("click", verify);
    document.getElementById("lineReviewBackButton").addEventListener("click", () => { location.href = reviewUrl(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
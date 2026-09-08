(function () {
  "use strict";

  function pairingError(result, response) {
    const error = new Error(result && result.error || "pairing_code_failed");
    error.code = result && result.error || "pairing_code_failed";
    error.status = response && response.status || 0;
    error.details = result || {};
    return error;
  }

  async function getCommand(carId) {
    const response = await fetch("/api/line-group-pairing-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ carId: String(carId || "").trim() })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw pairingError(result, response);
    return result.command;
  }

  function errorMessage(error) {
    switch (error && error.code) {
      case "line_login_required":
        return "這個瀏覽器尚未登入 JLY LINE 身份。請先用同一個瀏覽器完成 LINE 登入，再回來產生配對碼。";
      case "line_identity_unlinked":
        return "目前登入的 LINE 尚未連結到 JLY Person，請先完成身份連結。";
      case "owner_required":
        return "目前登入的 JLY Person 不是這台車的管理身份，暫時無法產生配對碼。";
      case "owner_identity_conflict":
        return "這台車的歷史 Person 身份資料有衝突，系統已停止自動判定，避免綁錯人。";
      case "owner_identity_required":
        return "找不到可用的正式 Person 身份，暫時無法產生配對碼。";
      case "car_not_found":
        return "找不到這台車，請重新整理後再試。";
      default:
        return "配對碼產生失敗，請稍後再試。";
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  async function copyLineGroupBindingCommand(carId, button) {
    if (!String(carId || "").trim()) return;
    try {
      if (button) { button.disabled = true; button.textContent = "正在產生配對碼…"; }
      const command = await getCommand(carId);
      await copyText(command);
      const originalText = button && button.textContent;
      if (button) {
        button.textContent = "已複製，請貼到 LINE 群組";
        window.setTimeout(function () { button.textContent = originalText; button.disabled = false; }, 2200);
      }
    } catch (error) {
      console.error("複製 LINE 群組綁定指令失敗", error);
      if (button) { button.textContent = "產生 LINE 群組配對碼"; button.disabled = false; }
      window.alert(errorMessage(error));
    }
  }

  function loadMembershipReviewControls() {
    const params = new URLSearchParams(location.search);
    if (params.get("lineReview") !== "1" || !params.get("groupId")) return;
    if (document.querySelector('script[data-jly-line-review]')) return;
    const script = document.createElement("script");
    script.src = "/js/line/car-detail-membership-review.js?v=1";
    script.dataset.jlyLineReview = "1";
    document.head.appendChild(script);
  }

  window.copyLineGroupBindingCommand = copyLineGroupBindingCommand;
  window.JLYLineGroupBindingActions = { getCommand, copyLineGroupBindingCommand, errorMessage };
  loadMembershipReviewControls();
})();

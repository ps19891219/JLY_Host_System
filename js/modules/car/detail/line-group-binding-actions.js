(function () {
  "use strict";

  async function getCommand(carId) {
    const response = await fetch("/api/line-group-pairing-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carId: String(carId || "").trim() })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "pairing_code_failed");
    return result.command;
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
      window.alert("配對碼產生失敗，請稍後再試。");
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
  window.JLYLineGroupBindingActions = { getCommand, copyLineGroupBindingCommand };
  loadMembershipReviewControls();
})();
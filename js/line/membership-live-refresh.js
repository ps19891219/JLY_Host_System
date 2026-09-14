"use strict";

(function () {
  async function callRefresh() {
    const response = await fetch("/api/line-group-pairing-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh", limit: 20 })
    });
    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }
    if (!response.ok || !data.success) {
      const error = new Error(data.error || `request_failed_${response.status}`);
      error.data = data;
      throw error;
    }
    return data;
  }

  function install() {
    const oldButton = document.getElementById("catchupButton");
    if (!oldButton || oldButton.dataset.liveRefreshInstalled === "1") return;

    const button = oldButton.cloneNode(true);
    button.dataset.liveRefreshInstalled = "1";
    button.textContent = "重新抓取 LINE 群組名單";
    oldButton.replaceWith(button);

    button.addEventListener("click", async function () {
      const status = document.getElementById("reviewStatus");
      const diagnostic = document.getElementById("catchupDiagnostic");
      button.disabled = true;
      if (status) status.textContent = "正在向 LINE 重新抓取目前群組人員並比對異動…";
      try {
        const result = await callRefresh();
        const d = result.diagnostics || {};
        if (diagnostic) {
          diagnostic.innerHTML = `
            <div class="diagnostic">
              <strong>這次重新抓取結果</strong>
              已重新抓取：${Number(d.refreshed) || 0} 團<br>
              發現人員異動：${Number(d.changed) || 0} 團<br>
              無異動：${Number(d.unchanged) || 0} 團<br>
              抓取失敗：${Number(d.failed) || 0} 團
            </div>
          `;
        }
        if (status) {
          status.textContent = Number(d.changed) > 0
            ? `✅ 已抓到 ${Number(d.changed)} 個群組有人員異動，正在更新核對名單…`
            : "✅ 已重新抓取，目前沒有新的群組人員異動。";
        }
        setTimeout(function () {
          location.reload();
        }, 450);
      } catch (error) {
        console.error("LINE live roster refresh failed", error);
        if (status) status.textContent = "LINE 群組名單重新抓取失敗，請稍後再試。";
        button.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();

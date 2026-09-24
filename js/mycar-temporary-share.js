(function () {
  "use strict";

  function selectedIds() {
    return typeof selectedCars !== "undefined"
      ? Array.from(selectedCars)
      : [];
  }

  function refreshButton() {
    const button = document.getElementById("batchTemporaryShareButton");
    if (!button) return;

    const count = selectedIds().length;
    button.disabled = count === 0;
    button.textContent =
      "🔗 產生臨時揪團連結（" + count + "）";
  }

  function removeModal() {
    document.getElementById("mycarTemporaryShareBackdrop")?.remove();
  }

  function option(value, label, selected) {
    return (
      '<option value="' + value + '"' +
      (selected ? " selected" : "") +
      ">" + label + "</option>"
    );
  }

  function open() {
    const ids = selectedIds();

    if (!ids.length) {
      alert("請先勾選要分享的車團");
      return;
    }

    if (
      !window.JLYRecruitShareData ||
      typeof window.JLYRecruitShareData.createSelectedShareToken !== "function"
    ) {
      alert("臨時揪團分享模組尚未載入");
      return;
    }

    removeModal();

    const backdrop = document.createElement("div");
    backdrop.id = "mycarTemporaryShareBackdrop";
    backdrop.className = "recruit-share-backdrop";
    backdrop.innerHTML =
      '<div class="recruit-share-modal" role="dialog" aria-modal="true">' +
        '<div class="recruit-share-header">' +
          "<h2>🔗 臨時揪團連結</h2>" +
          '<button type="button" class="recruit-share-close" id="mycarTemporaryShareClose">×</button>' +
        "</div>" +
        '<div class="recruit-share-content">' +
          "<p>目前跨頁共選取 <strong>" + ids.length + "</strong> 台車。連結只會顯示這批車團。</p>" +
          '<label for="mycarTemporaryShareExpiry">連結有效期限</label>' +
          '<select id="mycarTemporaryShareExpiry">' +
            option("1", "1 天", false) +
            option("3", "3 天", false) +
            option("7", "7 天", true) +
            option("14", "14 天", false) +
            option("30", "30 天", false) +
            option("never", "不自動過期", false) +
          "</select>" +
          '<button type="button" class="recruit-share-primary" id="mycarTemporaryShareCreate">🔗 建立並複製連結</button>' +
          '<button type="button" class="recruit-share-secondary" id="mycarTemporaryShareCancel">取消</button>' +
        "</div>" +
      "</div>";

    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) removeModal();
    });

    document.body.appendChild(backdrop);
    document.getElementById("mycarTemporaryShareClose")?.addEventListener("click", removeModal);
    document.getElementById("mycarTemporaryShareCancel")?.addEventListener("click", removeModal);
    document.getElementById("mycarTemporaryShareCreate")?.addEventListener("click", create);
  }

  async function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    if (!ok) throw new Error("無法複製連結");
  }

  async function create() {
    const ids = selectedIds();
    const button = document.getElementById("mycarTemporaryShareCreate");
    const expiry = document.getElementById("mycarTemporaryShareExpiry")?.value || "7";

    if (!ids.length) {
      alert("目前沒有選取車團");
      removeModal();
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "正在建立連結…";
    }

    try {
      const result = await window.JLYRecruitShareData.createSelectedShareToken(
        ids,
        expiry === "never" ? "never" : Number(expiry)
      );

      await copyText(result.shareUrl);
      removeModal();

      alert(
        "✅ 臨時揪團連結已建立並複製\n\n" +
        "共 " + ids.length + " 台車\n" +
        (result.expiresAt
          ? "有效至：" + new Date(result.expiresAt).toLocaleString("zh-TW")
          : "此連結不自動過期")
      );
    } catch (error) {
      console.error("建立 MyCar 臨時揪團連結失敗：", error);
      alert(
        "建立失敗：" +
        (error && error.message ? error.message : "未知錯誤")
      );

      if (button) {
        button.disabled = false;
        button.textContent = "🔗 建立並複製連結";
      }
    }
  }

  function install() {
    const countBox = document.getElementById("selectedCarCount");
    if (!countBox) return;

    const observer = new MutationObserver(refreshButton);
    observer.observe(countBox, {
      childList: true,
      characterData: true,
      subtree: true
    });

    refreshButton();
  }

  window.openMyCarTemporaryShare = open;
  window.JLYMyCarTemporaryShare = {
    open,
    refreshButton,
    selectedIds
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();

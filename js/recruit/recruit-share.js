console.log(
  "recruit-share.js 已成功載入！"
);

(function () {
  "use strict";

  function escapeHtml(value) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function removeShareModal() {
    const oldModal =
      document.getElementById(
        "recruitShareBackdrop"
      );

    if (oldModal) {
      oldModal.remove();
    }
  }

  async function copyText(text) {
    const value =
      String(text || "").trim();

    if (!value) {
      return false;
    }

    await navigator
      .clipboard
      .writeText(value);

    return true;
  }

  async function renderShareModal() {
    const data =
      window.JLYRecruitShareData;

    if (!data) {
      alert(
        "分享連結模組尚未載入"
      );

      return;
    }

    removeShareModal();

    const backdrop =
      document.createElement(
        "div"
      );

    backdrop.id =
      "recruitShareBackdrop";

    backdrop.className =
      "recruit-share-backdrop";

    backdrop.innerHTML = `
      <div
        class="recruit-share-modal"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="recruit-share-header"
        >
          <h2>
            🔗 我的揪團頁
          </h2>

          <button
            type="button"
            class="
              recruit-share-close
            "
            onclick="
              closeRecruitShareManager()
            "
          >
            ×
          </button>
        </div>

        <div
          id="recruitShareContent"
          class="
            recruit-share-content
          "
        >
          正在讀取分享設定…
        </div>
      </div>
    `;

    backdrop.addEventListener(
      "click",
      function (event) {
        if (
          event.target ===
          backdrop
        ) {
          removeShareModal();
        }
      }
    );

    document.body.appendChild(
      backdrop
    );

    const content =
      document.getElementById(
        "recruitShareContent"
      );

    try {
      const profile =
        await data
          .getShareProfile();

      renderShareContent(
        content,
        profile
      );
    } catch (error) {
      console.error(
        "讀取個人揪團分享失敗：",
        error
      );

      content.innerHTML = `
        <div
          class="
            recruit-share-error
          "
        >
          ${
            escapeHtml(
              error.message ||
              "讀取失敗"
            )
          }
        </div>
      `;
    }
  }

  function renderShareContent(
    container,
    profile
  ) {
    if (!container) {
      return;
    }

    const hasToken =
      Boolean(
        profile &&
        profile.activeToken
      );

    if (!hasToken) {
      container.innerHTML = `
        <p
          class="
            recruit-share-description
          "
        >
          目前還沒有個人揪團分享連結。
        </p>

        <button
          type="button"
          class="
            recruit-share-primary
          "
          onclick="
            createRecruitShareLink()
          "
        >
          🔗 建立分享連結
        </button>
      `;

      return;
    }

    container.innerHTML = `
      <p
        class="
          recruit-share-description
        "
      >
        把這個網址傳給朋友，
        對方只會看到你的招募中車團。
      </p>

      <div
        class="
          recruit-share-url-box
        "
      >
        ${escapeHtml(
          profile.shareUrl
        )}
      </div>

      <button
        type="button"
        class="
          recruit-share-primary
        "
        onclick="
          copyRecruitShareLink()
        "
      >
        📋 複製分享連結
      </button>

      <button
        type="button"
        class="
          recruit-share-secondary
        "
        onclick="
          rotateRecruitShareLink()
        "
      >
        🔄 更換分享連結
      </button>

      <button
        type="button"
        class="
          recruit-share-danger
        "
        onclick="
          disableRecruitShareLink()
        "
      >
        🔒 停用分享連結
      </button>

      <p
        class="
          recruit-share-hint
        "
      >
        更換後，舊網址會立即失效。
      </p>
    `;
  }

  async function refreshManager() {
    const content =
      document.getElementById(
        "recruitShareContent"
      );

    if (!content) {
      return;
    }

    content.textContent =
      "正在更新…";

    const profile =
      await window
        .JLYRecruitShareData
        .getShareProfile();

    renderShareContent(
      content,
      profile
    );
  }

  async function createRecruitShareLink() {
    try {
      await window
        .JLYRecruitShareData
        .rotateShareToken();

      await refreshManager();
    } catch (error) {
      console.error(
        "建立分享連結失敗：",
        error
      );

      alert(
        "建立分享連結失敗：" +
        (
          error.message ||
          "未知錯誤"
        )
      );
    }
  }

  async function copyRecruitShareLink() {
    try {
      const profile =
        await window
          .JLYRecruitShareData
          .getShareProfile();

      if (
        !profile.shareUrl
      ) {
        alert(
          "目前沒有分享連結"
        );

        return;
      }

      await copyText(
        profile.shareUrl
      );

      alert(
        "✅ 已複製個人揪團連結"
      );
    } catch (error) {
      console.error(
        "複製分享連結失敗：",
        error
      );

      alert(
        "複製失敗，請稍後再試"
      );
    }
  }

  async function rotateRecruitShareLink() {
    const confirmed =
      confirm(
        [
          "確定要更換分享連結嗎？",
          "",
          "更換後：",
          "・新網址會立即生效",
          "・舊網址會立即失效",
          "",
          "已經收到舊網址的人將無法再使用。"
        ].join("\n")
      );

    if (!confirmed) {
      return;
    }

    try {
      await window
        .JLYRecruitShareData
        .rotateShareToken();

      await refreshManager();

      alert(
        "✅ 分享連結已更換"
      );
    } catch (error) {
      console.error(
        "更換分享連結失敗：",
        error
      );

      alert(
        "更換失敗：" +
        (
          error.message ||
          "未知錯誤"
        )
      );
    }
  }

  async function disableRecruitShareLink() {
    const confirmed =
      confirm(
        [
          "確定停用個人揪團連結嗎？",
          "",
          "停用後，目前分享出去的網址將無法使用。",
          "",
          "之後仍可以重新建立新的分享網址。"
        ].join("\n")
      );

    if (!confirmed) {
      return;
    }

    try {
      await window
        .JLYRecruitShareData
        .disableShareToken();

      await refreshManager();

      alert(
        "分享連結已停用"
      );
    } catch (error) {
      console.error(
        "停用分享連結失敗：",
        error
      );

      alert(
        "停用失敗：" +
        (
          error.message ||
          "未知錯誤"
        )
      );
    }
  }

  window.openRecruitShareManager =
    renderShareModal;

  window.closeRecruitShareManager =
    removeShareModal;

  window.createRecruitShareLink =
    createRecruitShareLink;

  window.copyRecruitShareLink =
    copyRecruitShareLink;

  window.rotateRecruitShareLink =
    rotateRecruitShareLink;

  window.disableRecruitShareLink =
    disableRecruitShareLink;
})();
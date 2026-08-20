console.log(
  "system-admin-switcher.js 已成功載入！"
);

(function () {
  "use strict";

  const SWITCHER_ID =
    "jlySystemAdminSwitcher";

  const STYLE_ID =
    "jlySystemAdminSwitcherStyle";

  // ============================================================
  // 基本工具
  // ============================================================

  function getIdentity() {
    return window.JLYIdentity ||
      null;
  }

  function canUseAdmin() {
    const identity =
      getIdentity();

    return Boolean(
      identity &&
      typeof identity
        .canUseSystemAdmin ===
          "function" &&
      identity
        .canUseSystemAdmin()
    );
  }

  function isAdminMode() {
    const identity =
      getIdentity();

    return Boolean(
      identity &&
      typeof identity
        .isSystemAdminMode ===
          "function" &&
      identity
        .isSystemAdminMode()
    );
  }

  // ============================================================
  // 樣式
  // ============================================================

  function ensureStyle() {
    if (
      document.getElementById(
        STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      STYLE_ID;

    style.textContent = `
      #${SWITCHER_ID} {
        position: fixed;
        right: 14px;
        bottom:
          calc(
            84px +
            env(safe-area-inset-bottom, 0px)
          );
        z-index: 9998;

        display: flex;
        align-items: center;
        justify-content: center;

        width: 42px;
        height: 42px;
        margin: 0;
        padding: 0;

        border: 1px solid
          rgba(0, 0, 0, .12);
        border-radius: 50%;

        font-size: 18px;
        line-height: 1;

        cursor: pointer;

        box-shadow:
          0 5px 18px
          rgba(0, 0, 0, .16);

        backdrop-filter:
          blur(8px);

        -webkit-backdrop-filter:
          blur(8px);

        transition:
          transform .15s ease,
          box-shadow .15s ease;
      }

      #${SWITCHER_ID}:active {
        transform:
          scale(.93);
      }

      #${SWITCHER_ID}[data-admin-mode="false"] {
        background:
          rgba(255, 255, 255, .96);

        color:
          #444;
      }

      #${SWITCHER_ID}[data-admin-mode="true"] {
        background:
          #222;

        color:
          #fff;
      }

      @media (
        min-width: 721px
      ) {
        #${SWITCHER_ID} {
          right:
            max(
              18px,
              calc(
                (100vw - 720px) / 2 + 18px
              )
            );
        }
      }
    `;

    document.head
      .appendChild(
        style
      );
  }

  // ============================================================
  // 顯示
  // ============================================================

  function render() {
    const oldButton =
      document.getElementById(
        SWITCHER_ID
      );

    if (
      !canUseAdmin()
    ) {
      if (oldButton) {
        oldButton.remove();
      }

      return;
    }

    ensureStyle();

    const enabled =
      isAdminMode();

    let button =
      oldButton;

    if (!button) {
      button =
        document.createElement(
          "button"
        );

      button.id =
        SWITCHER_ID;

      button.type =
        "button";

      button.addEventListener(
        "click",
        toggle
      );

      document.body
        .appendChild(
          button
        );
    }

    button.dataset
      .adminMode =
        String(enabled);

    button.textContent =
      enabled
        ? "🛠"
        : "👤";

    button.setAttribute(
      "aria-label",
      enabled
        ? "目前為系統管理者模式"
        : "目前為一般模式"
    );

    button.title =
      enabled
        ? "目前為系統管理者，點擊切回一般模式"
        : "點擊切換為系統管理者";
  }

  // ============================================================
  // 切換
  // ============================================================

  function toggle() {
    const identity =
      getIdentity();

    if (
      !identity ||
      typeof identity
        .toggleSystemAdminMode !==
          "function"
    ) {
      alert(
        "System Admin 模組尚未載入"
      );

      return;
    }

    const result =
      identity
        .toggleSystemAdminMode();

    if (!result) {
      alert(
        "目前身分沒有系統管理者資格"
      );

      return;
    }

    render();
  }

  // ============================================================
  // 初始化
  // ============================================================

  function init() {
    render();

    window.addEventListener(
      "jly:admin-mode-changed",
      render
    );
  }

  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYSystemAdminSwitcher = {
    init,
    render,
    toggle
  };
})();
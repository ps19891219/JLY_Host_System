/*
====================================================

JLY Host System V3

Module：
Car Detail Events

用途：
1. 統一管理詳情頁全域事件
2. 避免同一事件重複綁定
3. 提供其他模組發送 Detail 事件

依賴：
- window.JLYCarDetailController

====================================================
*/

console.log(
  "detail-events.js 已成功載入！"
);

(function () {
  "use strict";

  let initialized =
    false;

  // ------------------------------------------------------------
  // 發送自訂事件
  // ------------------------------------------------------------

  function emit(
    eventName,
    detail
  ) {
    document.dispatchEvent(
      new CustomEvent(
        eventName,
        {
          detail:
            detail || {}
        }
      )
    );
  }

  // ------------------------------------------------------------
  // 監聽自訂事件
  // ------------------------------------------------------------

  function on(
    eventName,
    handler
  ) {
    if (
      typeof handler !==
        "function"
    ) {
      return function () {};
    }

    document.addEventListener(
      eventName,
      handler
    );

    return function removeListener() {
      document.removeEventListener(
        eventName,
        handler
      );
    };
  }

  // ------------------------------------------------------------
  // 詳情頁資料重新載入
  // ------------------------------------------------------------

  async function handleRefreshRequest(
    event
  ) {
    const controller =
      window.JLYCarDetailController;

    if (
      !controller ||
      typeof controller.refreshPage !==
        "function"
    ) {
      console.warn(
        "Detail Events：Controller 尚未載入"
      );

      return;
    }

    try {
      await controller.refreshPage();

      emit(
        "jly:car-detail:refreshed",
        {
          source:
            event &&
            event.detail &&
            event.detail.source
              ? event.detail.source
              : "unknown"
        }
      );
    } catch (error) {
      console.error(
        "車團詳情重新整理失敗：",
        error
      );

      emit(
        "jly:car-detail:error",
        {
          error
        }
      );
    }
  }

  // ------------------------------------------------------------
  // 綁定事件
  // ------------------------------------------------------------

  function bind() {
    if (initialized) {
      return;
    }

    initialized =
      true;

    document.addEventListener(
      "jly:car-detail:refresh",
      handleRefreshRequest
    );

    console.log(
      "✅ Car Detail Events 已綁定"
    );
  }

  // ------------------------------------------------------------
  // 取消事件
  // ------------------------------------------------------------

  function unbind() {
    if (!initialized) {
      return;
    }

    document.removeEventListener(
      "jly:car-detail:refresh",
      handleRefreshRequest
    );

    initialized =
      false;
  }

  // ------------------------------------------------------------
  // 要求重新整理
  // ------------------------------------------------------------

  function requestRefresh(
    source
  ) {
    emit(
      "jly:car-detail:refresh",
      {
        source:
          source || "manual"
      }
    );
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailEvents = {
    emit,

    on,

    bind,

    unbind,

    requestRefresh,

    isInitialized:
      function () {
        return initialized;
      }
  };

  console.log(
    "✅ Car Detail Events 模組已載入"
  );
})();
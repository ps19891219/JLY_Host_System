/*
====================================================

JLY Host System V3

Module：
Car Detail Init

用途：
1. 檢查 Card Detail V3 模組是否完成載入
2. 綁定 Controller Events
3. 暫時不重複啟動舊 cardetail.js
4. 下一階段接管正式初始化

依賴：
- detail-loader.js
- detail-controller.js
- detail-events.js

====================================================
*/

console.log(
  "detail-init.js 已成功載入！"
);

(function () {
  "use strict";

  let initialized =
    false;

  // ------------------------------------------------------------
  // 檢查依賴
  // ------------------------------------------------------------

  function checkDependencies() {
    const missing =
      [];

    if (
      !window.JLYCarDetailLoader
    ) {
      missing.push(
        "JLYCarDetailLoader"
      );
    }

    if (
      !window.JLYCarDetailController
    ) {
      missing.push(
        "JLYCarDetailController"
      );
    }

    if (
      !window.JLYCarDetailEvents
    ) {
      missing.push(
        "JLYCarDetailEvents"
      );
    }

    return {
      ready:
        missing.length === 0,

      missing
    };
  }

  // ------------------------------------------------------------
  // 初始化
  //
  // 注意：
  // 現階段 cardetail.js 仍會自行 Render，
  // 這裡只啟動 V3 基礎架構，不重複載入頁面。
  // ------------------------------------------------------------

  function init() {
    if (initialized) {
      return {
        initialized:
          true,

        repeated:
          true
      };
    }

    const dependencyState =
      checkDependencies();

    if (!dependencyState.ready) {
      console.error(
        "Car Detail V3 依賴尚未完成：",
        dependencyState.missing
      );

      return {
        initialized:
          false,

        missing:
          dependencyState.missing
      };
    }

    window
      .JLYCarDetailEvents
      .bind();

    initialized =
      true;

    console.log(
      "🚗 Car Detail V3 基礎架構已啟動"
    );

    return {
      initialized:
        true,

      repeated:
        false
    };
  }

  // ------------------------------------------------------------
  // DOM 完成後啟動
  // ------------------------------------------------------------

  document.addEventListener(
    "DOMContentLoaded",
    function () {
      init();
    }
  );

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailInit = {
    checkDependencies,

    init,

    isInitialized:
      function () {
        return initialized;
      }
  };

  console.log(
    "✅ Car Detail Init 已載入"
  );
})();
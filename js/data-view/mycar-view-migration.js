console.log("mycar-view-migration.js 已成功載入！");

(function () {
  "use strict";

  function loadScript(
    src,
    marker
  ) {
    return new Promise(
      function (
        resolve,
        reject
      ) {
        const existing =
          document.querySelector(
            `script[data-jly-mycar-migration="${marker}"]`
          );

        if (existing) {
          if (
            existing.dataset
              .jlyMigrationReady ===
              "1"
          ) {
            resolve();
            return;
          }

          existing.addEventListener(
            "load",
            resolve,
            { once: true }
          );
          existing.addEventListener(
            "error",
            reject,
            { once: true }
          );
          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.src = src;
        script.async = false;
        script.dataset
          .jlyMycarMigration =
          marker;

        script.onload =
          function () {
            script.dataset
              .jlyMigrationReady =
              "1";
            resolve();
          };

        script.onerror =
          reject;

        document.head
          .appendChild(
            script
          );
      }
    );
  }

  async function ensureModules() {
    if (!window.JLYMyCarView) {
      await loadScript(
        "/js/data-view/mycar-view.js?v=4",
        "view"
      );
    }

    if (!window.JLYMyCarViewBootstrap) {
      await loadScript(
        "/js/data-view/mycar-view-bootstrap.js?v=2",
        "bootstrap"
      );
    }

    if (!window.JLYMyCarViewChecker) {
      await loadScript(
        "/js/data-view/mycar-view-checker.js?v=1",
        "checker"
      );
    }
  }

  async function bootstrapAndCheck() {
    await ensureModules();

    const view =
      await window
        .JLYMyCarViewBootstrap
        .bootstrapCurrentUser();

    const check =
      await window
        .JLYMyCarViewChecker
        .checkCurrentUser();

    const result = {
      bootstrapCars:
        view &&
        Array.isArray(view.cars)
          ? view.cars.length
          : 0,
      consistency:
        check
    };

    console.log(
      "🧪 MyCar Bootstrap + Consistency",
      result
    );

    return result;
  }

  function enableViewFirst() {
    if (
      !window.JLYMyCarViewFirst
    ) {
      throw new Error(
        "請先載入正式 mycar.js"
      );
    }

    window
      .JLYMyCarViewFirst
      .enable();

    console.log(
      "✅ MyCar View-first 已開啟。重新整理後生效。"
    );

    return true;
  }

  function disableViewFirst() {
    if (
      window.JLYMyCarViewFirst
    ) {
      window
        .JLYMyCarViewFirst
        .disable();
    } else {
      localStorage.removeItem(
        "jlyMyCarViewFirstV1"
      );
    }

    console.log(
      "↩️ MyCar View-first 已關閉。重新整理後回到 Migration Safety 路徑。"
    );

    return true;
  }

  window.JLYMyCarMigration = {
    ensureModules,
    bootstrapAndCheck,
    enableViewFirst,
    disableViewFirst
  };
})();
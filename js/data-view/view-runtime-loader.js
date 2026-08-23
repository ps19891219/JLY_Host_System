console.log("view-runtime-loader.js 已成功載入！");

(function () {
  "use strict";

  let loadingPromise = null;

  function loadScript(src, marker) {
    return new Promise(
      function (resolve, reject) {
        const existing =
          document.querySelector(
            `script[data-jly-view-module="${marker}"]`
          );

        if (existing) {
          if (
            existing.dataset
              .jlyViewReady ===
              "1"
          ) {
            resolve();
            return;
          }

          existing.addEventListener(
            "load",
            function () {
              resolve();
            },
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
          .jlyViewModule =
          marker;

        script.onload =
          function () {
            script.dataset
              .jlyViewReady =
              "1";

            resolve();
          };

        script.onerror =
          function () {
            reject(
              new Error(
                `View Runtime 模組載入失敗：${src}`
              )
            );
          };

        document.head
          .appendChild(
            script
          );
      }
    );
  }

  async function ensure() {
    if (
      window
        .JLYViewMutationCoordinator &&
      window.JLYMyCarView &&
      window.JLYCloudCarView
    ) {
      return {
        coordinator:
          window
            .JLYViewMutationCoordinator,

        mycar:
          window.JLYMyCarView,

        carDetail:
          window.JLYCloudCarView
      };
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise =
      (async function () {
        await loadScript(
          "/js/data-view/view-core.js?v=1",
          "view-core"
        );

        await loadScript(
          "/js/data-view/view-impact-resolver.js?v=2",
          "view-impact-resolver"
        );

        await loadScript(
          "/js/data-view/cloud-car-view.js?v=1",
          "cloud-car-view"
        );

        await loadScript(
          "/js/data-view/mycar-view.js?v=5",
          "mycar-view"
        );

        await loadScript(
          "/js/data-view/view-mutation-coordinator.js?v=1",
          "view-mutation-coordinator"
        );

        if (
          !window
            .JLYViewMutationCoordinator
        ) {
          throw new Error(
            "JLY View Mutation Coordinator 未初始化"
          );
        }

        return {
          coordinator:
            window
              .JLYViewMutationCoordinator,

          mycar:
            window.JLYMyCarView,

          carDetail:
            window.JLYCloudCarView
        };
      })();

    try {
      return await loadingPromise;
    } catch (error) {
      loadingPromise = null;
      throw error;
    }
  }

  window.JLYViewRuntimeLoader = {
    ensure
  };
})();

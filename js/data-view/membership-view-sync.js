console.log("membership-view-sync.js 已成功載入！");

(function () {
  "use strict";

  let ensurePromise =
    null;

  function text(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function unique(values) {
    return Array.from(
      new Set(
        (
          Array.isArray(values)
            ? values
            : []
        )
          .map(text)
          .filter(Boolean)
      )
    );
  }

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
            `script[data-jly-membership-module="${marker}"]`
          );

        if (existing) {
          if (
            existing.dataset
              .jlyMembershipReady ===
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

        script.src =
          src;

        script.async =
          false;

        script.dataset
          .jlyMembershipModule =
          marker;

        script.onload =
          function () {
            script.dataset
              .jlyMembershipReady =
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

  async function ensure() {
    if (
      window
        .JLYViewMutationCoordinator &&
      window.JLYMyCarView &&
      window.JLYMyCarViewAlias
    ) {
      return true;
    }

    if (ensurePromise) {
      return ensurePromise;
    }

    ensurePromise =
      (async function () {
        if (
          !window
            .JLYViewRuntimeLoader
        ) {
          await loadScript(
            "/js/data-view/view-runtime-loader.js?v=1",
            "view-runtime-loader"
          );
        }

        await window
          .JLYViewRuntimeLoader
          .ensure();

        if (
          !window
            .JLYMyCarViewAlias
        ) {
          await loadScript(
            "/js/data-view/mycar-view-alias.js?v=1",
            "mycar-view-alias"
          );
        }

        return true;
      })();

    try {
      return await ensurePromise;
    } catch (error) {
      ensurePromise = null;
      throw error;
    }
  }

  async function sync(
    options
  ) {
    const settings =
      options || {};

    const beforeCar =
      settings.beforeCar ||
      null;

    const afterCar =
      settings.afterCar ||
      null;

    const changedFields =
      Array.isArray(
        settings.changedFields
      )
        ? settings.changedFields
        : [];

    const playerIds =
      unique(
        settings.playerIds
      );

    try {
      await ensure();

      const results = [];

      if (
        window
          .JLYViewMutationCoordinator &&
        typeof window
          .JLYViewMutationCoordinator
          .updateCarViews ===
            "function"
      ) {
        results.push(
          ...(
            await window
              .JLYViewMutationCoordinator
              .updateCarViews({
                beforeCar,
                afterCar,
                changedFields
              })
          )
        );
      }

      if (
        playerIds.length >
          0
      ) {
        const viewerIds =
          await window
            .JLYMyCarViewAlias
            .resolveViewerIds(
              playerIds
            );

        for (
          const viewerId
          of viewerIds
        ) {
          results.push({
            type:
              "mycar_player_view",
            ...(
              await window
                .JLYMyCarView
                .applyViewerMutation(
                  viewerId,
                  beforeCar,
                  afterCar
                )
            )
          });
        }
      }

      return results;
    } catch (error) {
      console.warn(
        "Membership View Sync 失敗：",
        error
      );

      return [];
    }
  }

  window.JLYMembershipViewSync = {
    ensure,
    sync
  };
})();
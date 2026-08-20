console.log("mycar-view-bootstrap.js 已成功載入！");

(function () {
  "use strict";

  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase 尚未初始化"
      );
    }

    return window.db;
  }

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

  function chunk(
    values,
    size
  ) {
    const result = [];

    for (
      let index = 0;
      index < values.length;
      index += size
    ) {
      result.push(
        values.slice(
          index,
          index + size
        )
      );
    }

    return result;
  }

  function getViewerIdentity() {
    const identity =
      window.JLYIdentity;

    const viewerId =
      identity &&
      typeof identity
        .getCurrentPlayerId ===
          "function"
        ? text(
            identity
              .getCurrentPlayerId()
          )
        : text(
            localStorage
              .getItem(
                "currentPlayerId"
              )
          );

    const allIds =
      identity &&
      typeof identity
        .getAllPlayerIdentityIds ===
          "function"
        ? identity
            .getAllPlayerIdentityIds()
        : [
            viewerId,
            (
              identity &&
              typeof identity
                .getCurrentPlayerProfileId ===
                  "function"
                ? identity
                    .getCurrentPlayerProfileId()
                : localStorage
                    .getItem(
                      "currentPlayerProfileId"
                    )
            )
          ];

    return {
      viewerId,
      identityIds:
        unique([
          viewerId,
          ...(
            Array.isArray(
              allIds
            )
              ? allIds
              : []
          )
        ])
    };
  }

  async function queryHostCars(
    viewerId
  ) {
    const snapshot =
      await getDb()
        .collection("cars")
        .where(
          "ownerId",
          "==",
          viewerId
        )
        .get();

    return snapshot.docs.map(
      doc => ({
        id: doc.id,
        ...doc.data()
      })
    );
  }

  async function queryPlayerCars(
    identityIds
  ) {
    const carMap =
      new Map();

    /*
      重要：
      Bootstrap 不允許呼叫 ensurePlayerIdsIndex()
      也不允許 fallback 全掃 cars。
      只使用已存在的 playerIds index。
    */
    for (
      const ids
      of chunk(
        unique(identityIds),
        10
      )
    ) {
      if (
        ids.length === 0
      ) {
        continue;
      }

      const snapshot =
        await getDb()
          .collection("cars")
          .where(
            "playerIds",
            "array-contains-any",
            ids
          )
          .get();

      snapshot.docs.forEach(
        function (doc) {
          carMap.set(
            doc.id,
            {
              id: doc.id,
              ...doc.data()
            }
          );
        }
      );
    }

    return Array.from(
      carMap.values()
    );
  }


  async function ensureAliasModule() {
    if (
      window.JLYMyCarViewAlias
    ) {
      return window
        .JLYMyCarViewAlias;
    }

    await new Promise(
      function (
        resolve,
        reject
      ) {
        const script =
          document.createElement(
            "script"
          );

        script.src =
          "/js/data-view/mycar-view-alias.js?v=1";

        script.async =
          true;

        script.onload =
          resolve;

        script.onerror =
          reject;

        document.head
          .appendChild(
            script
          );
      }
    );

    if (
      !window.JLYMyCarViewAlias
    ) {
      throw new Error(
        "MyCar View Alias 模組未初始化"
      );
    }

    return window
      .JLYMyCarViewAlias;
  }

  async function bootstrapCurrentUser() {
    if (
      !window.JLYMyCarView ||
      typeof window
        .JLYMyCarView
        .buildView !==
          "function"
    ) {
      throw new Error(
        "JLYMyCarView 尚未載入"
      );
    }

    const {
      viewerId,
      identityIds
    } =
      getViewerIdentity();

    if (!viewerId) {
      throw new Error(
        "尚未取得 JLY 使用者身分"
      );
    }

    console.log(
      "🧱 MyCar View Bootstrap 開始",
      {
        viewerId,
        identityIds
      }
    );

    const [
      hostCars,
      playerCars
    ] =
      await Promise.all([
        queryHostCars(
          viewerId
        ),
        queryPlayerCars(
          identityIds
        )
      ]);

    const map =
      new Map();

    [
      ...hostCars,
      ...playerCars
    ].forEach(
      function (car) {
        map.set(
          car.id,
          car
        );
      }
    );

    const view =
      window.JLYMyCarView
        .buildView({
          viewerId,
          identityIds,
          cars:
            Array.from(
              map.values()
            )
        });

    await window
      .JLYMyCarView
      .write(view);

    const aliasModule =
      await ensureAliasModule();

    await aliasModule
      .registerAliases(
        viewerId,
        identityIds
      );

    console.log(
      "✅ MyCar View Bootstrap 完成",
      {
        hostReadDocuments:
          hostCars.length,

        playerReadDocuments:
          playerCars.length,

        uniqueCars:
          view.cars.length,

        viewDocument:
          `myCarViews/${viewerId}`
      }
    );

    return view;
  }

  window.JLYMyCarViewBootstrap = {
    getViewerIdentity,
    queryHostCars,
    queryPlayerCars,
    bootstrapCurrentUser
  };
})();
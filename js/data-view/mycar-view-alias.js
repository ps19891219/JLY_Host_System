console.log("mycar-view-alias.js 已成功載入！");

(function () {
  "use strict";

  const COLLECTION =
    "myCarViewAliases";

  const SCHEMA_VERSION =
    1;

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

  async function registerAliases(
    viewerId,
    aliasIds
  ) {
    const normalizedViewerId =
      text(viewerId);

    if (!normalizedViewerId) {
      throw new Error(
        "mycar_alias_viewer_required"
      );
    }

    const aliases =
      unique([
        normalizedViewerId,
        ...(aliasIds || [])
      ]);

    const now =
      new Date()
        .toISOString();

    await Promise.all(
      aliases.map(
        aliasId =>
          getDb()
            .collection(
              COLLECTION
            )
            .doc(aliasId)
            .set(
              {
                schemaVersion:
                  SCHEMA_VERSION,
                aliasId,
                viewerId:
                  normalizedViewerId,
                updatedAt:
                  now
              },
              {
                merge: false
              }
            )
      )
    );

    return aliases;
  }

  async function resolveViewerIds(
    aliasIds
  ) {
    const aliases =
      unique(aliasIds);

    if (
      aliases.length === 0
    ) {
      return [];
    }

    const snapshots =
      await Promise.all(
        aliases.map(
          aliasId =>
            getDb()
              .collection(
                COLLECTION
              )
              .doc(aliasId)
              .get()
        )
      );

    return unique(
      snapshots
        .filter(
          snapshot =>
            snapshot &&
            snapshot.exists
        )
        .map(
          snapshot =>
            snapshot.data() &&
            snapshot.data()
              .viewerId
        )
    );
  }

  window.JLYMyCarViewAlias = {
    COLLECTION,
    SCHEMA_VERSION,
    registerAliases,
    resolveViewerIds
  };
})();
console.log("view-core.js 已成功載入！");

(function () {
  "use strict";

  const registry = new Map();

  function normalizeType(type) {
    return String(
      type == null ? "" : type
    ).trim();
  }

  function registerViewType(
    type,
    handler
  ) {
    const key =
      normalizeType(type);

    if (!key) {
      throw new Error(
        "view_type_required"
      );
    }

    if (
      !handler ||
      typeof handler !== "object"
    ) {
      throw new Error(
        "view_handler_required"
      );
    }

    registry.set(
      key,
      handler
    );

    return true;
  }

  function getViewType(
    type
  ) {
    return (
      registry.get(
        normalizeType(type)
      ) || null
    );
  }

  function listViewTypes() {
    return Array.from(
      registry.keys()
    );
  }

  async function rebuildAffectedViews(
    context
  ) {
    const settings =
      context &&
      typeof context === "object"
        ? context
        : {};

    const affectedViews =
      Array.isArray(
        settings.affectedViews
      )
        ? settings.affectedViews
        : [];

    const results = [];

    for (
      const rawType
      of affectedViews
    ) {
      const type =
        normalizeType(rawType);

      const handler =
        getViewType(type);

      if (
        !handler ||
        typeof handler.rebuild !==
          "function"
      ) {
        results.push({
          type,
          ok: false,
          reason:
            "handler_not_found"
        });

        continue;
      }

      try {
        const value =
          await handler.rebuild(
            settings
          );

        results.push({
          type,
          ok: true,
          value
        });
      } catch (error) {
        results.push({
          type,
          ok: false,
          error
        });
      }
    }

    return results;
  }

  window.JLYViewCore = {
    registerViewType,
    getViewType,
    listViewTypes,
    rebuildAffectedViews
  };
})();
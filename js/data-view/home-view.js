console.log("home-view.js 已成功載入！");

(function () {
  "use strict";

  const COLLECTION = "homeViews";
  const SCHEMA_VERSION = 1;

  function getDb() {
    if (!window.db) {
      throw new Error("Firebase 尚未初始化");
    }
    return window.db;
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function buildView(options) {
    const settings = options || {};
    const personId = text(settings.personId);

    if (!personId) {
      throw new Error("home_view_person_required");
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      viewType: "home",
      personId,

      /*
        首頁正式卡片尚未定案。
        這裡只建立穩定 envelope，
        不提前把 UI 欄位寫死。
      */
      sections:
        settings.sections &&
        typeof settings.sections === "object"
          ? settings.sections
          : {},

      pendingSummary:
        settings.pendingSummary &&
        typeof settings.pendingSummary === "object"
          ? settings.pendingSummary
          : {},

      builtAt: new Date().toISOString()
    };
  }

  async function read(personId) {
    const id = text(personId);
    if (!id) {
      throw new Error("home_view_person_required");
    }

    const snapshot = await getDb()
      .collection(COLLECTION)
      .doc(id)
      .get();

    return snapshot.exists
      ? snapshot.data() || null
      : null;
  }

  async function write(options) {
    const view = buildView(options);

    await getDb()
      .collection(COLLECTION)
      .doc(view.personId)
      .set(view, { merge: false });

    return view;
  }

  const api = {
    COLLECTION,
    SCHEMA_VERSION,
    buildView,
    read,
    write
  };

  window.JLYHomeView = api;

  if (window.JLYViewCore) {
    window.JLYViewCore.registerViewType(
      "home",
      api
    );
  }
})();
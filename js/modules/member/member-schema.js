console.log("member-schema.js 已成功載入！");

(function () {

  /**
   * 建立新的 Member
   */
  function createMember(data = {}) {

    return {

      // ===== 核心欄位 =====

      id: data.id || "",

      displayName: data.displayName || "",

      roles: Array.isArray(data.roles)
        ? [...data.roles]
        : [],

      studioIds: Array.isArray(data.studioIds)
        ? [...data.studioIds]
        : [],

      status: data.status || "active",

      // ===== 可擴充欄位 =====

      customFields:
        typeof data.customFields === "object" &&
        data.customFields !== null
          ? { ...data.customFields }
          : {},

      createdAt:
        data.createdAt || Date.now(),

      updatedAt:
        data.updatedAt || Date.now()

    };

  }

  window.JLYMemberSchema = {

    createMember

  };

})();
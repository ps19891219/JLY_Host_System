console.log("car-data.js 已成功載入！");

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

  async function getCarById(carId) {
    const normalizedCarId =
      String(carId || "").trim();

    if (!normalizedCarId) {
      throw new Error(
        "缺少車團 ID"
      );
    }

    const db = getDb();

    const snapshot = await db
      .collection("cars")
      .doc(normalizedCarId)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  }

  window.JLYCarData = {
    getCarById
  };
})();
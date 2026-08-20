console.log("cloud-car-view.js 已成功載入！");

(function () {
  "use strict";

  const COLLECTION_NAME =
    "carDetailViews";

  const SCHEMA_VERSION = 1;

  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase 尚未初始化"
      );
    }

    return window.db;
  }

  function normalizeId(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function cloneCar(car) {
    const source =
      car &&
      typeof car === "object"
        ? car
        : {};

    return {
      ...source
    };
  }

  function buildView(car) {
    const source =
      cloneCar(car);

    const carId =
      normalizeId(
        source.id ||
        source.carId
      );

    if (!carId) {
      throw new Error(
        "cloud_view_missing_car_id"
      );
    }

    return {
      schemaVersion:
        SCHEMA_VERSION,

      viewType:
        "car_detail",

      carId,

      ownerId:
        normalizeId(
          source.ownerId
        ),

      sourceUpdatedAt:
        source.updatedAt || null,

      builtAt:
        new Date().toISOString(),

      car: {
        ...source,
        id: carId
      }
    };
  }

  function getViewRef(carId) {
    const normalizedCarId =
      normalizeId(carId);

    if (!normalizedCarId) {
      throw new Error(
        "cloud_view_missing_car_id"
      );
    }

    return getDb()
      .collection(
        COLLECTION_NAME
      )
      .doc(normalizedCarId);
  }

  async function writeFromCar(
    car
  ) {
    const view =
      buildView(car);

    await getViewRef(
      view.carId
    ).set(
      view,
      {
        merge: false
      }
    );

    console.log(
      "☁️ Car Detail View 已更新",
      view.carId
    );

    return view;
  }

  async function writeFromMutation(
    beforeCar,
    updateData,
    carId
  ) {
    const merged = {
      ...(
        beforeCar &&
        typeof beforeCar ===
          "object"
          ? beforeCar
          : {}
      ),

      ...(
        updateData &&
        typeof updateData ===
          "object"
          ? updateData
          : {}
      ),

      id:
        normalizeId(
          carId ||
          (
            beforeCar &&
            beforeCar.id
          )
        )
    };

    return writeFromCar(
      merged
    );
  }

  async function syncFromCore(
    carId
  ) {
    const normalizedCarId =
      normalizeId(carId);

    if (!normalizedCarId) {
      throw new Error(
        "cloud_view_missing_car_id"
      );
    }

    /*
      這個 Core Read 只允許在「明確修改後同步」
      或人工 bootstrap / repair 時使用。
      一般頁面 render 不應呼叫此函式。
    */
    const snapshot =
      await getDb()
        .collection("cars")
        .doc(normalizedCarId)
        .get();

    if (!snapshot.exists) {
      throw new Error(
        "car_not_found"
      );
    }

    const car = {
      id:
        snapshot.id,

      ...snapshot.data()
    };

    await writeFromCar(
      car
    );

    return car;
  }

  async function readView(
    carId
  ) {
    const snapshot =
      await getViewRef(
        carId
      ).get();

    if (!snapshot.exists) {
      return null;
    }

    const data =
      snapshot.data() || {};

    if (
      !data.car ||
      typeof data.car !== "object"
    ) {
      return null;
    }

    return {
      ...data,
      car: {
        ...data.car,
        id:
          normalizeId(
            data.car.id ||
            data.carId ||
            carId
          )
      }
    };
  }

  async function removeView(
    carId
  ) {
    await getViewRef(
      carId
    ).delete();
  }

  window.JLYCloudCarView = {
    COLLECTION_NAME,
    SCHEMA_VERSION,
    buildView,
    readView,
    writeFromCar,
    writeFromMutation,
    syncFromCore,
    removeView
  };
})();
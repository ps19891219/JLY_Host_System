/*
====================================================

JLY Host System V3

Module：
Car Detail Controller

用途：
1. 管理目前車團詳情頁狀態
2. 統一 load、refresh 與 render 流程
3. 作為 Loader、Render、Events 的交通指揮塔

依賴：
- window.JLYCarDetailLoader
- 目前 cardetail.js 的 renderCarDetail()

====================================================
*/

console.log(
  "detail-controller.js 已成功載入！"
);

(function () {
  "use strict";

  const state = {
    status:
      "idle",

    carId:
      "",

    data:
      null,

    error:
      null,

    loadedAt:
      ""
  };

  // ------------------------------------------------------------
  // 更新狀態
  // ------------------------------------------------------------

  function setState(nextState) {
    Object.assign(
      state,
      nextState || {}
    );

    return getState();
  }

  // ------------------------------------------------------------
  // 取得狀態副本
  // ------------------------------------------------------------

  function getState() {
    return {
      ...state,

      data:
        state.data
          ? {
              ...state.data
            }
          : null
    };
  }

  // ------------------------------------------------------------
  // 取得目前資料
  // ------------------------------------------------------------

  function getCurrentData() {
    return state.data;
  }

  // ------------------------------------------------------------
  // 取得目前車團
  // ------------------------------------------------------------

  function getCurrentCar() {
    return (
      state.data &&
      state.data.car
        ? state.data.car
        : null
    );
  }

  // ------------------------------------------------------------
  // 將 Loader 結果同步到舊頁面全域狀態
  //
  // 拆分期間保留相容性。
  // ------------------------------------------------------------

  function syncLegacyGlobals(
    data
  ) {
    if (!data) {
      return;
    }

    window.currentCarData =
      data.car || null;

    window.currentCarPlayers =
      Array.isArray(
        data.players
      )
        ? data.players
        : [];
  }

  // ------------------------------------------------------------
  // 載入資料
  // ------------------------------------------------------------

  async function load(carId) {
    const loader =
      window.JLYCarDetailLoader;

    if (
      !loader ||
      typeof loader.loadCar !==
        "function"
    ) {
      throw new Error(
        "Car Detail Loader 尚未載入"
      );
    }

    setState({
      status:
        "loading",

      carId:
        carId || "",

      error:
        null
    });

    try {
      const data =
        await loader.loadCar(
          carId
        );

      syncLegacyGlobals(
        data
      );

      setState({
        status:
          "ready",

        carId:
          carId,

        data,

        error:
          null,

        loadedAt:
          new Date()
            .toISOString()
      });

      return data;
    } catch (error) {
      setState({
        status:
          "error",

        error
      });

      throw error;
    }
  }

  // ------------------------------------------------------------
  // 呼叫目前舊版 Render
  //
  // 下一階段會改成呼叫 Render V3。
  // ------------------------------------------------------------

  async function renderLegacy() {
    if (
      typeof window.renderCarDetail !==
        "function"
    ) {
      throw new Error(
        "renderCarDetail 尚未載入"
      );
    }

    return window.renderCarDetail();
  }

  // ------------------------------------------------------------
  // 重新載入目前頁面
  // ------------------------------------------------------------

  async function refresh() {
    const carId =
      state.carId ||
      (
        typeof window.getCarId ===
          "function"
          ? window.getCarId()
          : new URLSearchParams(
              location.search
            ).get("id")
      );

    if (!carId) {
      throw new Error(
        "找不到車團 ID"
      );
    }

    return load(carId);
  }

  // ------------------------------------------------------------
  // 使用目前舊流程重新整理畫面
  //
  // 暫時維持功能穩定。
  // ------------------------------------------------------------

  async function refreshPage() {
    return renderLegacy();
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailController = {
    state,

    setState,

    getState,

    getCurrentData,

    getCurrentCar,

    syncLegacyGlobals,

    load,

    refresh,

    renderLegacy,

    refreshPage
  };

  console.log(
    "✅ Car Detail Controller 已載入"
  );
})();
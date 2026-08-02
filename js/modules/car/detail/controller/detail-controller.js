/*
====================================================

JLY Host System V3

Module：
Car Detail Controller V2

用途：
1. 管理目前車團詳情頁狀態
2. 統一 load、refresh 與 render 流程
3. 所有操作完成後保留目前頁面位置
4. 支援指定元素重新 Render 後回到原處
5. 只有使用者主動點擊劇本名稱才回到頁首

依賴：
- window.JLYCarDetailLoader
- window.renderCarDetail

====================================================
*/

console.log(
  "detail-controller.js V2 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // 狀態
  // ============================================================

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
      "",

    isRefreshing:
      false
  };

  // ============================================================
  // 捲動位置狀態
  // ============================================================

  const scrollState = {
    scrollX:
      0,

    scrollY:
      0,

    anchorSelector:
      "",

    anchorOffset:
      0,

    shouldRestore:
      false
  };

  // ============================================================
  // 基礎工具
  // ============================================================

  function getText(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function waitForFrames(count) {
    const total =
      Math.max(
        Number(count || 1),
        1
      );

    return new Promise(
      function (resolve) {
        let current = 0;

        function nextFrame() {
          current += 1;

          if (
            current >= total
          ) {
            resolve();

            return;
          }

          window.requestAnimationFrame(
            nextFrame
          );
        }

        window.requestAnimationFrame(
          nextFrame
        );
      }
    );
  }

  // ============================================================
  // Controller State
  // ============================================================

  function setState(nextState) {
    Object.assign(
      state,
      nextState || {}
    );

    return getState();
  }

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

  function getCurrentData() {
    return state.data;
  }

  function getCurrentCar() {
    return (
      state.data &&
      state.data.car
        ? state.data.car
        : (
            window.currentCarData ||
            null
          )
    );
  }

  // ============================================================
  // 舊全域狀態相容
  // ============================================================

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

  // ============================================================
  // 載入資料
  // ============================================================

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

  // ============================================================
  // 舊 Render 流程
  // ============================================================

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

  // ============================================================
  // 重新載入資料
  // ============================================================

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

  // ============================================================
  // 建立可還原的 Element Selector
  //
  // 優先使用：
  // 1. id
  // 2. data-slot-id
  // 3. data-staff-id
  // 4. data-player-id
  // 5. data-car-field
  // ============================================================

  function buildElementSelector(
    element
  ) {
    if (
      !element ||
      !(element instanceof Element)
    ) {
      return "";
    }

    if (element.id) {
      return (
        "#" +
        CSS.escape(
          element.id
        )
      );
    }

    const attributes = [
      "data-slot-id",
      "data-staff-id",
      "data-player-id",
      "data-car-field",
      "data-seat-section"
    ];

    for (
      let index = 0;
      index < attributes.length;
      index += 1
    ) {
      const attribute =
        attributes[index];

      const value =
        getText(
          element.getAttribute(
            attribute
          )
        );

      if (value) {
        return (
          "[" +
          attribute +
          '="' +
          CSS.escape(value) +
          '"]'
        );
      }
    }

    return "";
  }

  // ============================================================
  // 記錄目前操作元素
  // ============================================================

  function findCurrentAnchorElement(
    sourceElement
  ) {
    const source =
      sourceElement &&
      sourceElement instanceof Element
        ? sourceElement
        : (
            document.activeElement &&
            document.activeElement instanceof Element
              ? document.activeElement
              : null
          );

    if (!source) {
      return null;
    }

    return (
      source.closest(
        [
          "[data-slot-id]",
          "[data-staff-id]",
          "[data-player-id]",
          "[data-car-field]",
          ".seat-row",
          ".staff-seat-row",
          ".compact-player-row",
          ".car-info-item"
        ].join(",")
      ) ||
      source
    );
  }

  // ============================================================
  // 儲存捲動位置
  // ============================================================

  function captureScrollPosition(
    options
  ) {
    const settings = {
      sourceElement:
        null,

      anchorSelector:
        "",

      ...(
        options || {}
      )
    };

    scrollState.scrollX =
      window.scrollX ||
      window.pageXOffset ||
      0;

    scrollState.scrollY =
      window.scrollY ||
      window.pageYOffset ||
      0;

    scrollState.anchorSelector =
      getText(
        settings.anchorSelector
      );

    scrollState.anchorOffset =
      0;

    if (
      !scrollState.anchorSelector
    ) {
      const anchorElement =
        findCurrentAnchorElement(
          settings.sourceElement
        );

      scrollState.anchorSelector =
        buildElementSelector(
          anchorElement
        );

      if (anchorElement) {
        scrollState.anchorOffset =
          anchorElement
            .getBoundingClientRect()
            .top;
      }
    } else {
      const anchorElement =
        document.querySelector(
          scrollState.anchorSelector
        );

      if (anchorElement) {
        scrollState.anchorOffset =
          anchorElement
            .getBoundingClientRect()
            .top;
      }
    }

    scrollState.shouldRestore =
      true;

    return {
      ...scrollState
    };
  }

  // ============================================================
  // 還原捲動位置
  // ============================================================

  async function restoreScrollPosition() {
    if (
      !scrollState.shouldRestore
    ) {
      return;
    }

    await waitForFrames(2);

    const selector =
      getText(
        scrollState.anchorSelector
      );

    if (selector) {
      const anchorElement =
        document.querySelector(
          selector
        );

      if (anchorElement) {
        const currentTop =
          anchorElement
            .getBoundingClientRect()
            .top;

        const difference =
          currentTop -
          scrollState.anchorOffset;

        window.scrollTo({
          left:
            scrollState.scrollX,

          top:
            Math.max(
              0,
              (
                window.scrollY ||
                window.pageYOffset ||
                0
              ) +
              difference
            ),

          behavior:
            "auto"
        });

        scrollState.shouldRestore =
          false;

        return;
      }
    }

    window.scrollTo({
      left:
        scrollState.scrollX,

      top:
        scrollState.scrollY,

      behavior:
        "auto"
    });

    scrollState.shouldRestore =
      false;
  }

  // ============================================================
  // 保留原位執行任務
  // ============================================================

  async function preservePosition(
    task,
    options
  ) {
    if (
      typeof task !==
      "function"
    ) {
      throw new Error(
        "preservePosition 需要傳入函式"
      );
    }

    captureScrollPosition(
      options
    );

    try {
      return await task();
    } finally {
      await restoreScrollPosition();
    }
  }

  // ============================================================
  // 重新 Render 並保留原位
  // ============================================================

  async function refreshPage(
    options
  ) {
    const settings = {
      preservePosition:
        true,

      sourceElement:
        null,

      anchorSelector:
        "",

      ...(
        options || {}
      )
    };

    if (state.isRefreshing) {
      return;
    }

    state.isRefreshing =
      true;

    try {
      if (
        settings.preservePosition
      ) {
        captureScrollPosition({
          sourceElement:
            settings.sourceElement,

          anchorSelector:
            settings.anchorSelector
        });
      }

      const result =
        await renderLegacy();

      if (
        settings.preservePosition
      ) {
        await restoreScrollPosition();
      }

      return result;
    } finally {
      state.isRefreshing =
        false;
    }
  }

  // ============================================================
  // 明確回到頁首
  //
  // 只有點擊上方劇本名稱時使用。
  // ============================================================

  function scrollToTop(
    behavior
  ) {
    scrollState.shouldRestore =
      false;

    window.scrollTo({
      top:
        0,

      left:
        0,

      behavior:
        behavior === "auto"
          ? "auto"
          : "smooth"
    });
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYCarDetailController = {
    state,

    scrollState,

    setState,

    getState,

    getCurrentData,

    getCurrentCar,

    syncLegacyGlobals,

    load,

    refresh,

    renderLegacy,

    buildElementSelector,

    findCurrentAnchorElement,

    captureScrollPosition,

    restoreScrollPosition,

    preservePosition,

    refreshPage,

    scrollToTop
  };

  /*
   * 提供舊模組可以直接呼叫的共用方法。
   */
  window.refreshCarDetailPreservingPosition =
    function (options) {
      return window
        .JLYCarDetailController
        .refreshPage(
          options
        );
    };

  window.scrollCarDetailToTop =
    function () {
      return window
        .JLYCarDetailController
        .scrollToTop(
          "smooth"
        );
    };

  console.log(
    "✅ Car Detail Controller V2 已載入"
  );
})();
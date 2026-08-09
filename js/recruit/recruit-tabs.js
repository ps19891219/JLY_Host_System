console.log(
  "recruit-tabs.js 已成功載入！"
);

(function () {
  "use strict";

  let currentTab = "all";

  let carGroups = {
    all: [],
    host: [],
    assist: []
  };

  let onChangeHandler = null;

  // ============================================================
  // 基本工具
  // ============================================================

  function normalizeCars(cars) {
    return Array.isArray(cars)
      ? cars
      : [];
  }

  function getCurrentTab() {
    return currentTab;
  }

  function getCurrentCars() {
    return normalizeCars(
      carGroups[currentTab]
    );
  }

  // ============================================================
  // 設定分類資料
  // ============================================================

  function setCarGroups(groups) {
    const source =
      groups &&
      typeof groups === "object"
        ? groups
        : {};

    carGroups = {
      all:
        normalizeCars(
          source.all
        ),

      host:
        normalizeCars(
          source.host
        ),

      assist:
        normalizeCars(
          source.assist
        )
    };

    updateTabCounts();
  }

  // ============================================================
  // 切換分類
  // ============================================================

  function setTab(tab) {
    const nextTab =
      ["all", "host", "assist"]
        .includes(tab)
        ? tab
        : "all";

    currentTab =
      nextTab;

    updateTabButtons();

    if (
      typeof onChangeHandler ===
      "function"
    ) {
      onChangeHandler(
        getCurrentCars(),
        currentTab
      );
    }
  }

  // ============================================================
  // UI
  // ============================================================

  function getTabsContainer() {
    return document.getElementById(
      "recruitTabs"
    );
  }

  function renderTabs() {
    let container =
      getTabsContainer();

    if (!container) {
      const carList =
        document.getElementById(
          "recruitCarList"
        );

      if (!carList) {
        return;
      }

      container =
        document.createElement(
          "div"
        );

      container.id =
        "recruitTabs";

      container.className =
        "recruit-tabs";

      carList.parentNode.insertBefore(
        container,
        carList
      );
    }

    container.innerHTML = `
      <button
        type="button"
        class="recruit-tab"
        data-recruit-tab="all"
      >
        全部
        <span
          class="recruit-tab-count"
          data-recruit-count="all"
        ></span>
      </button>

      <button
        type="button"
        class="recruit-tab"
        data-recruit-tab="host"
      >
        我主揪的
        <span
          class="recruit-tab-count"
          data-recruit-count="host"
        ></span>
      </button>

      <button
        type="button"
        class="recruit-tab"
        data-recruit-tab="assist"
      >
        我協助的
        <span
          class="recruit-tab-count"
          data-recruit-count="assist"
        ></span>
      </button>
    `;

    container
      .querySelectorAll(
        "[data-recruit-tab]"
      )
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            function () {
              setTab(
                button.dataset
                  .recruitTab
              );
            }
          );
        }
      );

    updateTabButtons();
    updateTabCounts();
  }

  function updateTabButtons() {
    const container =
      getTabsContainer();

    if (!container) {
      return;
    }

    container
      .querySelectorAll(
        "[data-recruit-tab]"
      )
      .forEach(
        function (button) {
          button.classList.toggle(
            "active",
            button.dataset
              .recruitTab ===
              currentTab
          );
        }
      );
  }

  function updateTabCounts() {
    const container =
      getTabsContainer();

    if (!container) {
      return;
    }

    [
      "all",
      "host",
      "assist"
    ].forEach(
      function (tab) {
        const countBox =
          container.querySelector(
            `[data-recruit-count="${tab}"]`
          );

        if (!countBox) {
          return;
        }

        countBox.textContent =
          String(
            normalizeCars(
              carGroups[tab]
            ).length
          );
      }
    );
  }

  // ============================================================
  // 初始化
  // ============================================================

  function init(options) {
    const settings =
      options || {};

    if (
      typeof settings.onChange ===
      "function"
    ) {
      onChangeHandler =
        settings.onChange;
    }

    renderTabs();
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYRecruitTabs = {
    init,
    setCarGroups,
    setTab,
    getCurrentTab,
    getCurrentCars
  };
})();
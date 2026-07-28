console.log(
  "picker-render.js 已成功載入！"
);

(function () {
  function getStateModule() {
    const stateModule =
      window.JLYMemberPickerState;

    if (!stateModule) {
      throw new Error(
        "JLYMemberPickerState 尚未載入"
      );
    }

    return stateModule;
  }

  function getStorageModule() {
    const storageModule =
      window.JLYMemberPickerStorage;

    if (!storageModule) {
      throw new Error(
        "JLYMemberPickerStorage 尚未載入"
      );
    }

    return storageModule;
  }

  function getDataModule() {
    const dataModule =
      window.JLYMemberPickerData;

    if (!dataModule) {
      throw new Error(
        "JLYMemberPickerData 尚未載入"
      );
    }

    return dataModule;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getMemberName(member) {
    return getDataModule()
      .getMemberName(
        member || {}
      );
  }

  function renderMemberButton(
    member
  ) {
    const storageModule =
      getStorageModule();

    const id =
      String(
        member &&
        member.id
          ? member.id
          : ""
      );

    const name =
      getMemberName(member);

    const isFavorite =
      storageModule
        .isFavorite(id);

    return `
      <div class="jly-member-picker-row">
        <button
          type="button"
          class="jly-member-picker-person"
          data-member-id="${escapeHtml(id)}"
        >
          <span class="jly-member-picker-avatar">
            ${escapeHtml(
              name.slice(0, 1) ||
                "人"
            )}
          </span>

          <span class="jly-member-picker-name">
            ${escapeHtml(name)}
          </span>
        </button>

        <button
          type="button"
          class="jly-member-picker-favorite"
          data-favorite-id="${escapeHtml(id)}"
          aria-label="${
            isFavorite
              ? "取消最愛"
              : "加入最愛"
          }"
        >
          ${
            isFavorite
              ? "★"
              : "☆"
          }
        </button>
      </div>
    `;
  }

  function renderSection(
    title,
    members
  ) {
    if (
      !Array.isArray(members) ||
      members.length === 0
    ) {
      return "";
    }

    return `
      <section class="jly-member-picker-section">
        <h3>
          ${escapeHtml(title)}
        </h3>

        <div class="jly-member-picker-list">
          ${
            members
              .map(
                renderMemberButton
              )
              .join("")
          }
        </div>
      </section>
    `;
  }

  function renderEmpty(
    message
  ) {
    return `
      <div class="jly-member-picker-empty">
        ${escapeHtml(message)}
      </div>
    `;
  }

  function renderCreateButton(
    keyword
  ) {
    const safeKeyword =
      String(keyword || "")
        .trim();

    const buttonText =
      safeKeyword
        ? `＋ 新增「${escapeHtml(
            safeKeyword
          )}」`
        : "＋ 新增工作人員";

    return `
      <button
        type="button"
        class="jly-member-picker-create"
        data-create-member
      >
        ${buttonText}
      </button>
    `;
  }

  function getPickerElements() {
    const pickerRoot =
      getStateModule()
        .getPickerRoot();

    if (!pickerRoot) {
      return {
        pickerRoot: null,
        body: null,
        input: null
      };
    }

    return {
      pickerRoot:
        pickerRoot,

      body:
        pickerRoot.querySelector(
          ".jly-member-picker-body"
        ),

      input:
        pickerRoot.querySelector(
          ".jly-member-picker-search"
        )
    };
  }

  function bindBodyEvents() {
    const eventsModule =
      window.JLYMemberPickerEvents;

    if (
      eventsModule &&
      typeof eventsModule
        .bindBodyEvents ===
        "function"
    ) {
      eventsModule
        .bindBodyEvents();
    }
  }

  function renderSearchResults(
    body,
    keyword
  ) {
    const stateModule =
      getStateModule();

    const dataModule =
      getDataModule();

    const allMembers =
      stateModule
        .getAllMembers();

    const results =
      dataModule
        .searchMembers(
          allMembers,
          keyword
        );

    body.innerHTML =
      results.length > 0
        ? renderSection(
            "搜尋結果",
            results
          )
        : (
            renderEmpty(
              `找不到「${keyword}」`
            ) +
            renderCreateButton(
              keyword
            )
          );
  }

  function renderStudioMembers(
    body,
    car,
    studioMemberIds
  ) {
    const stateModule =
      getStateModule();

    const allMembers =
      stateModule
        .getAllMembers();

    const studioName =
      String(
        car.studioName ||
          car.studio ||
          car.organizer ||
          "工作室"
      );

    const studioMembers =
      getDataModule()
        .getMembersByIds(
          allMembers,
          studioMemberIds
        );

    body.innerHTML =
      studioMembers.length > 0
        ? renderSection(
            studioName,
            studioMembers
          )
        : renderEmpty(
            `${studioName}目前尚未設定工作人員`
          );
  }

  function renderHistoryMembers(
    body
  ) {
    const stateModule =
      getStateModule();

    const storageModule =
      getStorageModule();

    const dataModule =
      getDataModule();

    const allMembers =
      stateModule
        .getAllMembers();

    const favoriteIds =
      storageModule
        .getFavoriteIds();

    const recentIds =
      storageModule
        .getRecentIds();

    const favoriteMembers =
      dataModule
        .getMembersByIds(
          allMembers,
          favoriteIds
        );

    const recentMembers =
      dataModule
        .getMembersByIds(
          allMembers,
          recentIds
        )
        .filter(
          function (member) {
            return !favoriteIds
              .includes(
                String(
                  member.id
                )
              );
          }
        );

    const sections =
      renderSection(
        "⭐ 我的最愛",
        favoriteMembers
      ) +
      renderSection(
        "🕘 歷史名單",
        recentMembers
      );

    body.innerHTML =
      sections ||
      renderEmpty(
        "尚無歷史名單，可以先搜尋或新增工作人員"
      );
  }

  function renderBody() {
    const elements =
      getPickerElements();

    const body =
      elements.body;

    const input =
      elements.input;

    if (
      !body ||
      !input
    ) {
      return;
    }

    const stateModule =
      getStateModule();

    const keyword =
      input.value.trim();

    if (keyword) {
      renderSearchResults(
        body,
        keyword
      );

      bindBodyEvents();

      return;
    }

    const currentOptions =
      stateModule
        .getCurrentOptions();

    const car =
      currentOptions.car ||
      {};

    const studioMemberIds =
      stateModule
        .getStudioMemberIds();

    const hasStudio =
      Boolean(
        car.studioId ||
          car.studioName ||
          car.studio ||
          car.organizer
      );

    if (hasStudio) {
      renderStudioMembers(
        body,
        car,
        studioMemberIds
      );
    } else {
      renderHistoryMembers(
        body
      );
    }

    bindBodyEvents();
  }

  function renderLoading() {
    const elements =
      getPickerElements();

    if (!elements.body) {
      return;
    }

    elements.body.innerHTML =
      renderEmpty(
        "正在讀取工作人員……"
      );
  }

  function renderError(
    message
  ) {
    const elements =
      getPickerElements();

    if (!elements.body) {
      return;
    }

    elements.body.innerHTML =
      renderEmpty(
        message ||
        "工作人員讀取失敗，請稍後再試"
      );
  }

  function createPicker() {
    const overlay =
      document.createElement(
        "div"
      );

    overlay.className =
      "jly-member-picker-overlay";

    overlay.innerHTML = `
      <div
        class="jly-member-picker-panel"
        role="dialog"
        aria-modal="true"
        aria-label="選擇工作人員"
      >
        <div class="jly-member-picker-header">
          <h2>
            選擇工作人員
          </h2>

          <button
            type="button"
            class="jly-member-picker-close"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        <div class="jly-member-picker-search-wrap">
          <input
            type="search"
            class="jly-member-picker-search"
            placeholder="搜尋工作人員"
            autocomplete="off"
          >
        </div>

        <button
          type="button"
          class="jly-member-picker-create jly-member-picker-create-top"
          data-create-member
        >
          ＋ 新增工作人員
        </button>

        <div class="jly-member-picker-body">
          <div class="jly-member-picker-empty">
            正在讀取工作人員……
          </div>
        </div>
      </div>
    `;

    return overlay;
  }

  function focusSearchInput() {
    const elements =
      getPickerElements();

    if (elements.input) {
      elements.input.focus();
    }
  }

  window.JLYMemberPickerRender = {
    escapeHtml,

    renderMemberButton,
    renderSection,
    renderEmpty,
    renderCreateButton,

    renderBody,
    renderLoading,
    renderError,

    createPicker,
    focusSearchInput,
    getPickerElements
  };
})();
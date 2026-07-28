console.log("member-picker.js 已成功載入！");

(function () {
  const FAVORITES_KEY = "jlyFavoriteStaffIds";
  const RECENT_KEY = "jlyRecentStaffIds";
  const MAX_RECENT = 12;

  let pickerRoot = null;
  let currentOptions = {};
  let allMembers = [];

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function getMemberName(member) {
    return String(
      member.displayName ||
        member.nickname ||
        member.playerName ||
        member.lineDisplayName ||
        member.name ||
        "未命名工作人員"
    ).trim();
  }

  function readIdList(key) {
    try {
      const value = JSON.parse(
        localStorage.getItem(key) || "[]"
      );

      return Array.isArray(value)
        ? value.map(String)
        : [];
    } catch (error) {
      return [];
    }
  }

  function writeIdList(key, ids) {
    localStorage.setItem(
      key,
      JSON.stringify(ids)
    );
  }

  function getFavoriteIds() {
    return readIdList(FAVORITES_KEY);
  }

  function getRecentIds() {
    return readIdList(RECENT_KEY);
  }

  function rememberRecent(memberId) {
    const id = String(memberId || "");

    if (!id) {
      return;
    }

    const nextIds = [
      id,
      ...getRecentIds().filter(
        function (item) {
          return item !== id;
        }
      )
    ].slice(0, MAX_RECENT);

    writeIdList(
      RECENT_KEY,
      nextIds
    );
  }

  function toggleFavorite(memberId) {
    const id = String(memberId || "");

    if (!id) {
      return;
    }

    const currentIds =
      getFavoriteIds();

    const exists =
      currentIds.includes(id);

    const nextIds = exists
      ? currentIds.filter(
          function (item) {
            return item !== id;
          }
        )
      : [id, ...currentIds];

    writeIdList(
      FAVORITES_KEY,
      nextIds
    );

    renderBody();
  }

  function close() {
    if (!pickerRoot) {
      return;
    }

    document.removeEventListener(
      "keydown",
      handleKeydown
    );

    pickerRoot.remove();
    pickerRoot = null;
    currentOptions = {};
    allMembers = [];
  }

    function handleKeydown(event) {
    if (event.key === "Escape") {
      close();
    }
  }

  async function loadAllMembers() {
    const db = window.db;

    if (!db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    const snapshot =
      await db
        .collection("players")
        .get();

    allMembers =
      snapshot.docs
        .map(function (doc) {
          return {
            id: doc.id,
            ...doc.data()
          };
        })
        .filter(function (member) {
          return (
            member.status !==
            "deleted"
          );
        })
        .sort(function (a, b) {
          return getMemberName(a)
            .localeCompare(
              getMemberName(b),
              "zh-Hant"
            );
        });

    return allMembers;
  }

  async function loadStudioMemberIds(
    car
  ) {
    const safeCar =
      car || {};

    const directIds = [
      ...(
        Array.isArray(
          safeCar.staffIds
        )
          ? safeCar.staffIds
          : []
      ),
      ...(
        Array.isArray(
          safeCar.dmIds
        )
          ? safeCar.dmIds
          : []
      ),
      ...(
        Array.isArray(
          safeCar.studioStaffIds
        )
          ? safeCar.studioStaffIds
          : []
      )
    ].map(String);

    if (directIds.length > 0) {
      return [
        ...new Set(directIds)
      ];
    }

    const studioId =
      String(
        safeCar.studioId ||
          safeCar.organizerId ||
          ""
      ).trim();

    if (
      !studioId ||
      !window.db
    ) {
      return [];
    }

    try {
      const studioDoc =
        await window.db
          .collection("studios")
          .doc(studioId)
          .get();

      if (!studioDoc.exists) {
        return [];
      }

      const studio =
        studioDoc.data() || {};

      return [
        ...(
          Array.isArray(
            studio.staffIds
          )
            ? studio.staffIds
            : []
        ),
        ...(
          Array.isArray(
            studio.memberIds
          )
            ? studio.memberIds
            : []
        ),
        ...(
          Array.isArray(
            studio.dmIds
          )
            ? studio.dmIds
            : []
        )
      ].map(String);
    } catch (error) {
      console.warn(
        "讀取工作室工作人員名單失敗：",
        error
      );

      return [];
    }
  }

  function getMembersByIds(
    ids
  ) {
    const idSet =
      new Set(
        (
          Array.isArray(ids)
            ? ids
            : []
        ).map(String)
      );

    return allMembers.filter(
      function (member) {
        return idSet.has(
          String(member.id)
        );
      }
    );
  }

    function renderMemberButton(
    member
  ) {
    const id =
      String(
        member.id || ""
      );

    const name =
      getMemberName(member);

    const isFavorite =
      getFavoriteIds()
        .includes(id);

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

  function getSearchResults(
    keyword
  ) {
    const target =
      normalizeText(keyword);

    if (!target) {
      return [];
    }

    return allMembers.filter(
      function (member) {
        const values = [
          getMemberName(member),
          member.nickname,
          member.playerName,
          member.lineDisplayName,
          ...(
            Array.isArray(
              member.aliases
            )
              ? member.aliases
              : []
          )
        ];

        return values.some(
          function (value) {
            return normalizeText(
              value
            ).includes(target);
          }
        );
      }
    );
  }

  async function createMember(
    name
  ) {
    const displayName =
      String(name || "")
        .trim();

    if (!displayName) {
      alert(
        "請輸入工作人員名稱"
      );

      return;
    }

    if (!window.db) {
      alert(
        "Firebase 尚未載入"
      );

      return;
    }

    const normalizedName =
      normalizeText(
        displayName
      );

    const duplicate =
      allMembers.find(
        function (member) {
          return (
            normalizeText(
              getMemberName(
                member
              )
            ) ===
            normalizedName
          );
        }
      );

    if (duplicate) {
      await selectMember(
        duplicate
      );

      return;
    }

        try {
      const now =
        new Date()
          .toISOString();

      const ref =
        await window.db
          .collection("players")
          .add({
            displayName:
              displayName,

            nickname:
              displayName,

            aliases:
              [],

            memberType:
              "guest",

            type:
              "guest",

            status:
              "active",

            isLineLinked:
              false,

            staffEnabled:
              true,

            source:
              "host_manual_staff",

            createdAt:
              now,

            updatedAt:
              now
          });

      const member = {
        id:
          ref.id,

        displayName:
          displayName,

        nickname:
          displayName,

        aliases:
          [],

        memberType:
          "guest",

        status:
          "active",

        staffEnabled:
          true
      };

      allMembers.push(
        member
      );

      await selectMember(
        member
      );
    } catch (error) {
      console.error(
        "新增工作人員失敗：",
        error
      );

      alert(
        "新增失敗，請稍後再試"
      );
    }
  }

  async function selectMember(
    member
  ) {
    rememberRecent(
      member.id
    );

    const onSelect =
      currentOptions.onSelect;

    if (
      typeof onSelect ===
      "function"
    ) {
      await onSelect({
        memberId:
          String(member.id),

        displayName:
          getMemberName(
            member
          ),

        member:
          member
      });
    }

    close();
  }

  function bindBodyEvents() {
    if (!pickerRoot) {
      return;
    }

    pickerRoot
      .querySelectorAll(
        "[data-member-id]"
      )
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            async function () {
              const memberId =
                button.dataset
                  .memberId;

              const member =
                allMembers.find(
                  function (item) {
                    return (
                      String(
                        item.id
                      ) ===
                      String(
                        memberId
                      )
                    );
                  }
                );

              if (member) {
                await selectMember(
                  member
                );
              }
            }
          );
        }
      );

    pickerRoot
      .querySelectorAll(
        "[data-favorite-id]"
      )
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            function (event) {
              event
                .stopPropagation();

              toggleFavorite(
                button.dataset
                  .favoriteId
              );
            }
          );
        }
      );

          const createButton =
      pickerRoot
        .querySelector(
          "[data-create-member]"
        );

    if (createButton) {
      createButton
        .addEventListener(
          "click",
          async function () {
            const input =
              pickerRoot
                .querySelector(
                  ".jly-member-picker-search"
                );

            await createMember(
              input
                ? input.value
                : ""
            );
          }
        );
    }
  }

  function renderBody() {
    if (!pickerRoot) {
      return;
    }

    const body =
      pickerRoot
        .querySelector(
          ".jly-member-picker-body"
        );

    const input =
      pickerRoot
        .querySelector(
          ".jly-member-picker-search"
        );

    if (
      !body ||
      !input
    ) {
      return;
    }

    const keyword =
      input.value.trim();

    if (keyword) {
      const results =
        getSearchResults(
          keyword
        );

      body.innerHTML =
        results.length > 0
          ? renderSection(
              "搜尋結果",
              results
            )
          : `
            <div class="jly-member-picker-empty">
              找不到「${escapeHtml(keyword)}」
            </div>

            <button
              type="button"
              class="jly-member-picker-create"
              data-create-member
            >
              ＋ 新增「${escapeHtml(keyword)}」
            </button>
          `;

      bindBodyEvents();

      return;
    }

    const car =
      currentOptions.car ||
      {};

    const studioIds =
      Array.isArray(
        currentOptions
          .studioMemberIds
      )
        ? currentOptions
            .studioMemberIds
        : [];

    const hasStudio =
      Boolean(
        car.studioId ||
          car.studioName ||
          car.studio ||
          car.organizer
      );

    if (hasStudio) {
      const studioName =
        String(
          car.studioName ||
            car.studio ||
            car.organizer ||
            "工作室"
        );

      const studioMembers =
        getMembersByIds(
          studioIds
        );

      body.innerHTML =
        studioMembers.length > 0
          ? renderSection(
              studioName,
              studioMembers
            )
          : `
            <div class="jly-member-picker-empty">
              ${escapeHtml(studioName)}目前尚未設定工作人員
            </div>
          `;
    } else {
      const favoriteIds =
        getFavoriteIds();

      const favoriteMembers =
        getMembersByIds(
          favoriteIds
        );

      const recentMembers =
        getMembersByIds(
          getRecentIds()
        ).filter(
          function (member) {
            return !favoriteIds
              .includes(
                String(
                  member.id
                )
              );
          }
        );

      body.innerHTML =
        (
          renderSection(
            "⭐ 我的最愛",
            favoriteMembers
          ) +
          renderSection(
            "🕘 歷史名單",
            recentMembers
          )
        ) ||
        `
          <div class="jly-member-picker-empty">
            尚無歷史名單，可以先搜尋或新增工作人員
          </div>
        `;
    }

    bindBodyEvents();
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

    overlay.addEventListener(
      "click",
      function (event) {
        if (
          event.target ===
          overlay
        ) {
          close();
        }
      }
    );

    overlay
      .querySelector(
        ".jly-member-picker-close"
      )
      .addEventListener(
        "click",
        close
      );

    const searchInput =
      overlay.querySelector(
        ".jly-member-picker-search"
      );

    searchInput
      .addEventListener(
        "input",
        renderBody
      );

    return overlay;
  }

  async function open(
    options = {}
  ) {
    close();

    currentOptions =
      options;

    pickerRoot =
      createPicker();

    document.body
      .appendChild(
        pickerRoot
      );

    document.addEventListener(
      "keydown",
      handleKeydown
    );

    try {
      await loadAllMembers();

      currentOptions
        .studioMemberIds =
        await loadStudioMemberIds(
          currentOptions.car ||
            {}
        );

      renderBody();

      const input =
        pickerRoot
          .querySelector(
            ".jly-member-picker-search"
          );

      if (input) {
        input.focus();
      }
    } catch (error) {
      console.error(
        "讀取工作人員失敗：",
        error
      );

      const body =
        pickerRoot
          .querySelector(
            ".jly-member-picker-body"
          );

      if (body) {
        body.innerHTML = `
          <div class="jly-member-picker-empty">
            工作人員讀取失敗，請稍後再試
          </div>
        `;
      }
    }
  }

  window.JLYMemberPicker = {
    open:
      open,

    close:
      close,

    toggleFavorite:
      toggleFavorite
  };
})();
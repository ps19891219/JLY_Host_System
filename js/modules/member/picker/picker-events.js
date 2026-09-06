console.log(
  "picker-events.js 已成功載入！"
);

(function () {
  function getStateModule() {
    return window.JLYMemberPickerState;
  }

  function getRenderModule() {
    return window.JLYMemberPickerRender;
  }

  function getStorageModule() {
    return window.JLYMemberPickerStorage;
  }

  function getCreateModule() {
    return window.JLYMemberPickerCreate;
  }

  function getControllerModule() {
    return window.JLYMemberPickerController;
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      getControllerModule().close();
    }
  }

  function bindOverlayEvents() {
    const render =
      getRenderModule();

    const state =
      getStateModule();

    const pickerRoot =
      state.getPickerRoot();

    if (!pickerRoot) {
      return;
    }

    pickerRoot.addEventListener(
      "click",
      function (event) {
        if (
          event.target ===
          pickerRoot
        ) {
          getControllerModule().close();
        }
      }
    );

    const closeButton =
      pickerRoot.querySelector(
        ".jly-member-picker-close"
      );

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        function () {
          getControllerModule().close();
        }
      );
    }

    const searchInput =
      pickerRoot.querySelector(
        ".jly-member-picker-search"
      );

    if (searchInput) {
      searchInput.addEventListener(
        "input",
        function () {
          render.renderBody();
        }
      );
    }

    document.addEventListener(
      "keydown",
      handleKeydown
    );
  }

  async function handleSelectMember(
    memberId
  ) {
    const state =
      getStateModule();

    const storage =
      getStorageModule();

    const members =
      state.getAllMembers();

    const member =
      members.find(
        function (item) {
          return (
            String(item.id) ===
            String(memberId)
          );
        }
      );

    if (!member) {
      return;
    }

    storage.rememberRecent(
      member.id
    );

    const options =
      state.getCurrentOptions();

    if (
      typeof options.onSelect ===
      "function"
    ) {
      await options.onSelect({
        memberId:
          String(member.id),

        displayName:
          member.displayName ||
          member.nickname ||
          "",

        member:
          member
      });
    }

    getControllerModule().close();
  }

  function sameNameWarning(name, candidates) {
    const names = (Array.isArray(candidates) ? candidates : [])
      .map(function (member) {
        return String(member.displayName || member.nickname || member.playerName || name || "").trim();
      })
      .filter(Boolean);

    const shownName = String(name || names[0] || "這個名字").trim();
    return (
      "已經找到同名 Person「" + shownName + "」。\n\n" +
      "如果就是同一個人，請取消並直接點選上方既有 Person。\n" +
      "只有確定是另一位不同的人，才按確定建立新的同名 Person。"
    );
  }

  async function createStaffFromInput(input) {
    const create = getCreateModule();
    const displayName = input ? input.value : "";

    try {
      return await create.prepareMemberForStaff(displayName);
    } catch (error) {
      if (!error || error.code !== "same_name_person_requires_resolution") {
        throw error;
      }

      const confirmed = window.confirm(
        sameNameWarning(displayName, error.sameNameCandidates)
      );

      if (!confirmed) {
        return null;
      }

      return create.prepareMemberForStaff(displayName, {
        allowSameNamePerson: true
      });
    }
  }

  function bindBodyEvents() {
    const render =
      getRenderModule();

    const state =
      getStateModule();

    const pickerRoot =
      state.getPickerRoot();

    if (!pickerRoot) {
      return;
    }

    pickerRoot
      .querySelectorAll(
        "[data-member-id]"
      )
      .forEach(function (button) {
        button.addEventListener(
          "click",
          async function () {
            await handleSelectMember(
              button.dataset
                .memberId
            );
          }
        );
      });

    pickerRoot
      .querySelectorAll(
        "[data-favorite-id]"
      )
      .forEach(function (button) {
        button.addEventListener(
          "click",
          function (event) {
            event.stopPropagation();

            getStorageModule()
              .toggleFavorite(
                button.dataset
                  .favoriteId
              );

            render.renderBody();
          }
        );
      });

    const createButton =
      pickerRoot.querySelector(
        "[data-create-member]"
      );

    if (createButton) {
      createButton.addEventListener(
        "click",
        async function () {
          const input =
            pickerRoot.querySelector(
              ".jly-member-picker-search"
            );

          const result =
            await createStaffFromInput(
              input
            );

          if (!result) {
            return;
          }

          await handleSelectMember(
            result.id
          );
        }
      );
    }
  }

  function removeGlobalEvents() {
    document.removeEventListener(
      "keydown",
      handleKeydown
    );
  }

  window.JLYMemberPickerEvents =
    {
      bindOverlayEvents,

      bindBodyEvents,

      removeGlobalEvents,

      handleKeydown,
      sameNameWarning,
      createStaffFromInput
    };
})();
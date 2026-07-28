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
            await getCreateModule()
              .prepareMemberForStaff(
                input
                  ? input.value
                  : ""
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

      handleKeydown
    };
})();
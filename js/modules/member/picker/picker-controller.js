console.log(
  "picker-controller.js 已成功載入！"
);

(function () {
  function getState() {
    return window.JLYMemberPickerState;
  }

  function getData() {
    return window.JLYMemberPickerData;
  }

  function getRender() {
    return window.JLYMemberPickerRender;
  }

  function getEvents() {
    return window.JLYMemberPickerEvents;
  }

  async function open(options = {}) {
    close();

    const state = getState();

    state.setCurrentOptions(options);

    const pickerRoot =
      getRender().createPicker();

    state.setPickerRoot(
      pickerRoot
    );

    document.body.appendChild(
      pickerRoot
    );

    getEvents().bindOverlayEvents();

    getRender().renderLoading();

    try {
      state.setIsLoading(true);

      const members =
        await getData().loadAllMembers();

      state.setAllMembers(
        members
      );

      const studioMemberIds =
        await getData().loadStudioMemberIds(
          options.car || {}
        );

      state.setStudioMemberIds(
        studioMemberIds
      );

      state.setIsLoading(
        false
      );

      getRender().renderBody();

      getRender().focusSearchInput();
    } catch (error) {
      console.error(
        "讀取工作人員失敗：",
        error
      );

      state.setIsLoading(
        false
      );

      getRender().renderError(
        "工作人員讀取失敗，請稍後再試"
      );
    }
  }

  function close() {
    const state = getState();

    const pickerRoot =
      state.getPickerRoot();

    if (!pickerRoot) {
      return;
    }

    getEvents().removeGlobalEvents();

    pickerRoot.remove();

    state.reset();
  }

  window.JLYMemberPickerController =
    {
      open,
      close
    };
})();
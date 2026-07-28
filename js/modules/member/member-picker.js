console.log(
  "member-picker.js 已成功載入！"
);

(function () {
  window.JLYMemberPicker = {
    open(options) {
      return window
        .JLYMemberPickerController
        .open(options);
    },

    close() {
      return window
        .JLYMemberPickerController
        .close();
    },

    toggleFavorite(memberId) {
      window
        .JLYMemberPickerStorage
        .toggleFavorite(
          memberId
        );

      window
        .JLYMemberPickerRender
        .renderBody();
    }
  };
})();
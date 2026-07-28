console.log("member-picker.js 已成功載入！");

(function () {
  function open(options = {}) {
    alert("Member Picker V1（下一步開始製作）");

    if (
      typeof options.onClose === "function"
    ) {
      options.onClose();
    }
  }

  window.JLYMemberPicker = {
    open
  };
})();
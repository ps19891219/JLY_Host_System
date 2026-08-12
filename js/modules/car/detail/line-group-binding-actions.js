(function () {
  "use strict";

  function getCommand(carId) {
    return `JLY 綁定車團 ${String(carId || "").trim()}`;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  async function copyLineGroupBindingCommand(carId, button) {
    const command = getCommand(carId);
    if (!String(carId || "").trim()) {
      return;
    }

    try {
      await copyText(command);
      const originalText = button && button.textContent;
      if (button) {
        button.textContent = "已複製，請貼到 LINE 群組";
        button.disabled = true;
        window.setTimeout(function () {
          button.textContent = originalText;
          button.disabled = false;
        }, 2200);
      }
    } catch (error) {
      console.error("複製 LINE 群組綁定指令失敗", error);
      window.prompt("請複製這段文字並貼到 LINE 群組：", command);
    }
  }

  window.copyLineGroupBindingCommand = copyLineGroupBindingCommand;
  window.JLYLineGroupBindingActions = {
    getCommand,
    copyLineGroupBindingCommand
  };
})();

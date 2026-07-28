console.log(
  "member-picker.js 已成功載入！"
);

(function () {
  let pickerRoot = null;

  function close() {
    if (!pickerRoot) {
      return;
    }

    pickerRoot.remove();
    pickerRoot = null;
  }

  function createPicker() {
    const overlay =
      document.createElement("div");

    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "9999";
    overlay.style.background =
      "rgba(0, 0, 0, 0.45)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent =
      "center";
    overlay.style.padding = "20px";

    const panel =
      document.createElement("div");

    panel.style.width = "100%";
    panel.style.maxWidth = "420px";
    panel.style.maxHeight = "80vh";
    panel.style.background = "#ffffff";
    panel.style.borderRadius = "18px";
    panel.style.boxShadow =
      "0 18px 50px rgba(0, 0, 0, 0.22)";
    panel.style.overflow = "hidden";

    const header =
      document.createElement("div");

    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent =
      "space-between";
    header.style.padding =
      "16px 18px";
    header.style.borderBottom =
      "1px solid #eeeeee";

    const title =
      document.createElement("div");

    title.textContent =
      "選擇工作人員";

    title.style.fontSize = "18px";
    title.style.fontWeight = "700";

    const closeButton =
      document.createElement("button");

    closeButton.type = "button";
    closeButton.textContent = "✕";

    closeButton.style.border = "none";
    closeButton.style.background =
      "transparent";
    closeButton.style.fontSize = "22px";
    closeButton.style.cursor = "pointer";
    closeButton.style.padding = "4px 8px";

    const body =
      document.createElement("div");

    body.style.padding = "24px 18px";
    body.style.textAlign = "center";
    body.style.color = "#777777";

    body.textContent =
      "人員名單準備中";

    closeButton.addEventListener(
      "click",
      close
    );

    overlay.addEventListener(
      "click",
      function (event) {
        if (event.target === overlay) {
          close();
        }
      }
    );

    header.appendChild(title);
    header.appendChild(closeButton);

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.appendChild(panel);

    return overlay;
  }

  function open(options = {}) {
    close();

    pickerRoot = createPicker();

    document.body.appendChild(
      pickerRoot
    );
  }

  window.JLYMemberPicker = {
    open,
    close
  };
})();
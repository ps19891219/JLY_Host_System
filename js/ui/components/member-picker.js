console.log(
  "★★★★★ Member Picker V2 已載入 ★★★★★"
);

(function () {
  let pickerRoot = null;
  let currentOptions = {};

  /*
   * 目前先使用測試資料。
   * 下一階段再改成讀取 Firestore。
   */
  const temporaryMembers = [
    {
      memberId: "temp-kevin",
      displayName: "凱威"
    },
    {
      memberId: "temp-xiaomei",
      displayName: "小美"
    },
    {
      memberId: "temp-azhe",
      displayName: "阿哲"
    },
    {
      memberId: "temp-xiaoan",
      displayName: "小安"
    }
  ];

  function close() {
    if (!pickerRoot) {
      return;
    }

    pickerRoot.remove();
    pickerRoot = null;
    currentOptions = {};
  }

  function selectMember(member) {
    if (
      typeof currentOptions.onSelect ===
      "function"
    ) {
      currentOptions.onSelect(member);
    }

    close();
  }

  function createMemberButton(member) {
    const button =
      document.createElement("button");

    button.type = "button";

    button.style.width = "100%";
    button.style.border = "none";
    button.style.borderBottom =
      "1px solid #f0f0f0";
    button.style.background = "#ffffff";
    button.style.padding = "15px 4px";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent =
      "space-between";
    button.style.cursor = "pointer";
    button.style.textAlign = "left";

    const name =
      document.createElement("span");

    name.textContent =
      member.displayName;

    name.style.fontSize = "16px";
    name.style.fontWeight = "600";
    name.style.color = "#333333";

    const arrow =
      document.createElement("span");

    arrow.textContent = "›";
    arrow.style.fontSize = "22px";
    arrow.style.color = "#aaaaaa";

    button.appendChild(name);
    button.appendChild(arrow);

    button.addEventListener(
      "click",
      function () {
        selectMember(member);
      }
    );

    button.addEventListener(
      "mouseenter",
      function () {
        button.style.background =
          "#fafafa";
      }
    );

    button.addEventListener(
      "mouseleave",
      function () {
        button.style.background =
          "#ffffff";
      }
    );

    return button;
  }

  function renderMemberList(
    listContainer,
    keyword
  ) {
    listContainer.innerHTML = "";

    const normalizedKeyword =
      String(keyword || "")
        .trim()
        .toLowerCase();

    const filteredMembers =
      temporaryMembers.filter(
        function (member) {
          return String(
            member.displayName || ""
          )
            .toLowerCase()
            .includes(
              normalizedKeyword
            );
        }
      );

    if (
      filteredMembers.length === 0
    ) {
      const empty =
        document.createElement("div");

      empty.textContent =
        "找不到符合的人員";

      empty.style.padding = "28px 8px";
      empty.style.textAlign = "center";
      empty.style.color = "#888888";
      empty.style.fontSize = "14px";

      listContainer.appendChild(empty);

      return;
    }

    filteredMembers.forEach(
      function (member) {
        listContainer.appendChild(
          createMemberButton(member)
        );
      }
    );
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
    panel.style.display = "flex";
    panel.style.flexDirection = "column";

    const header =
      document.createElement("div");

    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent =
      "space-between";
    header.style.padding = "16px 18px";
    header.style.borderBottom =
      "1px solid #eeeeee";
    header.style.flexShrink = "0";

    const title =
      document.createElement("div");

    title.textContent =
      "選擇工作人員";

    title.style.fontSize = "18px";
    title.style.fontWeight = "700";
    title.style.color = "#222222";

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

    body.style.padding = "14px 18px 18px";
    body.style.overflowY = "auto";

    const searchInput =
      document.createElement("input");

    searchInput.type = "search";
    searchInput.placeholder =
      "搜尋工作人員";

    searchInput.style.width = "100%";
    searchInput.style.boxSizing =
      "border-box";
    searchInput.style.border =
      "1px solid #dddddd";
    searchInput.style.borderRadius =
      "12px";
    searchInput.style.padding =
      "12px 14px";
    searchInput.style.fontSize = "16px";
    searchInput.style.outline = "none";

    const addButton =
      document.createElement("button");

    addButton.type = "button";
    addButton.textContent =
      "＋ 新增工作人員";

    addButton.style.width = "100%";
    addButton.style.marginTop = "12px";
    addButton.style.border =
      "1px dashed #bbbbbb";
    addButton.style.borderRadius =
      "12px";
    addButton.style.background =
      "#fafafa";
    addButton.style.padding = "12px";
    addButton.style.fontSize = "15px";
    addButton.style.fontWeight = "600";
    addButton.style.cursor = "pointer";

    const sectionTitle =
      document.createElement("div");

    sectionTitle.textContent =
      "工作室";

    sectionTitle.style.marginTop = "20px";
    sectionTitle.style.marginBottom =
      "6px";
    sectionTitle.style.fontSize = "14px";
    sectionTitle.style.fontWeight = "700";
    sectionTitle.style.color = "#777777";

    const memberList =
      document.createElement("div");

    memberList.style.borderTop =
      "1px solid #f0f0f0";

    searchInput.addEventListener(
      "input",
      function () {
        renderMemberList(
          memberList,
          searchInput.value
        );
      }
    );

    addButton.addEventListener(
      "click",
      function () {
        alert(
          "下一步會接上新增工作人員功能"
        );
      }
    );

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

    body.appendChild(searchInput);
    body.appendChild(addButton);
    body.appendChild(sectionTitle);
    body.appendChild(memberList);

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.appendChild(panel);

    renderMemberList(
      memberList,
      ""
    );

    return overlay;
  }

  function open(options = {}) {
    close();

    currentOptions = options;

    pickerRoot = createPicker();

    document.body.appendChild(
      pickerRoot
    );

    const searchInput =
      pickerRoot.querySelector(
        'input[type="search"]'
      );

    if (searchInput) {
      setTimeout(
        function () {
          searchInput.focus();
        },
        50
      );
    }
  }

  window.JLYMemberPicker = {
    open,
    close
  };
})();
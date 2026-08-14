(function () {
  "use strict";

  const query = new URLSearchParams(location.search);
  const token = query.get("token") || "";

  let context = null;
  let pendingEntryId = "";

  const el = id => document.getElementById(id);

  const money = value =>
    `$${Number(value || 0).toLocaleString("zh-TW")}`;


  // =====================================
  // Accounting navigation
  // =====================================

  function showAccountingTab(name) {
    const allowedTabs = [
      "merchant",
      "expenses",
      "ledger"
    ];

    const activeTab =
      allowedTabs.includes(name)
        ? name
        : "expenses";

    document
      .querySelectorAll(".accounting-panel")
      .forEach(node => {
        node.classList.toggle(
          "hidden",
          node.id !== `accounting-${activeTab}`
        );
      });

    document
      .querySelectorAll("[data-accounting-tab]")
      .forEach(node => {
        node.classList.toggle(
          "active",
          node.dataset.accountingTab === activeTab
        );
      });
  }


  // =====================================
  // Login
  // =====================================

  function requireLogin() {
    if (
      context &&
      context.currentMember
    ) {
      return true;
    }

    el("loginPrompt")
      .classList
      .remove("hidden");

    return false;
  }


  // =====================================
  // Member helpers
  // =====================================

  function memberName(id) {
    const memberId = String(id || "");

    const item =
      (context && context.members || [])
        .find(member =>
          String(member.memberId || "") === memberId
        );

    return (
      item &&
      item.displayName
    ) || "成員";
  }


  function currentMemberId() {
    if (
      !context ||
      !context.currentMember
    ) {
      return "";
    }

    const candidates = [
      context.currentMember.identityId,
      context.currentMember.profileId,
      context.currentMember.memberId
    ]
      .map(value => String(value || ""))
      .filter(Boolean);

    const members =
      context.members || [];

    return (
      candidates.find(id =>
        members.some(member =>
          String(member.memberId || "") === id
        )
      ) ||
      ""
    );
  }


  // =====================================
  // Share members
  // =====================================

  function renderShareMembers() {
    const shares = el("shareMemberList");

    shares.innerHTML = "";

    (context.members || []).forEach(member => {
      const row =
        document.createElement("label");

      const checkbox =
        document.createElement("input");

      const name =
        document.createElement("span");

      const amountInput =
        document.createElement("input");

      row.className = "share-row";

      checkbox.type = "checkbox";
      checkbox.className = "share-check";
      checkbox.value = member.memberId;
      checkbox.checked = true;

      name.textContent =
        member.displayName;

      amountInput.type = "number";
      amountInput.className = "share-amount";
      amountInput.min = "1";
      amountInput.step = "1";
      amountInput.inputMode = "numeric";
      amountInput.dataset.memberId =
        member.memberId;

      amountInput.setAttribute(
        "aria-label",
        `${member.displayName} 分攤金額`
      );

      checkbox.addEventListener(
        "change",
        () => {
          amountInput.disabled =
            !checkbox.checked;

          distributeShares();
        }
      );

      row.append(
        checkbox,
        name,
        amountInput
      );

      shares.appendChild(row);
    });

    distributeShares();
  }


  function distributeShares() {
    const total =
      Math.max(
        0,
        Math.floor(
          Number(
            el("entryAmount").value
          ) || 0
        )
      );

    const rows = [
      ...document.querySelectorAll(
        ".share-row"
      )
    ].filter(row =>
      row
        .querySelector(".share-check")
        .checked
    );

    if (!rows.length) {
      return;
    }

    const base =
      Math.floor(
        total / rows.length
      );

    rows.forEach((row, index) => {
      row
        .querySelector(".share-amount")
        .value =
          index === rows.length - 1
            ? total -
              base *
              (rows.length - 1)
            : base;
    });
  }


  // =====================================
  // Payment rows
  // =====================================

  function buildPaymentSelect(
    selectedMemberId = ""
  ) {
    const select =
      document.createElement("select");

    select.className =
      "payment-member";

    select.setAttribute(
      "aria-label",
      "付款人"
    );

    (context.members || []).forEach(member => {
      const option =
        document.createElement("option");

      option.value =
        member.memberId;

      option.textContent =
        member.displayName;

      option.selected =
        String(member.memberId) ===
        String(selectedMemberId);

      select.appendChild(option);
    });

    return select;
  }


  function addPaymentRow(
    payment = {},
    options = {}
  ) {
    const list =
      el("paymentList");

    const row =
      document.createElement("div");

    const selectedId =
      String(
        payment.memberId ||
        payment.personId ||
        ""
      );

    const select =
      buildPaymentSelect(
        selectedId
      );

    const amountInput =
      document.createElement("input");

    const remove =
      document.createElement("button");

    row.className =
      "payment-row";

    amountInput.type =
      "number";

    amountInput.className =
      "payment-amount";

    amountInput.min =
      "1";

    amountInput.step =
      "1";

    amountInput.inputMode =
      "numeric";

    amountInput.placeholder =
      "金額";

    amountInput.value =
      payment.amount
        ? Number(payment.amount)
        : "";

    amountInput.setAttribute(
      "aria-label",
      "付款金額"
    );

    remove.type =
      "button";

    remove.className =
      "payment-remove";

    remove.textContent =
      "×";

    remove.setAttribute(
      "aria-label",
      "移除付款人"
    );

    select.addEventListener(
      "change",
      updatePaymentTotal
    );

    amountInput.addEventListener(
      "input",
      updatePaymentTotal
    );

    remove.addEventListener(
      "click",
      () => {
        const rows =
          document.querySelectorAll(
            ".payment-row"
          );

        if (rows.length <= 1) {
          amountInput.value =
            el("entryAmount").value || "";

          select.value =
            currentMemberId() ||
            (
              context.members &&
              context.members[0] &&
              context.members[0].memberId
            ) ||
            "";

          updatePaymentTotal();
          return;
        }

        row.remove();

        updatePaymentTotal();
      }
    );

    row.append(
      select,
      amountInput,
      remove
    );

    list.appendChild(row);

    if (
      options.focusAmount
    ) {
      amountInput.focus();
    }

    updatePaymentTotal();
  }


  function resetPaymentRows(
    payments = null
  ) {
    el("paymentList").innerHTML = "";

    if (
      Array.isArray(payments) &&
      payments.length
    ) {
      payments.forEach(payment =>
        addPaymentRow(payment)
      );

      updatePaymentTotal();

      return;
    }

    const total =
      Number(
        el("entryAmount").value
      ) || 0;

    const defaultMemberId =
      currentMemberId() ||
      (
        context.members &&
        context.members[0] &&
        context.members[0].memberId
      ) ||
      "";

    addPaymentRow({
      memberId:
        defaultMemberId,

      amount:
        total > 0
          ? total
          : ""
    });
  }


  function getPaymentItems() {
    return [
      ...document.querySelectorAll(
        ".payment-row"
      )
    ]
      .map(row => ({
        memberId:
          row
            .querySelector(
              ".payment-member"
            )
            .value,

        amount:
          Number(
            row
              .querySelector(
                ".payment-amount"
              )
              .value
          )
      }))
      .filter(item =>
        item.memberId
      );
  }


  function updatePaymentTotal() {
    const total =
      Number(
        el("entryAmount").value
      ) || 0;

    const paymentTotal =
      getPaymentItems()
        .reduce(
          (sum, item) =>
            sum +
            (
              Number.isFinite(
                item.amount
              )
                ? item.amount
                : 0
            ),
          0
        );

    const status =
      el("paymentTotal");

    status.textContent =
      `已付款 ${money(paymentTotal)} / ${money(total)}`;

    status.classList.toggle(
      "invalid",
      total > 0 &&
      paymentTotal !== total
    );
  }


  function syncSinglePaymentToTotal() {
    const rows = [
      ...document.querySelectorAll(
        ".payment-row"
      )
    ];

    if (
      rows.length !== 1
    ) {
      updatePaymentTotal();
      return;
    }

    const amountInput =
      rows[0].querySelector(
        ".payment-amount"
      );

    amountInput.value =
      el("entryAmount").value || "";

    updatePaymentTotal();
  }


  // =====================================
  // Accounting total / member ledger
  // =====================================

  function renderBalances(items) {
    const list =
      el("memberBalances");

    list.innerHTML = "";

    if (!items.length) {
      list.className =
        "list empty";

      list.textContent =
        "目前沒有分帳資料";

      return;
    }

    list.className =
      "list";

    items.forEach(item => {
      const row =
        document.createElement("div");

      const name =
        document.createElement("span");

      const result =
        document.createElement("b");

      const currentNet =
        Number(
          item.currentNetAmount != null
            ? item.currentNetAmount
            : item.netAmount
        ) || 0;

      const paidAmount =
        Number(
          item.paidAmount
        ) || 0;

      const shareAmount =
        Number(
          item.shareAmount
        ) || 0;

      name.innerHTML =
        `<strong>${memberName(item.personId)}</strong>` +
        `<small>` +
        `本次花費 ${money(shareAmount)}` +
        `｜實際付款 ${money(paidAmount)}` +
        `</small>`;

      result.textContent =
        currentNet > 0
          ? `待收 ${money(currentNet)}`
          : currentNet < 0
            ? `待付 ${money(-currentNet)}`
            : "✅ 已結清";

      row.append(
        name,
        result
      );

      list.appendChild(row);
    });
  }


  // =====================================
  // Settlement plan
  // =====================================

  function renderTransfers(items) {
    const list =
      el("settlementTransfers");

    list.innerHTML = "";

    if (!items.length) {
      list.className =
        "list empty";

      list.textContent =
        "✅ 目前帳款均已結清";

      return;
    }

    list.className =
      "list";

    items.forEach(item => {
      const row =
        document.createElement("div");

      const transferText =
        document.createElement("span");

      const value =
        document.createElement("b");

      transferText.innerHTML =
        `<strong>` +
        `${memberName(item.fromPersonId)}` +
        ` → ` +
        `${memberName(item.toPersonId)}` +
        `</strong>` +
        `<small>建議結算</small>`;

      value.textContent =
        money(item.amount);

      row.append(
        transferText,
        value
      );

      list.appendChild(row);
    });
  }


  // =====================================
  // Entry helpers
  // =====================================

  function entryPayments(entry) {
    if (
      Array.isArray(entry.payments) &&
      entry.payments.length
    ) {
      return entry.payments.map(item => ({
        memberId:
          item.memberId ||
          item.personId ||
          item.playerId ||
          "",

        amount:
          Number(item.amount) || 0
      }));
    }

    const legacyId =
      entry.payerMemberId ||
      entry.paidBy ||
      "";

    if (!legacyId) {
      return [];
    }

    return [
      {
        memberId:
          legacyId,

        amount:
          Number(entry.amount) || 0
      }
    ];
  }


  function renderPaymentDescription(entry) {
    const payments =
      entryPayments(entry);

    if (!payments.length) {
      return "";
    }

    return payments
      .map(payment =>
        `${memberName(payment.memberId)} ${money(payment.amount)}`
      )
      .join("・");
  }


  // =====================================
  // Entry list
  // =====================================

  function renderEntries(entries) {
    const list =
      el("accountingEntries");

    list.innerHTML = "";

    if (!entries.length) {
      list.className =
        "list empty";

      list.textContent =
        "目前沒有共同支出紀錄";

      return;
    }

    list.className =
      "list";

    entries.forEach(entry => {
      const row =
        document.createElement("div");

      const entryText =
        document.createElement("span");

      const value =
        document.createElement("b");

      const typeLabel =
        entry.type === "income"
          ? "收入"
          : "支出";

      const paymentText =
        renderPaymentDescription(
          entry
        );

      entryText.innerHTML =
        `<strong>` +
        `${entry.description || entry.title || "未命名帳目"}` +
        `</strong>` +
        `<small>` +
        `${typeLabel}` +
        `${paymentText ? `｜付款 ${paymentText}` : ""}` +
        `</small>`;

      value.textContent =
        money(entry.amount);

      row.append(
        entryText,
        value
      );

      list.appendChild(row);
    });
  }


  // =====================================
  // Split form
  // =====================================

  function updateShareVisibility() {
    const visible =
      el("entryType").value ===
        "expense" &&
      el("splitMode").value ===
        "now";

    el("shareMembers")
      .classList
      .toggle(
        "hidden",
        !visible
      );
  }


  function openForm(entry) {
    if (!requireLogin()) {
      return;
    }

    pendingEntryId =
      entry
        ? entry.id
        : "";

    el("formTitle").textContent =
      entry
        ? "完成分帳"
        : "新增共同支出";

    el("entryType").value =
      entry
        ? entry.type || "expense"
        : "expense";

    el("entryAmount").value =
      entry
        ? entry.amount
        : "";

    el("entryDescription").value =
      entry
        ? (
            entry.description ||
            entry.title ||
            ""
          )
        : "";

    el("splitMode").value =
      entry
        ? "now"
        : "later";

    el("entryType").disabled =
      Boolean(entry);

    el("entryAmount").readOnly =
      Boolean(entry);

    el("entryDescription").readOnly =
      Boolean(entry);

    el("splitModeField")
      .classList
      .toggle(
        "hidden",
        Boolean(entry)
      );

    /*
     * Completing a pending split must not rewrite
     * the original payment allocation.
     */
    el("paymentBlock")
      .classList
      .toggle(
        "hidden",
        Boolean(entry)
      );

    if (!entry) {
      resetPaymentRows();
    }

    distributeShares();
    updateShareVisibility();
    updatePaymentTotal();

    el("splitForm")
      .classList
      .remove("hidden");

    el("splitForm")
      .scrollIntoView({
        behavior: "smooth"
      });
  }


  function showFormStatus(message) {
    el("formStatus").textContent =
      message;

    el("formStatus")
      .classList
      .remove("hidden");

    el("formStatus")
      .scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
  }


  function closeForm() {
    pendingEntryId = "";

    el("splitForm").reset();

    el("entryType").disabled =
      false;

    el("entryAmount").readOnly =
      false;

    el("entryDescription").readOnly =
      false;

    el("splitModeField")
      .classList
      .remove("hidden");

    el("paymentBlock")
      .classList
      .remove("hidden");

    el("formStatus").textContent =
      "";

    el("formStatus")
      .classList
      .add("hidden");

    el("saveSplit").disabled =
      false;

    el("saveSplit").textContent =
      "儲存";

    el("splitForm")
      .classList
      .add("hidden");

    resetPaymentRows();

    updateShareVisibility();
  }


  // =====================================
  // Pending split entries
  // =====================================

  function renderPending(entries) {
    const list =
      el("pendingEntries");

    const pending =
      entries.filter(entry =>
        entry.type === "expense" &&
        entry.splitStatus === "pending"
      );

    list.innerHTML = "";

    if (!pending.length) {
      list.className =
        "list empty";

      list.textContent =
        "目前沒有待分帳項目";

      return;
    }

    list.className =
      "list";

    pending.forEach(entry => {
      const row =
        document.createElement("div");

      const entryText =
        document.createElement("span");

      const button =
        document.createElement("button");

      entryText.innerHTML =
        `<strong>` +
        `${entry.description || entry.title || "未命名帳目"}` +
        `</strong>` +
        `<small>${money(entry.amount)}｜待分帳</small>`;

      button.type =
        "button";

      button.className =
        "mini";

      button.textContent =
        "分帳";

      button.addEventListener(
        "click",
        () => {
          showAccountingTab(
            "expenses"
          );

          openForm(entry);
        }
      );

      row.append(
        entryText,
        button
      );

      list.appendChild(row);
    });
  }


  // =====================================
  // Main render
  // =====================================

  function render(data) {
    context = data;

    el("scriptName").textContent =
      data.car.scriptName ||
      "未命名車團";

    el("carMeta").textContent =
      [
        data.car.date,
        data.car.location
      ]
        .filter(Boolean)
        .join("・");

    el("income").textContent =
      money(
        data.accounting.totalIncome
      );

    el("expense").textContent =
      money(
        data.accounting.totalExpense
      );

    el("balance").textContent =
      money(
        data.accounting.outstandingAmount
      );

    const entries =
      data.accounting.recentEntries ||
      [];

    renderShareMembers();

    renderBalances(
      data.accounting.memberSummaries ||
      []
    );

    renderTransfers(
      data.accounting.settlementTransfers ||
      []
    );

    renderPending(entries);

    renderEntries(entries);

    resetPaymentRows();
  }


  // =====================================
  // Load context
  // =====================================

  async function load() {
    try {
      const response =
        await fetch(
          `/api/group-assistant-context?token=${encodeURIComponent(token)}`
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          "load_failed"
        );
      }

      render(data);

      el("loading")
        .classList
        .add("hidden");

      el("accounting")
        .classList
        .remove("hidden");

      showAccountingTab(
        query.get("accountingTab") ||
        "expenses"
      );

    } catch (error) {
      el("loading")
        .classList
        .add("hidden");

      el("error")
        .classList
        .remove("hidden");

      el("error").textContent =
        error.message ===
          "binding_inactive"
          ? "這個群組連結已失效，請重新呼喚 JLY 小助手。"
          : "無法讀取資料，請稍後再試。";
    }
  }


  // =====================================
  // LINE login
  // =====================================

  async function startLineLogin() {
    const button =
      el("lineLogin");

    button.disabled = true;

    button.textContent =
      "正在開啟 LINE 登入…";

    try {
      const returnPath =
        location.pathname +
        location.search;

      const response =
        await fetch(
          "/api/line-login-state",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              returnPath
            })
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.state
      ) {
        throw new Error(
          "login_state_failed"
        );
      }

      const params =
        new URLSearchParams({
          response_type: "code",

          client_id:
            "2010653666",

          redirect_uri:
            `${location.origin}/pages/line-callback.html`,

          state:
            data.state,

          scope:
            "openid profile"
        });

      location.assign(
        `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`
      );

    } catch (_error) {
      button.disabled = false;

      button.textContent =
        "LINE 登入";

      el("loginPrompt")
        .firstChild
        .textContent =
          "無法開啟 LINE 登入，請重新整理後再試。";
    }
  }


  // =====================================
  // Accounting tab events
  // =====================================

  document
    .querySelectorAll(
      "[data-accounting-tab]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          showAccountingTab(
            button.dataset.accountingTab
          );
        }
      );
    });


  // =====================================
  // Form events
  // =====================================

  el("createSplit")
    .addEventListener(
      "click",
      () => {
        showAccountingTab(
          "expenses"
        );

        openForm(null);
      }
    );


  el("cancelSplit")
    .addEventListener(
      "click",
      closeForm
    );


  el("entryType")
    .addEventListener(
      "change",
      updateShareVisibility
    );


  el("splitMode")
    .addEventListener(
      "change",
      updateShareVisibility
    );


  el("entryAmount")
    .addEventListener(
      "input",
      () => {
        distributeShares();
        syncSinglePaymentToTotal();
      }
    );


  el("addPayment")
    .addEventListener(
      "click",
      () => {
        if (!requireLogin()) {
          return;
        }

        addPaymentRow(
          {},
          {
            focusAmount: true
          }
        );
      }
    );


  el("lineLogin")
    .addEventListener(
      "click",
      startLineLogin
    );


  // =====================================
  // Save accounting entry
  // =====================================

  el("splitForm")
    .addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const button =
          el("saveSplit");

        const total =
          Number(
            el("entryAmount").value
          );

        const description =
          el("entryDescription")
            .value
            .trim();

        if (
          !Number.isFinite(total) ||
          total <= 0 ||
          !description
        ) {
          showFormStatus(
            "請輸入正確的金額與說明。"
          );

          return;
        }

        const shareItems = [
          ...document.querySelectorAll(
            ".share-row"
          )
        ]
          .filter(row =>
            row
              .querySelector(
                ".share-check"
              )
              .checked
          )
          .map(row => ({
            memberId:
              row
                .querySelector(
                  ".share-check"
                )
                .value,

            amount:
              Number(
                row
                  .querySelector(
                    ".share-amount"
                  )
                  .value
              )
          }));

        const isSplitting =
          el("entryType").value ===
            "expense" &&
          (
            pendingEntryId ||
            el("splitMode").value ===
              "now"
          );

        const shareTotal =
          shareItems.reduce(
            (sum, item) =>
              sum + item.amount,
            0
          );

        if (
          isSplitting &&
          shareTotal !== total
        ) {
          const difference =
            total -
            shareTotal;

          showFormStatus(
            `目前分帳加總 ${money(shareTotal)}，` +
            `需等於 ${money(total)}` +
            `（${difference > 0 ? "還差" : "超出"} ` +
            `${money(Math.abs(difference))}）。`
          );

          return;
        }

        /*
         * Existing pending entries keep their original
         * payment allocation.
         */
        let payments = [];

        if (!pendingEntryId) {
          payments =
            getPaymentItems();

          if (!payments.length) {
            showFormStatus(
              "請至少加入一位付款人。"
            );

            return;
          }

          const uniqueMembers =
            new Set(
              payments.map(
                item =>
                  item.memberId
              )
            );

          if (
            uniqueMembers.size !==
            payments.length
          ) {
            showFormStatus(
              "同一位付款人請只保留一筆付款金額。"
            );

            return;
          }

          const invalidPayment =
            payments.some(item =>
              !Number.isFinite(
                item.amount
              ) ||
              item.amount <= 0
            );

          const paymentTotal =
            payments.reduce(
              (sum, item) =>
                sum + item.amount,
              0
            );

          if (
            invalidPayment ||
            paymentTotal !== total
          ) {
            const difference =
              total -
              paymentTotal;

            showFormStatus(
              `付款金額目前共 ${money(paymentTotal)}，` +
              `需等於 ${money(total)}` +
              `（${difference > 0 ? "還差" : "超出"} ` +
              `${money(Math.abs(difference))}）。`
            );

            return;
          }
        }

        button.disabled =
          true;

        button.textContent =
          "儲存中…";

        showFormStatus(
          "正在儲存，請稍候…"
        );

        try {
          const response =
            await fetch(
              "/api/group-assistant-entry",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    token,

                    entryId:
                      pendingEntryId ||
                      undefined,

                    type:
                      el("entryType")
                        .value,

                    amount:
                      total,

                    description,

                    splitMode:
                      pendingEntryId
                        ? "now"
                        : el("splitMode")
                            .value,

                    payments:
                      pendingEntryId
                        ? undefined
                        : payments,

                    shares:
                      shareItems
                  })
              }
            );

          const result =
            await response.json();

          if (!response.ok) {
            const errorMessage =
              result.error ===
                "line_login_required"
                ? "請先使用 LINE 登入。"

                : result.error ===
                    "share_total_mismatch"
                  ? "每人分攤金額加總必須等於帳目總額。"

                : result.error ===
                    "payment_total_mismatch"
                  ? "付款金額加總必須等於帳目總額。"

                : result.error ===
                    "invalid_payer"
                  ? "付款人資料不正確，請重新選擇。"

                : "儲存失敗，請稍後再試。";

            showFormStatus(
              errorMessage
            );

            button.disabled =
              false;

            button.textContent =
              "儲存";

            return;
          }

          button.textContent =
            "儲存成功";

          showFormStatus(
            pendingEntryId
              ? "✅ 分帳已完成"
              : "✅ 帳目已儲存成功"
          );

          await load();

          setTimeout(
            () => {
              closeForm();

              showAccountingTab(
                "expenses"
              );
            },
            700
          );

        } catch (_error) {
          showFormStatus(
            "網路連線失敗，請重新按一次儲存。"
          );

          button.disabled =
            false;

          button.textContent =
            "重新儲存";
        }
      }
    );


  // =====================================
  // Start
  // =====================================

  load();

})();
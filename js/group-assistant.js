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
  // Main navigation
  // =====================================

  function showTab(name) {
    document
      .querySelectorAll(".tab-panel")
      .forEach(node => {
        node.classList.toggle(
          "hidden",
          node.id !== name
        );
      });

    document
      .querySelectorAll("[data-tab]")
      .forEach(node => {
        node.classList.toggle(
          "active",
          node.dataset.tab === name
        );
      });

    if (name === "accounting") {
      const requestedAccountingTab =
        query.get("accountingTab") || "overview";

      showAccountingTab(requestedAccountingTab);
    }
  }


  // =====================================
  // Accounting navigation
  // =====================================

  function showAccountingTab(name) {
    const allowedTabs = [
      "overview",
      "settlements",
      "entries"
    ];

    const activeTab =
      allowedTabs.includes(name)
        ? name
        : "overview";

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
    if (context.currentMember) {
      return true;
    }

    el("loginPrompt").classList.remove("hidden");

    return false;
  }


  // =====================================
  // Members
  // =====================================

  function renderMembers() {
    const payer = el("payerMember");
    const shares = el("shareMemberList");

    payer.innerHTML = "";
    shares.innerHTML = "";

    (context.members || []).forEach(member => {
      const option =
        document.createElement("option");

      option.value = member.memberId;
      option.textContent = member.displayName;

      payer.appendChild(option);


      const row =
        document.createElement("label");

      const checkbox =
        document.createElement("input");

      const name =
        document.createElement("span");

      const amount =
        document.createElement("input");


      row.className = "share-row";

      checkbox.type = "checkbox";
      checkbox.className = "share-check";
      checkbox.value = member.memberId;
      checkbox.checked = true;

      name.textContent = member.displayName;

      amount.type = "number";
      amount.className = "share-amount";
      amount.min = "1";
      amount.step = "1";
      amount.inputMode = "numeric";
      amount.dataset.memberId = member.memberId;

      amount.setAttribute(
        "aria-label",
        `${member.displayName} 分攤金額`
      );


      checkbox.addEventListener(
        "change",
        () => {
          amount.disabled = !checkbox.checked;
          distributeShares();
        }
      );


      row.append(
        checkbox,
        name,
        amount
      );

      shares.appendChild(row);
    });


    const ids = [
      context.currentMember &&
        context.currentMember.memberId,

      context.currentMember &&
        context.currentMember.identityId,

      context.currentMember &&
        context.currentMember.profileId
    ];


    const mine = ids.find(id =>
      [...payer.options].some(
        option => option.value === id
      )
    );


    if (mine) {
      payer.value = mine;
    }


    distributeShares();
  }


  function distributeShares() {
    const total = Math.max(
      0,
      Math.floor(
        Number(el("entryAmount").value) || 0
      )
    );


    const rows = [
      ...document.querySelectorAll(".share-row")
    ].filter(row =>
      row
        .querySelector(".share-check")
        .checked
    );


    if (!rows.length) {
      return;
    }


    const base =
      Math.floor(total / rows.length);


    rows.forEach((row, index) => {
      row.querySelector(
        ".share-amount"
      ).value =
        index === rows.length - 1
          ? total -
            base * (rows.length - 1)
          : base;
    });
  }


  function memberName(id) {
    const item =
      (context.members || []).find(
        member => member.memberId === id
      );

    return (
      (item && item.displayName) ||
      "成員"
    );
  }

    // =====================================
  // Accounting overview
  // =====================================

  function renderBalances(items) {
    const list = el("memberBalances");

    list.innerHTML = "";


    if (!items.length) {
      list.className = "list empty";
      list.textContent =
        "目前沒有分帳資料";

      return;
    }


    list.className = "list";


    items.forEach(item => {
      const row =
        document.createElement("div");

      const name =
        document.createElement("span");

      const result =
        document.createElement("b");

      const net =
        Number(
          item.currentNetAmount != null
            ? item.currentNetAmount
            : item.netAmount
        ) || 0;


      name.innerHTML =
        `<strong>${memberName(item.personId)}</strong>` +
        `<small>` +
        `實際付款 ${money(item.paidAmount)}` +
        `｜應負擔 ${money(item.shareAmount)}` +
        `</small>`;


      result.textContent =
        net > 0
          ? `應收 ${money(net)}`
          : net < 0
            ? `應付 ${money(-net)}`
            : "✅ 已結清";


      row.append(
        name,
        result
      );

      list.appendChild(row);
    });
  }


  // =====================================
  // Settlement status
  // =====================================

  function renderTransfers(items) {
    const list =
      el("settlementTransfers");

    list.innerHTML = "";


    if (!items.length) {
      list.className = "list empty";

      list.textContent =
        "✅ 目前帳款均已結清";

      return;
    }


    list.className = "list";


    items.forEach(item => {
      const row =
        document.createElement("div");

      const text =
        document.createElement("span");

      const value =
        document.createElement("b");


      text.innerHTML =
        `<strong>` +
        `${memberName(item.fromPersonId)}` +
        ` → ` +
        `${memberName(item.toPersonId)}` +
        `</strong>` +
        `<small>待結清</small>`;


      value.textContent =
        money(item.amount);


      row.append(
        text,
        value
      );

      list.appendChild(row);
    });
  }


  // =====================================
  // Entry list
  // =====================================

  function renderEntries(entries) {
    const list =
      el("accountingEntries");

    list.innerHTML = "";


    if (!entries.length) {
      list.className = "list empty";

      list.textContent =
        "目前沒有帳目紀錄";

      return;
    }


    list.className = "list";


    entries.forEach(entry => {
      const row =
        document.createElement("div");

      const text =
        document.createElement("span");

      const value =
        document.createElement("b");


      const typeLabel =
        entry.type === "income"
          ? "收入"
          : "支出";


      const payer =
        entry.paidBy
          ? memberName(entry.paidBy)
          : "";


      text.innerHTML =
        `<strong>` +
        `${entry.description || "未命名帳目"}` +
        `</strong>` +
        `<small>` +
        `${typeLabel}` +
        `${payer ? `｜付款人 ${payer}` : ""}` +
        `</small>`;


      value.textContent =
        money(entry.amount);


      row.append(
        text,
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
      el("entryType").value === "expense" &&
      el("splitMode").value === "now";


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
      entry ? entry.id : "";


    el("formTitle").textContent =
      entry
        ? "完成分帳"
        : "新增帳目";


    el("entryType").value =
      "expense";


    el("entryAmount").value =
      entry
        ? entry.amount
        : "";


    el("entryDescription").value =
      entry
        ? entry.description
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


    distributeShares();
    updateShareVisibility();


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

    el("entryType").disabled = false;

    el("entryAmount").readOnly = false;

    el("entryDescription").readOnly =
      false;


    el("splitModeField")
      .classList
      .remove("hidden");


    el("formStatus").textContent = "";

    el("formStatus")
      .classList
      .add("hidden");


    el("saveSplit").disabled = false;

    el("saveSplit").textContent =
      "儲存";


    el("splitForm")
      .classList
      .add("hidden");


    updateShareVisibility();
  }

    // =====================================
  // Pending split entries
  // =====================================

  function renderPending(entries) {
    const list =
      el("pendingEntries");


    const pending =
      entries.filter(
        entry =>
          entry.type === "expense" &&
          entry.splitStatus === "pending"
      );


    list.innerHTML = "";


    if (!pending.length) {
      list.className = "list empty";

      list.textContent =
        "目前沒有待分帳項目";

      return;
    }


    list.className = "list";


    pending.forEach(entry => {
      const row =
        document.createElement("div");

      const text =
        document.createElement("span");

      const button =
        document.createElement("button");


      text.textContent =
        `${entry.description} ` +
        `${money(entry.amount)}`;


      button.type = "button";

      button.className = "mini";

      button.textContent = "分帳";


      button.addEventListener(
        "click",
        () => {
          showAccountingTab("entries");
          openForm(entry);
        }
      );


      row.append(
        text,
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
      data.car.scriptName;


    el("carMeta").textContent =
      [
        data.car.date,
        data.car.location
      ]
        .filter(Boolean)
        .join("・");


    el("infoContent").textContent =
      [
        data.car.date &&
          `日期：${data.car.date}`,

        data.car.location &&
          `地點：${data.car.location}`
      ]
        .filter(Boolean)
        .join("\n") ||
      "目前沒有其他車團資訊";


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
      data.accounting.recentEntries || [];


    renderMembers();

    renderBalances(
      data.accounting.memberSummaries || []
    );

    renderTransfers(
      data.accounting.settlementTransfers || []
    );

    renderPending(entries);

    renderEntries(entries);
    renderActivityAccountingExperience(data);
  }

  function renderActivityAccountingExperience(data){
    const root=el("lineAccountingExperience");if(!root)return;const accounting=data.accounting||{},personId=data.currentMember&&data.currentMember.memberId,members=new Map((data.members||[]).map(item=>[item.memberId,item.displayName])),entries=accounting.recentEntries||[],transfers=accounting.settlementTransfers||[],pending=accounting.pendingActions||[],history=accounting.settlementHistory||[],personView=accounting.viewModel&&accounting.viewModel.currentPerson||{sources:[],totalExpense:0,paidAmount:0,pendingAmount:0,payable:[],receivable:[]};
    [...root.parentElement.children].forEach(node=>{if(node!==root&&node.tagName!=="H2")node.classList.add("line-accounting-legacy-hidden");});
    const esc=value=>String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const txRows=entries.map(item=>{const split=(item.splits||item.shares||[]).find(row=>String(row.personId||row.memberId)===String(personId)),payer=members.get(item.paidBy)||item.payerDisplayName||"待確認",state=item.splitStatus==="pending"?"尚未分帳":split&&split.settlementStatus==="settled"?"已完成":"已分帳";return`<details class="line-accounting-row"><summary><span><strong>${esc(item.title||item.description||"未命名帳目")}</strong><small>付款人 ${esc(payer)}｜${esc(state)}</small></span><b>${money(item.amount)}</b></summary><div>本筆總額 ${money(item.amount)}${split?`｜我的負擔 ${money(split.amount)}`:""}<br><small>建立時間 ${esc(item.createdAt||"未記錄")}</small></div></details>`;}).join("")||'<p class="empty">目前沒有與你相關的逐筆帳目</p>';
    const payable=transfers.filter(item=>item.fromPersonId===personId),receivable=transfers.filter(item=>item.toPersonId===personId),pairRows=(items,type)=>items.map(item=>{const other=type==="pay"?item.toPersonId:item.fromPersonId,sources=[...(item.sourceObligations||[]),...(item.offsetObligations||[])].map(source=>entries.find(entry=>entry.transactionId===source.transactionId)).filter(Boolean),action=type==="pay"?`<button type="button" class="mini line-accounting-action" data-line-action="claim" data-from-person-id="${esc(item.fromPersonId)}" data-to-person-id="${esc(item.toPersonId)}" data-amount="${Number(item.amount)||0}">申報全部付款</button>`:"";return`<details class="line-accounting-row"><summary><span><strong>${type==="pay"?"應付給":"應向"} ${esc(members.get(other)||"成員")}${type==="receive"?"收款":""}</strong><small>同一對 Person 互抵後</small></span><b>${money(item.amount)}</b></summary><div>${sources.length?sources.map(entry=>`${esc(entry.title||entry.description)} ${money(entry.amount)}`).join("<br>"):"來源保留於正式逐筆帳目"}${action}</div></details>`;}).join("");
    const personSources=(personView.sources||[]).map(item=>`<article class="line-accounting-row"><span><strong>${esc(item.title||"未命名費用")}</strong><small>${item.sourceType==="store_base_fee"||item.sourceType==="store_extra_fee"?"店家費用":"活動支出分帳"}</small></span><b>${money(item.amount)}</b></article>`).join("")||'<p class="empty">目前沒有與你相關的費用</p>';
    const pendingRows=pending.map(item=>`<article class="line-accounting-row"><span><strong>${esc(item.actionType==="payment_confirmation"?"確認收到款項":item.actionType==="payment_due"?"申報付款":item.actionType==="delegated_payment_acceptance"?"回覆代付請求":item.actionType==="delegated_payment_due"?"已接受，待實際付款":item.actionType==="pending_split"?"等待分帳":"帳務待處理")}</strong><small>${esc(members.get(item.responsiblePersonId)||"由你處理")}</small></span>${item.amount?`<b>${money(item.amount)}</b>`:""}${item.actionType==="payment_confirmation"?`<button type="button" class="mini line-accounting-action" data-line-action="confirm" data-settlement-id="${esc(item.settlementId)}">確認收到</button>`:""}</article>`).join("")||'<p class="empty">目前沒有待你處理的帳務</p>';
    const historyRows=history.map(item=>{const debtor=item.debtorPersonId||item.fromPersonId,payer=item.paidBy||item.paymentClaimedBy||debtor,receiver=item.receiverPersonId||item.toPersonId,label=payer!==debtor?`${members.get(payer)||"成員"} 代 ${members.get(debtor)||"成員"} 支付給 ${members.get(receiver)||"成員"}`:`${members.get(debtor)||"成員"} 付款給 ${members.get(receiver)||"成員"}`;return`<article class="line-accounting-row"><span><strong>${esc(label)}</strong><small>${esc(item.status||"已記錄")}｜${esc(item.updatedAt||item.createdAt||"")}</small></span><b>${money(item.amount)}</b></article>`;}).join("")||'<p class="empty">目前沒有與你相關的歷史</p>';
    root.innerHTML=`${personId?"":'<div class="notice">請先使用 LINE 登入，才能查看及處理自己的帳務。</div>'}<nav class="line-accounting-tabs">${[["overview","總覽"],["entries","逐筆帳目"],["people","人物明細"],["pending","待處理"],["history","歷史"]].map(([id,label])=>`<button type="button" data-line-accounting-tab="${id}">${label}</button>`).join("")}</nav><section data-line-accounting-panel="overview"><div class="totals"><article><span>目前總支出</span><b>${money(accounting.viewModel&&accounting.viewModel.activity.currentExpense)}</b></article><article><span>我的待處理</span><b>${pending.length}</b></article></div><p class="settlement-note">店家未支付金額、分帳、付款與核銷不會重複計入目前總支出。</p></section><section data-line-accounting-panel="entries" hidden>${txRows}</section><section data-line-accounting-panel="people" hidden><div class="totals"><article><span>總支出</span><b>${money(personView.totalExpense)}</b></article><article><span>已付</span><b>${money(personView.paidAmount)}</b></article><article><span>待付</span><b>${money(personView.pendingAmount)}</b></article><article><span>待收</span><b>${money(personView.receivableAmount)}</b></article></div>${personSources}<h3>待付給誰</h3>${pairRows(payable,"pay")||'<p class="empty">目前沒有應付</p>'}<h3>待收</h3>${pairRows(receivable,"receive")||'<p class="empty">目前沒有應收</p>'}</section><section data-line-accounting-panel="pending" hidden>${pendingRows}</section><section data-line-accounting-panel="history" hidden>${historyRows}</section>`;
    const activate=id=>{root.querySelectorAll("[data-line-accounting-panel]").forEach(panel=>panel.hidden=panel.dataset.lineAccountingPanel!==id);root.querySelectorAll("[data-line-accounting-tab]").forEach(button=>button.classList.toggle("active",button.dataset.lineAccountingTab===id));};root.querySelectorAll("[data-line-accounting-tab]").forEach(button=>button.addEventListener("click",()=>activate(button.dataset.lineAccountingTab)));root.querySelectorAll(".line-accounting-action").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;const original=button.textContent;button.textContent="處理中…";try{const response=await fetch("/api/group-assistant-accounting-action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,action:button.dataset.lineAction,settlementId:button.dataset.settlementId||"",fromPersonId:button.dataset.fromPersonId||"",toPersonId:button.dataset.toPersonId||"",amount:Number(button.dataset.amount)||0})}),result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||"action_failed");await load();}catch(error){button.disabled=false;button.textContent=original;alert(error.message==="line_login_required"?"請先使用 LINE 登入。":"目前無法處理這筆帳務，請重新整理後再試。");}}));activate("overview");
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


      showTab(
        query.get("tab") ||
        "info"
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
  // Events
  // =====================================

  document
    .querySelectorAll("[data-tab]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          showTab(
            button.dataset.tab
          );
        }
      );
    });


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


  el("createSplit")
    .addEventListener(
      "click",
      () => {
        showAccountingTab("entries");
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
      distributeShares
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
              row.querySelector(
                ".share-check"
              ).value,

            amount:
              Number(
                row.querySelector(
                  ".share-amount"
                ).value
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
          !Number.isFinite(total) ||
          total <= 0 ||
          !description
        ) {
          showFormStatus(
            "請輸入正確的金額與說明。"
          );

          return;
        }


        if (
          isSplitting &&
          shareTotal !== total
        ) {
          const difference =
            total - shareTotal;


          showFormStatus(
            `目前分帳加總 ${money(shareTotal)}，` +
            `需等於 ${money(total)}` +
            `（${difference > 0 ? "還差" : "超出"} ` +
            `${money(Math.abs(difference))}）。`
          );


          return;
        }


        button.disabled = true;

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

                body: JSON.stringify({
                  token,

                  entryId:
                    pendingEntryId ||
                    undefined,

                  type:
                    el("entryType").value,

                  amount:
                    total,

                  description,

                  splitMode:
                    pendingEntryId
                      ? "now"
                      : el("splitMode").value,

                  payerMemberId:
                    el("payerMember").value,

                  shares:
                    shareItems
                })
              }
            );


          const result =
            await response.json();


          if (!response.ok) {
            showFormStatus(
              result.error ===
                "line_login_required"
                ? "請先使用 LINE 登入。"

                : result.error ===
                    "share_total_mismatch"
                  ? "每人金額加總必須等於帳目總額。"

                  : "儲存失敗，請稍後再試。"
            );


            button.disabled = false;

            button.textContent =
              "儲存";

            return;
          }


          button.textContent =
            "儲存成功";


          showFormStatus(
            "✅ 分帳已儲存成功"
          );


          await load();


          setTimeout(
            () => {
              closeForm();

              showTab(
                "accounting"
              );

              showAccountingTab(
                "entries"
              );
            },
            700
          );

        } catch (_error) {
          showFormStatus(
            "網路連線失敗，請重新按一次儲存。"
          );


          button.disabled = false;

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

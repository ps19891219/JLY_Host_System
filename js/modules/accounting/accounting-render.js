(function () {
  "use strict";
  const escape = value => String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const money = value => `$${Number(value || 0).toLocaleString("zh-TW")}`;
  function buildShellHtml() {
    return `<section class="card accounting-card" id="accountingSection"><div class="accounting-heading"><div><h3>💰 車團帳務</h3><p>正在載入帳務資料…</p></div></div></section>`;
  }
  function statusLabel(transaction) {
    if (transaction.splitStatus === "pending") return "🟡 待分帳";
    if ((transaction.splits || []).length && transaction.splits.every(split => split.settlementStatus === "settled")) return "🟢 全部結清";
    return "🔵 已分帳／待付款";
  }
  function settlementRows(item, model) {
    if (item.splitStatus === "pending") return "";
    return (item.splits || []).map(split => {
      const mine=split.personId===model.currentPersonId,receiver=item.paidBy===model.currentPersonId,manager=model.managerPersonId===model.currentPersonId,name=model.memberNames.get(split.personId)||split.displayName||"成員";
      let label="尚未付款",buttons="";
      if(split.settlementStatus==="settled")label="已結清";
      else if(split.settlementStatus==="payment_claimed"){label="已付款，待確認";if(mine)buttons=`<button data-action="withdraw">撤回</button>`;if(receiver||manager)buttons+=`<button data-action="confirm">確認收款</button>`;}
      else if(split.settlementStatus==="settlement_rejected")label="付款被退回";
      if(["payment_due","settlement_rejected"].includes(split.settlementStatus)){
        if(mine)buttons+=`<button data-action="claim">已付款</button>`;
        if(receiver||manager)buttons+=`<button data-action="receiver_settle">已收款</button>`;
      }
      return `<div class="accounting-settlement-row" data-transaction-id="${escape(item.transactionId)}" data-split-id="${escape(split.splitId)}"><span>${escape(name)}｜${money(split.amount)}｜${label}</span><div>${buttons}</div></div>`;
    }).join("");
  }
  function buildDashboardHtml(model) {
    const netSettlement = netSettlementHtml(model);
    const counts = model.counts, members = model.members || [];
    const recent = netSettlement + ((model.transactions || []).map((item,index) => `<article class="accounting-entry" data-transaction-id="${escape(item.transactionId)}" data-filter-state="${escape(model.getFilterState(item))}"${index>=5?" hidden":""}><div class="accounting-entry-summary"><div><strong>${escape(item.title || item.description || "未命名帳目")}</strong><small>付款人：${escape(model.memberNames.get(item.paidBy || item.payerMemberId) || item.payerDisplayName || "待確認")}</small></div><div><b>${money(item.amount)}</b><span>${statusLabel(item)}</span>${item.splitStatus==="pending"?`<button type="button" class="accounting-split-open" data-transaction-id="${escape(item.transactionId)}">分帳</button>`:""}</div></div><div class="accounting-settlement-list">${settlementRows(item,model)}</div></article>`).join("") || `<p class="empty-text">目前沒有帳目</p>`);
    const options = members.map(member => `<option value="${escape(member.personId)}"${member.personId===model.currentPersonId?" selected":""}>${escape(member.displayName)}</option>`).join("");
    return `<div class="accounting-heading"><div><h3>💰 車團帳務</h3><p>待處理 ${counts.total}</p></div><button type="button" id="accountingQuickOpen">＋ 快速記帳</button></div><div class="accounting-pending-grid"><span>待分帳 <b>${counts.pendingSplit}</b></span><span>待付款 <b>${counts.paymentDue}</b></span><span>待確認收款 <b>${counts.paymentConfirmation}</b></span></div><form id="accountingQuickForm" class="accounting-quick-form" hidden><h4>快速記帳</h4><label>項目<input id="accountingTitle" maxlength="80" required placeholder="例如：晚餐"></label><label>金額<input id="accountingAmount" type="number" min="1" step="1" inputmode="numeric" required></label><label>付款人<select id="accountingPaidBy" required>${options}</select></label><p id="accountingFormStatus" hidden></p><div class="accounting-form-actions"><button type="submit" id="accountingSave">記下來</button><button type="button" id="accountingCancel">取消</button></div></form><form id="accountingSplitForm" class="accounting-quick-form" hidden><h4 id="accountingSplitTitle">分帳</h4><input type="hidden" id="accountingSplitTransactionId"><label>分帳方式<select id="accountingSplitMode"><option value="equal">平均分帳</option><option value="custom">自訂金額</option></select></label><div class="accounting-member-heading"><span>參與成員</span><button type="button" id="accountingSelectAll" class="accounting-select-all">取消全選</button></div><fieldset class="accounting-member-list">${members.map(member=>`<label><input type="checkbox" name="splitMember" value="${escape(member.personId)}" checked><span>${escape(member.displayName)}</span><input class="accounting-custom-amount" data-person-id="${escape(member.personId)}" type="number" min="0" step="1" inputmode="numeric" hidden></label>`).join("")}</fieldset><p id="accountingSplitStatus" hidden></p><div class="accounting-form-actions"><button type="submit" id="accountingSplitSave">完成分帳</button><button type="button" id="accountingSplitCancel">取消</button></div></form><div class="accounting-list-heading"><h4 id="accountingListTitle">最近帳目</h4><button type="button" id="accountingViewAll" class="accounting-view-all">查看全部帳務</button></div><nav id="accountingFilters" class="accounting-filters" hidden><button data-filter="all">全部</button><button data-filter="pending">待處理</button><button data-filter="pending_split">待分帳</button><button data-filter="payment_due">待付款</button><button data-filter="payment_confirmation">待確認</button><button data-filter="settled">已結清</button></nav><div class="accounting-entry-list">${recent}</div><p id="accountingFilterEmpty" class="empty-text" hidden>目前沒有符合條件的帳目</p>`;
  }
  function netSettlementHtml(model) {
    const transfers = model.netSettlement && model.netSettlement.transfers || [];
    const rows = transfers.map(transfer => {
      const from = model.memberNames.get(transfer.fromPersonId) || "待確認成員";
      const to = model.memberNames.get(transfer.toPersonId) || "待確認成員";
      return `<li><strong>${escape(from)}</strong><span>付給</span><strong>${escape(to)}</strong><b>${money(transfer.amount)}</b></li>`;
    }).join("");
    return `<section class="accounting-net-settlement"><div><h4>車團結算結果</h4><small>已將未結清帳目互相抵扣</small></div>${rows?`<ul>${rows}</ul>`:`<p>目前沒有需要互相付款的金額</p>`}</section>`;
  }
  window.JLYAccountingRender = { buildShellHtml, buildDashboardHtml, statusLabel, netSettlementHtml };
})();

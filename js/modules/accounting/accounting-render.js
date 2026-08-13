(function () {
  "use strict";
  const escape = value => String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const money = value => `$${Number(value || 0).toLocaleString("zh-TW")}`;
  function buildShellHtml() {
    return `<section class="card accounting-card" id="accountingSection"><div class="accounting-heading"><div><h3>💰 車團帳務</h3><p>正在載入帳務資料…</p></div></div></section>`;
  }
  function statusLabel(transaction) {
    if (transaction.splitStatus === "pending") return "🟡 待分帳";
    if (transaction.settlementStatus === "settled") return "🟢 全部結清";
    return "🔵 已分帳／待付款";
  }
  function buildDashboardHtml(model) {
    const counts = model.counts, members = model.members || [];
    const recent = (model.transactions || []).slice(0,5).map(item => `<article class="accounting-entry"><div><strong>${escape(item.title || item.description || "未命名帳目")}</strong><small>付款人：${escape(model.memberNames.get(item.paidBy || item.payerMemberId) || item.payerDisplayName || "待確認")}</small></div><div><b>${money(item.amount)}</b><span>${statusLabel(item)}</span></div></article>`).join("") || `<p class="empty-text">目前沒有帳目</p>`;
    const options = members.map(member => `<option value="${escape(member.personId)}"${member.personId===model.currentPersonId?" selected":""}>${escape(member.displayName)}</option>`).join("");
    return `<div class="accounting-heading"><div><h3>💰 車團帳務</h3><p>待處理 ${counts.total}</p></div><button type="button" id="accountingQuickOpen">＋ 快速記帳</button></div><div class="accounting-pending-grid"><span>待分帳 <b>${counts.pendingSplit}</b></span><span>待付款 <b>${counts.paymentDue}</b></span><span>待確認收款 <b>${counts.paymentConfirmation}</b></span></div><form id="accountingQuickForm" class="accounting-quick-form" hidden><h4>快速記帳</h4><label>項目<input id="accountingTitle" maxlength="80" required placeholder="例如：晚餐"></label><label>金額<input id="accountingAmount" type="number" min="1" step="1" inputmode="numeric" required></label><label>付款人<select id="accountingPaidBy" required>${options}</select></label><p id="accountingFormStatus" hidden></p><div class="accounting-form-actions"><button type="submit" id="accountingSave">記下來</button><button type="button" id="accountingCancel">取消</button></div></form><h4>最近帳目</h4><div class="accounting-entry-list">${recent}</div><button type="button" class="accounting-view-all" disabled>查看全部帳務（下一階段）</button>`;
  }
  window.JLYAccountingRender = { buildShellHtml, buildDashboardHtml, statusLabel };
})();

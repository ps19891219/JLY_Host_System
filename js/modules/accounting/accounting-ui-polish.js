(function (root) {
  "use strict";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function identityResolver(members) {
    const map = new Map();
    (Array.isArray(members) ? members : []).forEach(member => {
      const canonical = text(member && member.personId);
      if (!canonical) return;
      [canonical, ...((member && member.identityIds) || [])].forEach(id => {
        const key = text(id);
        if (key) map.set(key, canonical);
      });
    });
    return value => map.get(text(value)) || text(value);
  }

  function validOutgoingTransfer(action, transfers, canonicalize) {
    const responsible = canonicalize(action && (action.responsiblePersonId || action.debtorPersonId || action.fromPersonId));
    if (!responsible) return false;
    const expectedReceiver = canonicalize(action && (action.receiverPersonId || action.toPersonId));
    return (Array.isArray(transfers) ? transfers : []).some(transfer => {
      if (Number(transfer && transfer.amount || 0) <= 0) return false;
      if (canonicalize(transfer && transfer.fromPersonId) !== responsible) return false;
      if (expectedReceiver && canonicalize(transfer && transfer.toPersonId) !== expectedReceiver) return false;
      return true;
    });
  }

  function filterPendingActions(model) {
    const actions = Array.isArray(model && model.pendingActions) ? model.pendingActions : [];
    const transfers = model && model.netSettlement && Array.isArray(model.netSettlement.transfers)
      ? model.netSettlement.transfers
      : [];
    const canonicalize = identityResolver(model && model.members);
    return actions.filter(action => {
      const type = text(action && action.actionType);
      if (type !== "payment_due" && type !== "settlement_rejected") return true;
      return validOutgoingTransfer(action, transfers, canonicalize);
    });
  }

  function counts(actions) {
    const list = Array.isArray(actions) ? actions : [];
    return {
      total: list.length,
      pendingSplit: list.filter(item => item.actionType === "pending_split").length,
      paymentDue: list.filter(item => item.actionType === "payment_due" || item.actionType === "settlement_rejected").length,
      paymentConfirmation: list.filter(item => item.actionType === "payment_confirmation").length
    };
  }

  const api = { filterPendingActions, identityResolver, validOutgoingTransfer };
  root.JLYAccountingUiPolish = api;

  const render = root.JLYAccountingRender;
  if (render && typeof render.buildDashboardHtml === "function" && !render.__uiPolishInstalled) {
    const original = render.buildDashboardHtml.bind(render);
    render.buildDashboardHtml = function buildDashboardHtmlWithUiPolish(model) {
      const pendingActions = filterPendingActions(model || {});
      return original({
        ...(model || {}),
        pendingActions,
        counts: counts(pendingActions)
      });
    };
    render.__uiPolishInstalled = true;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

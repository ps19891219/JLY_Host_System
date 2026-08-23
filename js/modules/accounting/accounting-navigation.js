(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JLYAccountingNavigation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const views = new Set(["overview", "transactions", "people", "studio", "history"]);
  const personSubviews = new Set(["ledger", "payable", "receivable", "processing", "payment"]);

  function text(value) { return String(value || "").trim(); }
  function initial(currentPersonId) {
    return { view: "overview", personId: text(currentPersonId), subview: "ledger", sourceType: "", sourceId: "" };
  }
  function normalize(input, currentPersonId) {
    const state = Object.assign(initial(currentPersonId), input || {});
    if (!views.has(state.view)) state.view = "overview";
    if (!personSubviews.has(state.subview)) state.subview = "ledger";
    state.personId = text(state.personId || currentPersonId);
    state.sourceType = text(state.sourceType);
    state.sourceId = text(state.sourceId);
    state.transactionId = text(state.transactionId);
    state.settlementId = text(state.settlementId);
    state.requestId = text(state.requestId);
    return state;
  }
  function selectView(state, view, currentPersonId) {
    return normalize(Object.assign({}, state, { view, sourceType: "", sourceId: "" }), currentPersonId);
  }
  function selectPerson(state, personId, subview, currentPersonId) {
    return normalize(Object.assign({}, state, { view: "people", personId, subview }), currentPersonId);
  }
  function targetForPending(action, currentPersonId) {
    const item = action || {}, type = text(item.actionType), sourceId = text(item.sourceId || item.settlementId || item.transactionId || item.requestId || item.obligationId);
    if (type === "pending_split") return normalize({ view: "transactions", transactionId: text(item.transactionId || sourceId), sourceType: "transaction", sourceId: text(item.transactionId || sourceId) }, currentPersonId);
    if (type === "payment_confirmation") return normalize({ view: "people", personId: text(item.receiverPersonId || item.toPersonId || item.responsiblePersonId || currentPersonId), subview: "processing", settlementId: text(item.settlementId || sourceId), sourceType: "settlement", sourceId }, currentPersonId);
    if (type === "payment_due" || type === "settlement_rejected") return normalize({ view: "people", personId: text(item.responsiblePersonId || item.fromPersonId || item.debtorPersonId || currentPersonId), subview: "payable", settlementId: text(item.settlementId), sourceType: item.settlementId ? "settlement" : "obligation", sourceId }, currentPersonId);
    if (type === "delegated_payment_acceptance") return normalize({ view: "people", personId: text(item.responsiblePersonId || item.delegatePersonId || currentPersonId), subview: "processing", requestId: text(item.requestId || sourceId), sourceType: "delegated_request", sourceId }, currentPersonId);
    if (type.indexOf("studio") >= 0 || type.indexOf("vendor") >= 0 || text(item.sourceType).indexOf("studio") >= 0) return normalize({ view: "studio", subview: "payment", sourceType: "studio_payment", sourceId }, currentPersonId);
    return normalize({ view: "people", personId: text(item.responsiblePersonId || currentPersonId), subview: "processing", sourceType: text(item.sourceType || "pending"), sourceId }, currentPersonId);
  }

  return { initial, normalize, selectView, selectPerson, targetForPending };
});

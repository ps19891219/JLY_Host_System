(function (root) {
  "use strict";

  const data = root && root.JLYAccountingData;
  if (!data || typeof data.personalAccountingProjection !== "function") return;
  if (data.__currentBalanceProjectionInstalled) return;

  const originalPersonalAccountingProjection = data.personalAccountingProjection.bind(data);

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeForCurrentBalance(items, canonicalize) {
    const resolve = typeof canonicalize === "function"
      ? value => text(canonicalize(text(value)))
      : text;

    return (Array.isArray(items) ? items : []).map(item => ({
      ...item,
      fromPersonId: resolve(item && item.fromPersonId),
      toPersonId: resolve(item && item.toPersonId)
    })).filter(item => item.fromPersonId && item.toPersonId && item.fromPersonId !== item.toPersonId && Number(item.amount) > 0);
  }

  function currentBalanceTransfers(items, canonicalize) {
    const normalized = normalizeForCurrentBalance(items, canonicalize);
    if (typeof data.netSettlementFromObligations === "function") {
      const result = data.netSettlementFromObligations(normalized);
      return Array.isArray(result && result.transfers) ? result.transfers : [];
    }
    return normalized;
  }

  data.personalAccountingProjection = function personalAccountingCurrentBalance(items, personId, canonicalize) {
    return originalPersonalAccountingProjection(
      currentBalanceTransfers(items, canonicalize),
      personId,
      canonicalize
    );
  };

  data.currentBalanceTransfers = currentBalanceTransfers;
  data.__currentBalanceProjectionInstalled = true;
})(typeof window !== "undefined" ? window : globalThis);

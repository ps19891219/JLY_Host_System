(function () {
  "use strict";

  const RUNTIME_PROJECTION_REVISION = 2;
  const VIEW_NAME = "activityCurrent";
  const MARKER_FIELD = "projectionRuntimeRevision";
  const repository = window.JLYAccountingRepository;
  const accountingData = window.JLYAccountingData;
  const pairwise = window.JLYPairwiseObligation;

  if (!repository || typeof repository.loadDashboard !== "function") return;
  if (repository.__projectionRefreshInstalled) return;

  const originalLoadDashboard = repository.loadDashboard.bind(repository);
  const originalApplySettlements = pairwise && typeof pairwise.applySettlements === "function"
    ? pairwise.applySettlements.bind(pairwise)
    : null;
  let canonicalizePersonId = value => String(value == null ? "" : value).trim();

  function identityMembers(car) {
    if (!accountingData || typeof accountingData.collectActivityMembers !== "function") return [];
    let members = accountingData.collectActivityMembers(car || {});
    if (
      typeof accountingData.getCurrentIdentity === "function" &&
      typeof accountingData.linkCurrentIdentityToActivityMembers === "function" &&
      typeof window.localStorage !== "undefined"
    ) {
      try {
        const identity = accountingData.getCurrentIdentity(window.localStorage, window.JLYIdentity);
        members = accountingData.linkCurrentIdentityToActivityMembers(members, identity);
      } catch (_) {}
    }
    return members;
  }

  function buildCanonicalizer(car) {
    const members = identityMembers(car);
    if (!members.length || !accountingData || typeof accountingData.canonicalActivityPersonId !== "function") {
      return value => String(value == null ? "" : value).trim();
    }
    return value => {
      const id = String(value == null ? "" : value).trim();
      if (!id) return "";
      return String(accountingData.canonicalActivityPersonId(members, id) || id).trim();
    };
  }

  function normalizeDirection(record, preserveOriginal) {
    const item = record && typeof record === "object" ? record : {};
    const originalFrom = String(item.fromPersonId || "").trim();
    const originalTo = String(item.toPersonId || "").trim();
    const next = {
      ...item,
      fromPersonId: canonicalizePersonId(originalFrom),
      toPersonId: canonicalizePersonId(originalTo)
    };
    if (preserveOriginal) {
      if (originalFrom && !next.originalFromPersonId) next.originalFromPersonId = originalFrom;
      if (originalTo && !next.originalToPersonId) next.originalToPersonId = originalTo;
    }
    [
      ["originalFromPersonId", "originalToPersonId"],
      ["debtorPersonId", "receiverPersonId"],
      ["canonicalFromPersonId", "canonicalToPersonId"]
    ].forEach(([fromKey, toKey]) => {
      if (next[fromKey]) next[fromKey] = canonicalizePersonId(next[fromKey]);
      if (next[toKey]) next[toKey] = canonicalizePersonId(next[toKey]);
    });
    return next;
  }

  if (originalApplySettlements && !pairwise.__activityIdentitySettlementInstalled) {
    pairwise.applySettlements = function applySettlementsWithActivityIdentity(obligations, settlements) {
      return originalApplySettlements(
        (obligations || []).map(item => normalizeDirection(item, true)),
        (settlements || []).map(item => normalizeDirection(item, false))
      );
    };
    pairwise.__activityIdentitySettlementInstalled = true;
  }

  repository.loadDashboard = async function loadDashboardWithProjectionRefresh(carId, currentPersonId) {
    const id = String(carId || "").trim();
    const db = window.db;
    let viewRef = null;
    let identityReady = false;

    if (db && id) {
      const carRef = db.collection("cars").doc(id);
      viewRef = carRef.collection("accountingViews").doc(VIEW_NAME);
      try {
        const carSnapshot = await carRef.get();
        if (carSnapshot && carSnapshot.exists) {
          canonicalizePersonId = buildCanonicalizer(carSnapshot.data());
          identityReady = true;
        }
      } catch (error) {
        console.warn("Accounting activity identity refresh failed.", error);
      }

      if (identityReady) {
        try {
          const snapshot = await viewRef.get();
          const revision = snapshot.exists
            ? Number(snapshot.data()[MARKER_FIELD]) || 0
            : RUNTIME_PROJECTION_REVISION;
          if (snapshot.exists && revision < RUNTIME_PROJECTION_REVISION) {
            await viewRef.delete();
          }
        } catch (error) {
          console.warn("Accounting prepared view refresh check failed.", error);
        }
      }
    }

    const result = await originalLoadDashboard(id || carId, currentPersonId);

    if (viewRef && identityReady) {
      try {
        await viewRef.set({ [MARKER_FIELD]: RUNTIME_PROJECTION_REVISION }, { merge: true });
      } catch (error) {
        console.warn("Accounting prepared view revision marker failed.", error);
      }
    }

    return result;
  };

  repository.__projectionRefreshInstalled = true;
})();

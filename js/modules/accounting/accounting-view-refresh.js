(function () {
  "use strict";

  const RUNTIME_PROJECTION_REVISION = 1;
  const VIEW_NAME = "activityCurrent";
  const MARKER_FIELD = "projectionRuntimeRevision";
  const repository = window.JLYAccountingRepository;

  if (!repository || typeof repository.loadDashboard !== "function") return;
  if (repository.__projectionRefreshInstalled) return;

  const originalLoadDashboard = repository.loadDashboard.bind(repository);

  repository.loadDashboard = async function loadDashboardWithProjectionRefresh(carId, currentPersonId) {
    const id = String(carId || "").trim();
    const db = window.db;
    let viewRef = null;

    if (db && id) {
      viewRef = db.collection("cars").doc(id).collection("accountingViews").doc(VIEW_NAME);
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

    const result = await originalLoadDashboard(id || carId, currentPersonId);

    if (viewRef) {
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

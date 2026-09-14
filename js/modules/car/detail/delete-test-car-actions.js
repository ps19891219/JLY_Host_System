(function () {
  "use strict";

  const text = (value) => String(value == null ? "" : value).trim();

  function currentCarId() {
    return new URLSearchParams(location.search).get("id") || "";
  }

  async function authorizeGoogleIfNeeded(car) {
    const eventId = text(car?.calendar?.eventId);
    if (!eventId) return { needed: false, authorized: false, error: null };

    try {
      const actions = window.JLYCalendarDetailActions;
      if (!actions || typeof actions.authorizeForCar !== "function") {
        throw new Error("Google Calendar 授權模組尚未載入");
      }
      await actions.authorizeForCar(car);
      return { needed: true, authorized: true, error: null };
    } catch (error) {
      return { needed: true, authorized: false, error };
    }
  }

  async function deleteJlyCar(carId) {
    const response = await fetch("/api/delete-test-car", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carId })
    });

    let body = null;
    try { body = await response.json(); } catch (_error) { body = null; }

    if (!response.ok || body?.success !== true) {
      const code = text(body?.error) || `HTTP ${response.status}`;
      if (code === "car_owner_required") {
        throw new Error("只有這台車的正式主揪可以永久刪除測試車。");
      }
      if (code === "line_login_required") {
        throw new Error("請先完成 LINE/JLY 身分登入後再刪除測試車。");
      }
      throw new Error(`JLY 車團刪除失敗：${code}`);
    }

    return body;
  }

  async function cleanupGoogleAfterJlyDelete(carId, car, authState) {
    const eventId = text(car?.calendar?.eventId);
    if (!eventId) return { ok: true, skipped: true, reason: "missing_event_id" };

    if (!authState?.authorized) {
      return {
        ok: false,
        skipped: true,
        reason: "google_not_authorized",
        error: authState?.error || new Error("Google Calendar 尚未授權")
      };
    }

    const sync = window.JLYCalendarSync;
    if (!sync || typeof sync.removeSyncedEvent !== "function") {
      return {
        ok: false,
        skipped: true,
        reason: "calendar_sync_missing",
        error: new Error("Calendar Sync 模組尚未載入")
      };
    }

    return sync.removeSyncedEvent({ carId, car });
  }

  async function deleteCurrentCarSafely() {
    const carId = currentCarId();
    const car = window.currentCarData ? { ...window.currentCarData } : null;

    if (!carId || !car) {
      alert("車團資料尚未載入完成，請重新整理後再試。");
      return;
    }

    const confirmed = window.confirm(
      [
        "確定要永久刪除這台測試車嗎？",
        "",
        "刪除順序已改為：",
        "1. 先確認並刪除 JLY 正式車團",
        "2. JLY 成功後才清除對應 Google Calendar 行程",
        "",
        "如果 JLY 刪除失敗，Google Calendar 不會被動到。"
      ].join("\n")
    );

    if (!confirmed) return;

    if (typeof window.closeCarMenu === "function") {
      window.closeCarMenu();
    }

    /*
      OAuth 必須緊接使用者點擊。
      此步驟只取得授權，不做任何 Google delete。
    */
    const authState = await authorizeGoogleIfNeeded(car);

    try {
      await deleteJlyCar(carId);
    } catch (error) {
      console.error("JLY 測試車刪除失敗：", error);
      alert(
        "刪除失敗：" +
        (text(error?.message) || "未知錯誤") +
        "\n\nGoogle Calendar 未刪除。"
      );
      return;
    }

    let googleResult = { ok: true, skipped: true };
    try {
      googleResult = await cleanupGoogleAfterJlyDelete(carId, car, authState);
    } catch (error) {
      googleResult = { ok: false, error };
    }

    if (googleResult?.ok === true) {
      alert("測試車已永久刪除，對應 Google Calendar 行程也已清除。");
    } else {
      alert(
        "JLY 測試車已永久刪除。\n\n" +
        "⚠️ Google Calendar 行程尚未清除，請稍後從 Calendar 修復工具處理。\n" +
        (text(googleResult?.error?.message) || text(googleResult?.reason))
      );
    }

    location.href = "/pages/mycar.html?deleted=" + encodeURIComponent(carId);
  }

  window.deleteCurrentCar = deleteCurrentCarSafely;
  window.JLYDeleteTestCarActions = {
    deleteCurrentCar: deleteCurrentCarSafely
  };
})();

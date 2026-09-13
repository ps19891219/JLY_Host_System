(function () {
  "use strict";

  async function handleRepairTap(event) {
    const button = event.target.closest("#batchGoogleRepairButton");

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const auth = window.JLYCalendarAuth;
    const repair = window.repairSelectedCarsGoogleCalendar;

    if (!auth || typeof auth.requestAccessToken !== "function") {
      alert("Google Calendar 授權模組尚未載入");
      return;
    }

    if (typeof repair !== "function") {
      alert("Google 補登模組尚未載入");
      return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "📅 Google 授權中…";

    try {
      await auth.requestAccessToken();
      button.textContent = "📅 補登中…";
      await repair();
    } catch (error) {
      console.error("Google 補登授權失敗：", error);
      alert(
        "Google 授權未完成：" +
        (error && error.message ? error.message : "未知錯誤")
      );
    } finally {
      button.disabled = false;
      button.textContent = originalText || "📅 補登 Google";
    }
  }

  document.addEventListener("click", handleRepairTap, true);
})();
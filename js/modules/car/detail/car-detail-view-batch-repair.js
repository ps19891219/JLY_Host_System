/*
 * Explicit, bounded known-Car-ID Car Detail Prepared View maintenance.
 * Reuses single-car owner/identity checks and Cloud Car View schema.
 * No reads/writes at page load or for ordinary Car Detail pages.
 */
(function (root) {
  "use strict";
  const MAX_CARS = 12;
  const EXACT_REPAIR_IDS = Object.freeze([
    "vSfmdHC7okcHKiGyJAaM",
    "h9xHEXaDs8jCXb6hl4Ih",
    "O7dgQYnWux16tLtgH4iM"
  ]);
  const VALID_ID = /^[A-Za-z0-9_-]{6,80}$/;
  function text(value) { return String(value == null ? "" : value).trim(); }
  function parseKnownCarIds(search) {
    const params = new URLSearchParams(text(search));
    if (params.get("viewRepairBatch") !== "1") return [];
    const current = text(params.get("id"));
    const raw = text(params.get("ids"));
    if (!raw || raw.length > 1100) return [];
    const requested = raw.split(/[\s,;，；]+/).filter(Boolean);
    if (!requested.length || requested.length > MAX_CARS ||
        requested.some(id => !VALID_ID.test(id))) return [];
    const ids = [...new Set(requested)];
    if (!ids.includes(current)) return [];
    return ids;
  }
  async function runKnownCarRepairs(ids, repair, onResult) {
    if (!Array.isArray(ids) || !ids.length || ids.length > MAX_CARS ||
        ids.some(id => typeof id !== "string" || !VALID_ID.test(id))) {
      throw new Error("invalid_bounded_car_ids");
    }
    if (typeof repair !== "function") throw new Error("repair_module_unavailable");
    const results = [];
    for (const carId of [...new Set(ids)]) {
      let outcome;
      try {
        const res = await repair(carId);
        outcome = { carId, status: res.status, gameDate: res.gameDate,
          gameTime: res.gameTime };
      } catch (error) {
        outcome = { carId, status: "failed",
          reason: text(error && error.message) || "unknown_error" };
      }
      results.push(outcome);
      if (typeof onResult === "function") onResult(outcome);
    }
    return results;
  }
  function describe(result) {
    if (result.status === "repaired") return "✅ 已修復且讀回驗證 " +
      text(result.gameDate) + " " + text(result.gameTime);
    if (result.status === "current") return "✅ View 已是最新 " +
      text(result.gameDate) + " " + text(result.gameTime);
    if (result.reason === "creator_identity_mismatch") return "⚠️ 建立者身分尚未確認，未修改";
    if (result.reason === "creator_record_missing") return "⚠️ 舊車缺少 ownerId，未修改";
    if (result.reason === "permission-denied") return "⚠️ Firestore 拒絕寫入";
    if (result.reason === "car_not_found") return "⚠️ Core 車團不存在";
    return "⚠️ 尚未修復（" + text(result.reason) + "）";
  }
  function mount() {
    if (!root.location || !root.document) return;
    const ids = parseKnownCarIds(root.location.search);
    if (ids.length !== EXACT_REPAIR_IDS.length ||
        EXACT_REPAIR_IDS.some((id, i) => ids[i] !== id)) return;
    const container = root.document.querySelector(".container");
    if (!container || root.document.getElementById("jly-car-detail-view-batch-repair")) return;
    const panel = root.document.createElement("section");
    panel.id = "jly-car-detail-view-batch-repair";
    panel.setAttribute("style", "margin:12px 0;padding:14px;border:1px solid #ddd;border-radius:12px;background:#fff");
    const intro = root.document.createElement("p");
    intro.textContent = "🔧 受控批次維護｜這次只處理 " + ids.length + " 台已知車團。";
    const explanation = root.document.createElement("p");
    explanation.textContent = "以正式建立者身分逐台驗證，已正確的 View 不重寫。正常開頁不會執行修復。";
    const button = root.document.createElement("button");
    button.type = "button";
    button.textContent = "開始檢查／修復這 " + ids.length + " 台";
    const list = root.document.createElement("div");
    const entries = new Map();
    for (const id of ids) {
      const line = root.document.createElement("p");
      line.textContent = id + "：等待檢查";
      list.appendChild(line);
      entries.set(id, line);
    }
    const status = root.document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "請用建立這些車團時的 JLY 身分點擊。按下前不讀寫資料。";
    button.addEventListener("click", async function () {
      button.disabled = true;
      status.textContent = "正在逐台檢查，請勿離開頁面…";
      try {
        const response = await fetch("/api/line-group-pairing-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            action: "repair_three_known_car_views",
            confirm: "REPAIR_THREE_KNOWN_CAR_VIEWS"
          })
        });
        const data = await response.json();
        if (!response.ok || data.success !== true) {
          const reason = text(data && data.error);
          const messages = {
            line_login_required: "此瀏覽器尚未完成 JLY LINE 正式登入，請在已登入 LINE 的 Safari 開啟。",
            formal_line_identity_required: "目前是臨時 LINE 身分，需先完成正式認領。",
            formal_line_identity_mismatch: "LINE 身分與正式 JLY Profile 不一致，已停止修復。",
            formal_profile_missing: "正式 JLY Profile 不存在，未修改。",
            origin_not_allowed: "請從正式站開啟批次維護連結。"
          };
          throw new Error(messages[reason] || "安全檢查未通過（" + reason + "），未修改資料。");
        }
        const results = Array.isArray(data.results) ? data.results : [];
        for (const row of results) {
          const node = entries.get(row.carId);
          if (node) node.textContent = row.carId + "：" + describe(row);
        }
        const success = results.filter(row => row.status === "current" || row.status === "repaired").length;
        status.textContent = "完成：" + success + "/" + ids.length +
          " 台讀回確認；失敗 " + (ids.length - success) + " 台。成功者可再測 LINE 辨識。";
      } catch (error) {
        status.textContent = "⚠️ 批次未啟動：" + text(error && error.message);
      } finally {
        button.disabled = false;
      }
    });
    panel.append(intro, explanation, button, list, status);
    container.prepend(panel);
  }
  root.JLYCarDetailViewBatchRepair = { parseKnownCarIds, runKnownCarRepairs, mount, MAX_CARS, EXACT_REPAIR_IDS };
  if (root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", mount, {once:true});
    } else { mount(); }
  }
})(typeof window !== "undefined" ? window : globalThis);

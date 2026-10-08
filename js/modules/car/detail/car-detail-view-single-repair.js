/*
 * Explicit, bounded, single-car Car Detail Prepared View maintenance.
 * Never runs a repair on ordinary page load.
 */
(function (root) {
  "use strict";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function sameCarSnapshot(view, car) {
    const row = view && view.car;
    return Boolean(
      row && typeof row === "object" &&
      text(row.id || view.carId) === text(car.id) &&
      text(row.scriptName) === text(car.scriptName) &&
      text(row.gameDate) === text(car.gameDate) &&
      text(row.gameTime) === text(car.gameTime) &&
      text(view.ownerId) === text(car.ownerId) &&
      text(view.sourceUpdatedAt) === text(car.updatedAt)
    );
  }

  async function repairSingleCarView(carId, deps = {}) {
    const id = text(carId);
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) throw new Error("car_id_invalid");
    const db = deps.db || root.db;
    if (!db || typeof db.collection !== "function") throw new Error("firestore_not_ready");

    // A deliberate maintenance click allows a *single known-ID* Core read.
    const carSnapshot = await db.collection("cars").doc(id).get();
    if (!carSnapshot.exists) throw new Error("car_not_found");
    const car = { ...(carSnapshot.data() || {}), id: carSnapshot.id };

    const canEdit = deps.canEditCar || (value => Boolean(
      root.JLYPermissions &&
      typeof root.JLYPermissions.canEditCar === "function" &&
      root.JLYPermissions.canEditCar(value)
    ));
    if (!text(car.ownerId) || !canEdit(car)) throw new Error("owner_required");

    const viewRef = db.collection("carDetailViews").doc(id);
    const previous = await viewRef.get();
    if (previous.exists && sameCarSnapshot(previous.data(), car)) {
      return { status: "current", carId: id, gameDate: text(car.gameDate), gameTime: text(car.gameTime) };
    }

    // Reuse the existing Cloud Car Detail View schema and write path.
    const ensureRuntime = deps.ensureRuntime || (() => {
      if (typeof root.ensureJLYViewRuntime === "function") {
        return root.ensureJLYViewRuntime();
      }
      if (root.JLYViewRuntimeLoader && typeof root.JLYViewRuntimeLoader.ensure === "function") {
        return root.JLYViewRuntimeLoader.ensure();
      }
      throw new Error("view_runtime_unavailable");
    });
    const runtime = await ensureRuntime();
    const builder = runtime && runtime.carDetail;
    if (!builder || typeof builder.writeFromCar !== "function") {
      throw new Error("car_detail_view_builder_unavailable");
    }

    await builder.writeFromCar(car);
    const confirmed = await viewRef.get();
    if (!confirmed.exists || !sameCarSnapshot(confirmed.data(), car)) {
      throw new Error("car_detail_view_verification_failed");
    }
    return { status: "repaired", carId: id, gameDate: text(car.gameDate), gameTime: text(car.gameTime) };
  }

  function mountMaintenanceAction() {
    if (!root.location || !root.document) return;
    const params = new URLSearchParams(root.location.search);
    if (params.get("viewRepair") !== "1") return;

    const carId = text(params.get("id"));
    const container = root.document.querySelector(".container");
    if (!container || !carId || root.document.getElementById("jly-car-detail-view-repair")) return;
    const panel = root.document.createElement("section");
    panel.id = "jly-car-detail-view-repair";
    panel.setAttribute("style", "margin:12px 0;padding:14px;border:1px solid #ddd;border-radius:12px;background:#fff;");
    const info = root.document.createElement("p");
    info.textContent = "單台維護｜檢查並修復本場 LINE 辨識用的 Car Detail View。只處理這台車，不新增車團。";
    const button = root.document.createElement("button");
    button.type = "button";
    button.textContent = "🔧 檢查／修復本台 LINE 辨識資料";
    const status = root.document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "請以這台車的主揪身分操作。";
    button.addEventListener("click", async () => {
      button.disabled = true;
      status.textContent = "正在檢查這台車團資料…";
      try {
        const result = await repairSingleCarView(carId);
        status.textContent = result.status === "current"
          ? "✅ Car Detail View 已是最新，不需要修復。"
          : "✅ 單台 Prepared View 已修復並讀回驗證，現在可重新邀請 LINE 小助手。";
      } catch (error) {
        const code = text(error && error.message);
        status.textContent = code === "owner_required"
          ? "⚠️ 目前不是這台車的主揪／管理者，未修改任何資料。"
          : "⚠️ 修復未完成（" + code + "）。請保留錯誤訊息，不要重複建立車團。";
      } finally {
        button.disabled = false;
      }
    });
    panel.append(info, button, status);
    container.prepend(panel);
  }

  root.JLYCarDetailViewSingleRepair = { sameCarSnapshot, repairSingleCarView, mountMaintenanceAction };
  if (root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", mountMaintenanceAction, { once: true });
    } else {
      mountMaintenanceAction();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

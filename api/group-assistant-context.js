"use strict";

const { verifyGroupAssistantToken } = require("../services/line/group-assistant-link");
const { getBindingByGroupId } = require("../services/firebase/line-group-binding-repository");
const { getCarById } = require("../services/firebase/line-accounting-authorization-repository");
const { getCarAccountingView } = require("../services/firebase/car-accounting-repository");

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { success: false, error: "method_not_allowed" });
  try {
    const result = verifyGroupAssistantToken(req.query && req.query.token);
    if (!result.valid) return send(res, 401, { success: false, error: "invalid_link" });
    const { groupId, carId } = result.data;
    const binding = await getBindingByGroupId(groupId);
    if (!binding || binding.status !== "active" || String(binding.carId) !== String(carId)) {
      return send(res, 403, { success: false, error: "binding_inactive" });
    }
    const [car, accounting] = await Promise.all([
      getCarById(carId),
      getCarAccountingView(carId)
    ]);
    if (!car) return send(res, 404, { success: false, error: "car_not_found" });
    return send(res, 200, {
      success: true,
      car: {
        id: car.id,
        scriptName: car.scriptName || car.title || car.name || "JLY 車團",
        date: car.date || car.startDate || "",
        location: car.location || car.storeName || ""
      },
      accounting: {
        totalIncome: Number(accounting.totalIncome) || 0,
        totalExpense: Number(accounting.totalExpense) || 0,
        balance: Number(accounting.balance) || 0,
        activeEntryCount: Number(accounting.activeEntryCount) || 0,
        memberBalances: Array.isArray(accounting.memberBalances) ? accounting.memberBalances : [],
        recentEntries: Array.isArray(accounting.recentEntries) ? accounting.recentEntries : []
      }
    });
  } catch (error) {
    console.error("讀取車團小助手資料失敗", error);
    return send(res, 500, { success: false, error: "assistant_context_failed" });
  }
};

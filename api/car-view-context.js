"use strict";

const { getCarById } = require("../services/firebase/line-accounting-authorization-repository");
const { readCookie, verifyMemberSession } = require("../services/line/member-session");
const { carViewPayload } = require("../services/car/car-view-access");

function send(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

function createHandler(dependencies = {}) {
  const readCar = dependencies.getCarById || getCarById;
  const verifySession = dependencies.verifyMemberSession || verifyMemberSession;
  return async function handler(req, res) {
    if (req.method !== "GET") return send(res, 405, { success: false, error: "method_not_allowed" });
    const carId = String(req.query && req.query.id || "").trim();
    if (!carId) return send(res, 400, { success: false, error: "car_id_required" });
    try {
      const car = await readCar(carId);
      if (!car) return send(res, 404, { success: false, error: "car_not_found" });
      const verified = verifySession(readCookie(req));
      return send(res, 200, { success: true, ...carViewPayload(car, verified.valid ? verified.data : null) });
    } catch (error) {
      console.error("讀取玩家車團資訊失敗", error);
      return send(res, 500, { success: false, error: "car_view_failed" });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;

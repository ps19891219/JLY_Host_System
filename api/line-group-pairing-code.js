"use strict";

const { getCarById } = require("../services/firebase/line-accounting-authorization-repository");
const { createPairingCode } = require("../services/firebase/line-group-pairing-repository");

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { success: false, error: "method_not_allowed" });
  }
  try {
    const input = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const carId = String(input.carId || "").trim();
    const car = await getCarById(carId);
    if (!car) return send(res, 404, { success: false, error: "car_not_found" });
    const pairing = await createPairingCode(carId, 10);
    return send(res, 200, {
      success: true,
      code: pairing.code,
      command: `JLY 綁定 ${pairing.code}`,
      expiresAt: pairing.expiresAt
    });
  } catch (error) {
    console.error("建立 LINE 群組配對碼失敗", error);
    return send(res, 500, { success: false, error: "pairing_code_failed" });
  }
};

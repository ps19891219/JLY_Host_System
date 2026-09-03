"use strict";

const { getCarById } = require("../services/firebase/line-accounting-authorization-repository");
const { createPairingCode } = require("../services/firebase/line-group-pairing-repository");
const { handleMembershipHealth } = require("../services/line/membership-health-api-handler");

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function getCarLabel(car) {
  return String(
    car && (car.scriptName || car.title || car.name) || "未命名車團"
  )
    .replace(/[《》\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { success: false, error: "method_not_allowed" });
  }
  try {
    const input = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    // Keep Vercel Function count unchanged: host-only membership health actions
    // share this existing LINE POST function. Pairing requests have no `action`.
    if (["verify", "initialize", "catchup"].includes(String(input.action || "").trim())) {
      return handleMembershipHealth(req, res, input);
    }

    const carId = String(input.carId || "").trim();
    const car = await getCarById(carId);
    if (!car) return send(res, 404, { success: false, error: "car_not_found" });
    const pairing = await createPairingCode(carId, 10);
    const carLabel = getCarLabel(car);
    return send(res, 200, {
      success: true,
      code: pairing.code,
      carLabel,
      command: `JLY 綁定《${carLabel}》 ${pairing.code}`,
      expiresAt: pairing.expiresAt
    });
  } catch (error) {
    console.error("建立 LINE 群組配對碼失敗", error);
    return send(res, 500, { success: false, error: "pairing_code_failed" });
  }
};

module.exports.getCarLabel = getCarLabel;

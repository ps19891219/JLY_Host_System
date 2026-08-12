"use strict";

const crypto = require("crypto");
const { getFirestore } = require("./admin");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function generateCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
}

async function createPairingCode(carId, ttlMinutes = 10) {
  const db = getFirestore();
  const normalizedCarId = String(carId || "").trim();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + Math.max(1, Number(ttlMinutes) || 10) * 60 * 1000
  ).toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    const ref = db.collection("lineGroupPairingCodes").doc(code);
    const existing = await ref.get();
    if (existing.exists) continue;
    const data = {
      code,
      carId: normalizedCarId,
      status: "pending",
      createdAt: now.toISOString(),
      expiresAt
    };
    await ref.set(data, { merge: false });
    return data;
  }
  throw new Error("pairing_code_generation_failed");
}

async function getPairingCode(code) {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return null;
  const snapshot = await getFirestore()
    .collection("lineGroupPairingCodes")
    .doc(normalizedCode)
    .get();
  return snapshot.exists ? snapshot.data() : null;
}

async function updatePairingCode(code, changes) {
  const normalizedCode = normalizeCode(code);
  await getFirestore()
    .collection("lineGroupPairingCodes")
    .doc(normalizedCode)
    .set({ ...changes, updatedAt: new Date().toISOString() }, { merge: true });
}

module.exports = {
  normalizeCode,
  createPairingCode,
  getPairingCode,
  updatePairingCode
};

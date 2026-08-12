"use strict";

const { getFirestore } = require("./admin");

async function findPlayerByLineUserId(lineUserId) {
  if (!lineUserId) return null;

  const snapshot = await getFirestore()
    .collection("players")
    .where("lineUserId", "==", lineUserId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const document = snapshot.docs[0];
  return { id: document.id, ...document.data() };
}

async function getCarById(carId) {
  if (!carId) return null;

  const snapshot = await getFirestore()
    .collection("cars")
    .doc(carId)
    .get();

  return snapshot.exists
    ? { id: snapshot.id, ...snapshot.data() }
    : null;
}

module.exports = {
  findPlayerByLineUserId,
  getCarById
};

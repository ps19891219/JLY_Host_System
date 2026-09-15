"use strict";

const { getFirestore } = require("../services/firebase/admin");

const PROFILE_ID = "f89pkJbkmFLu4ZOw2fXh";
const CANCELLED = new Set(["已取消", "取消", "cancelled", "canceled"]);

function text(value) { return String(value == null ? "" : value).trim(); }
function playerIds(player) {
  return [player && player.playerId, player && player.id, player && player.profileId,
    player && player.personId, player && player.identityId, player && player.memberId]
    .map(text).filter(Boolean);
}
function safePlayer(player) {
  return {
    status: text(player && player.status),
    playerId: text(player && player.playerId),
    id: text(player && player.id),
    profileId: text(player && player.profileId),
    personId: text(player && player.personId),
    identityId: text(player && player.identityId),
    memberId: text(player && player.memberId),
    // Name is diagnostic evidence only, never identity.
    playerName: text(player && (player.playerName || player.displayName || player.name))
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  if (!req || req.method !== "GET") return res.status(405).json({ success:false, error:"method_not_allowed" });

  // Fail closed. Never expose diagnostic data when the server secret is absent.
  const expectedKey = text(process.env.MYCAR_DIAGNOSTIC_KEY);
  const suppliedKey = text(req.query && req.query.key);
  if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) {
    return res.status(404).json({ success:false, error:"not_found" });
  }

  try {
    const db = getFirestore();
    const profileSnap = await db.collection("players").doc(PROFILE_ID).get();
    const profile = profileSnap.exists ? (profileSnap.data() || {}) : null;
    const formalIds = new Set([PROFILE_ID]);
    if (profile && Array.isArray(profile.linkedPlayerIds)) profile.linkedPlayerIds.map(text).filter(Boolean).forEach(id => formalIds.add(id));

    const carsSnap = await db.collection("cars").get();
    const formalMatches = [];
    const nameEvidence = [];
    carsSnap.forEach(doc => {
      const car = doc.data() || {};
      const players = Array.isArray(car.players) ? car.players : [];
      players.forEach((player, index) => {
        if (CANCELLED.has(text(player && player.status).toLowerCase())) return;
        const ids = playerIds(player);
        const row = { carId: doc.id, index, player: safePlayer(player) };
        if (ids.some(id => formalIds.has(id))) formalMatches.push(row);
        if (/何詩婕/.test(text(player && (player.playerName || player.displayName || player.name)))) nameEvidence.push(row);
      });
    });

    const evidenceIds = [...new Set(nameEvidence.flatMap(row => playerIds(row.player)))];
    const missingEvidenceIds = evidenceIds.filter(id => !formalIds.has(id));
    return res.status(200).json({
      success: true,
      readOnly: true,
      profile: profile ? {
        id: PROFILE_ID,
        exists: true,
        linkedPlayerIds: Array.isArray(profile.linkedPlayerIds) ? profile.linkedPlayerIds.map(text).filter(Boolean) : [],
        identityId: text(profile.identityId),
        personId: text(profile.personId),
        canonicalProfileId: text(profile.canonicalProfileId),
        canonicalPersonId: text(profile.canonicalPersonId),
        mergedIntoProfileId: text(profile.mergedIntoProfileId),
        mergedIntoPersonId: text(profile.mergedIntoPersonId)
      } : { id: PROFILE_ID, exists: false },
      formalIds: [...formalIds],
      formalMatchCount: formalMatches.length,
      formalMatches: formalMatches.slice(0, 100),
      diagnosticNameMatchCount: nameEvidence.length,
      diagnosticNameEvidence: nameEvidence.slice(0, 100),
      evidenceIds,
      missingEvidenceIds
    });
  } catch (error) {
    console.error("MyCar player identity diagnostic failed", error);
    return res.status(500).json({ success:false, error:"diagnostic_failed" });
  }
};

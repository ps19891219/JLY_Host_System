"use strict";

const crypto = require("crypto");
const { verifyGroupAssistantToken } = require("../services/line/group-assistant-link");
const { readCookie, verifyMemberSession } = require("../services/line/member-session");
const { getBindingByGroupId } = require("../services/firebase/line-group-binding-repository");
const { getCarById } = require("../services/firebase/line-accounting-authorization-repository");
const { saveCarAccountingEntry, listCarAccountingEntries, completeCarAccountingSplit } = require("../services/firebase/car-accounting-repository");

function send(res, status, data) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(data)); }
function parseBody(req) { if (req.body && typeof req.body === "object") return req.body; try { return JSON.parse(req.body || "{}"); } catch (_e) { return {}; } }
function identities(session) { return new Set([session.profileId, session.identityId].map(String).filter(Boolean)); }

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { success: false, error: "method_not_allowed" });
  try {
    const input = parseBody(req);
    const link = verifyGroupAssistantToken(input.token);
    const session = verifyMemberSession(readCookie(req));
    if (!link.valid) return send(res, 401, { success: false, error: "invalid_link" });
    if (!session.valid) return send(res, 401, { success: false, error: "line_login_required" });
    const { groupId, carId } = link.data;
    const [binding, car] = await Promise.all([getBindingByGroupId(groupId), getCarById(carId)]);
    if (!binding || binding.status !== "active" || String(binding.carId) !== String(carId)) return send(res, 403, { success: false, error: "binding_inactive" });
    if (!car) return send(res, 404, { success: false, error: "car_not_found" });

    const players = Array.isArray(car.players) ? car.players : [];
    const memberIds = new Set(players.map(p => String(p.playerId || p.memberId || p.id || "")).filter(Boolean));
    const playerMap = new Map(players.map(p => [String(p.playerId || p.memberId || p.id || ""), String(p.displayName || p.playerName || p.name || p.nickname || "成員")]));
    const actorIds = identities(session.data);
    const isOwner = actorIds.has(String(car.ownerId || ""));
    if (![...actorIds].some(id => memberIds.has(id)) && !isOwner) return send(res, 403, { success: false, error: "car_member_required" });

    const type = input.type === "income" ? "income" : "expense";
    const amount = Number(input.amount);
    const description = String(input.description || "").trim();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000 || !description) return send(res, 400, { success: false, error: "invalid_entry" });
    const selected = [...new Set(Array.isArray(input.shareMemberIds) ? input.shareMemberIds.map(String) : [])].filter(id => memberIds.has(id));
    const payerId = String(input.payerMemberId || session.data.identityId || session.data.profileId);
    if (!memberIds.has(payerId) && !actorIds.has(payerId)) return send(res, 400, { success: false, error: "invalid_payer" });
    const splitNow = input.splitMode === "now";
    if (type === "expense" && splitNow && !selected.length) return send(res, 400, { success: false, error: "share_members_required" });
    const shares = type === "expense" && splitNow ? selected.map((id, index) => ({
      memberId: id, displayName: playerMap.get(id) || "成員",
      amount: index === selected.length - 1 ? amount - Math.floor(amount / selected.length) * (selected.length - 1) : Math.floor(amount / selected.length)
    })) : [];

    if (input.entryId) {
      const existing = (await listCarAccountingEntries(carId)).find(entry => entry.id === String(input.entryId));
      if (!existing || existing.splitStatus !== "pending") return send(res, 404, { success: false, error: "pending_entry_not_found" });
      const isCreator = actorIds.has(String(existing.actorMemberId || "")) || String(existing.userId || "") === String(session.data.lineUserId || "");
      if (!isCreator && !isOwner) return send(res, 403, { success: false, error: "entry_permission_denied" });
      const updated = await completeCarAccountingSplit({
        carId, entryId: existing.id, payerMemberId: payerId,
        payerDisplayName: playerMap.get(payerId) || session.data.displayName,
        shares, actorUserId: session.data.lineUserId,
        actorMemberId: session.data.profileId, actorDisplayName: session.data.displayName,
        authorityReason: isOwner ? "car_owner" : "entry_creator"
      });
      return send(res, 200, { success: true, entryId: updated.id, splitCompleted: true });
    }

    const entryId = `web-${crypto.randomUUID()}`;
    const entry = await saveCarAccountingEntry({
      carId, groupId, entryId, messageId: entryId, userId: session.data.lineUserId,
      actorMemberId: session.data.profileId, actorDisplayName: session.data.displayName,
      payerMemberId: payerId, payerDisplayName: playerMap.get(payerId) || session.data.displayName,
      shares, splitStatus: type === "expense" && !splitNow ? "pending" : "completed",
      type, amount, description, source: "group_assistant_web"
    });
    return send(res, 200, { success: true, entryId: entry.messageId, amount, type, description });
  } catch (error) {
    console.error("群組助手帳目處理失敗", error);
    return send(res, 500, { success: false, error: "entry_create_failed" });
  }
};

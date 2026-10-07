"use strict";

const {
  findPlayerByLineUserId,
  findPlayersByLineUserIds
} = require("../firebase/line-accounting-authorization-repository");
const {
  getIdentityIds
} = require("./group-car-binding-service");
const {
  getCarAccountingManagerIds
} = require("./accounting-authorization-service");
const {
  applyCarMutation,
  activePlayerIds
} = require("../firebase/car-prepared-view-write-through");
const {
  syncActivity
} = require("../studio/studio-recruitment-view-service");
const {
  getGroupMemberProfile
} = require("./group-membership-client");

const MAX_TARGETS = 20;

function text(value) {
  return String(value == null ? "" : value).trim();
}

function unique(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map(text)
      .filter(Boolean)
  ));
}

function roleLabel(role) {
  if (role === "dm") return "DM";
  if (role === "male") return "男位";
  if (role === "female") return "女位";
  return "";
}

function normalizeRole(role) {
  const value = text(role).toLowerCase();
  if (["dm", "主持", "主持人"].includes(value)) return "dm";
  if (["male", "男", "男位", "男角"].includes(value)) return "male";
  if (["female", "女", "女位", "女角"].includes(value)) return "female";
  return "";
}

function mentionedUserIds(mentions) {
  return unique(
    (Array.isArray(mentions) ? mentions : [])
      .filter(mention =>
        mention &&
        text(mention.type) === "user" &&
        mention.isSelf !== true
      )
      .map(mention => mention.userId)
  ).slice(0, MAX_TARGETS);
}

function playerDisplayName(profile) {
  return text(profile && (
    profile.displayName ||
    profile.nickname ||
    profile.lineDisplayName ||
    profile.playerName ||
    profile.name
  )) || "LINE 車友";
}

function profileId(profile) {
  return text(profile && (
    profile.id ||
    profile.playerId ||
    profile.profileId ||
    profile.personId
  ));
}

function buildProfileMap(profiles) {
  const map = new Map();
  (Array.isArray(profiles) ? profiles : []).forEach(profile => {
    const lineUserId = text(profile && profile.lineUserId);
    if (lineUserId && !map.has(lineUserId)) map.set(lineUserId, profile);
  });
  return map;
}

function isManager(actorProfile, car) {
  if (!actorProfile || !car) return false;

  const roles = (Array.isArray(actorProfile.roles) ? actorProfile.roles : [])
    .map(value => text(value).toLowerCase());
  if (roles.some(role => [
    "admin",
    "administrator",
    "system_admin"
  ].includes(role))) {
    return true;
  }

  const actorIds = getIdentityIds(actorProfile);
  const managerIds = new Set(getCarAccountingManagerIds(car));
  return Array.from(actorIds).some(id => managerIds.has(id));
}

function cloneRows(value) {
  return (Array.isArray(value) ? value : []).map(row => {
    if (!row || typeof row !== "object") return row;
    return {
      ...row,
      player: row.player && typeof row.player === "object"
        ? { ...row.player }
        : row.player,
      memberSnapshot: row.memberSnapshot && typeof row.memberSnapshot === "object"
        ? { ...row.memberSnapshot }
        : row.memberSnapshot
    };
  });
}

function normalizeSlotType(value) {
  const normalized = text(value).toLowerCase();
  if (["male", "m", "男", "男位", "男角"].includes(normalized)) return "male";
  if (["female", "f", "女", "女位", "女角"].includes(normalized)) return "female";
  return "flexible";
}

function slotPlayerId(slot) {
  return text(slot && (
    slot.playerId ||
    (slot.player && (slot.player.playerId || slot.player.id))
  ));
}

function findAvailableSeat(slots, role) {
  const safe = Array.isArray(slots) ? slots : [];
  const fixed = safe.find(slot =>
    !slotPlayerId(slot) &&
    normalizeSlotType(slot && (
      slot.originalType ||
      slot.sectionType ||
      slot.slotType ||
      slot.type
    )) === role
  );
  if (fixed) return fixed;

  return safe.find(slot =>
    !slotPlayerId(slot) &&
    normalizeSlotType(slot && (
      slot.originalType ||
      slot.sectionType ||
      slot.slotType ||
      slot.type
    )) === "flexible"
  ) || null;
}

function syntheticLineId(lineUserId) {
  return "line:" + text(lineUserId);
}

function makeProvisionalPlayer(lineUserId, displayName, role, now) {
  const id = syntheticLineId(lineUserId);
  const name = text(displayName) || "LINE 車友";
  const position = roleLabel(role);
  return {
    playerId: id,
    playerName: name,
    displayName: name,
    hostAlias: name,
    name,
    hostNote: "",
    position,
    requestedPosition: position,
    playPosition: role,
    isCrossPlay: false,
    roleChoice: "",
    seatLabel: "",
    memberType: "guest",
    isLineLinked: false,
    pendingLineUserId: text(lineUserId),
    source: "line_group_mention_pending_identity",
    status: "已加入",
    joinedAt: now,
    updatedAt: now
  };
}

function makePlayer(profile, role, now) {
  const id = profileId(profile);
  const name = playerDisplayName(profile);
  const position = roleLabel(role);
  return {
    playerId: id,
    playerName: name,
    displayName: name,
    hostAlias: name,
    name,
    hostNote: "",
    position,
    requestedPosition: position,
    playPosition: role,
    isCrossPlay: false,
    roleChoice: "",
    seatLabel: "",
    memberType: text(profile && profile.memberType) || "member",
    isLineLinked: true,
    lineUserId: text(profile && profile.lineUserId),
    source: "line_group_mention",
    status: "已加入",
    joinedAt: now,
    updatedAt: now
  };
}

function assignSeat(slots, player, role, now) {
  const target = findAvailableSeat(slots, role);
  if (!target) return false;

  const targetId = text(target.id || target.slotId);
  const index = slots.findIndex(slot =>
    slot === target ||
    (targetId && text(slot && (slot.id || slot.slotId)) === targetId)
  );
  if (index < 0) return false;

  const next = { ...slots[index] };
  next.playerId = player.playerId;
  next.player = {
    playerId: player.playerId,
    id: player.playerId,
    playerName: player.playerName,
    displayName: player.displayName,
    hostAlias: player.hostAlias,
    position: player.position,
    playPosition: role,
    isCrossPlay: false
  };
  next.updatedAt = now;

  if (normalizeSlotType(
    next.originalType ||
    next.sectionType ||
    next.slotType ||
    next.type
  ) === "flexible") {
    next.originalType = "flexible";
    next.type = role;
  }

  slots[index] = next;
  return true;
}

function addProvisionalStaffSlot(staffSlots, lineUserId, displayName, now) {
  const pendingId = text(lineUserId);
  if (!pendingId) return false;

  const exists = staffSlots.some(slot =>
    text(slot && slot.pendingLineUserId) === pendingId ||
    text(slot && (
      slot.memberId ||
      (slot.memberSnapshot && slot.memberSnapshot.memberId)
    )) === syntheticLineId(pendingId)
  );
  if (exists) return false;

  const name = text(displayName) || "LINE 車友";
  const memberId = syntheticLineId(pendingId);
  const order = staffSlots.length + 1;
  staffSlots.push({
    id: "staff_" + memberId,
    order,
    label: "DM",
    memberId,
    displayName: name,
    isCrossPlay: false,
    position: "",
    pendingLineUserId: pendingId,
    memberSnapshot: {
      memberId,
      displayName: name,
      position: "",
      isCrossPlay: false,
      source: "line_group_mention_pending_identity"
    },
    source: "line_group_mention_pending_identity",
    createdAt: now,
    updatedAt: now
  });
  return true;
}

function addStaffSlot(staffSlots, profile, now) {
  const id = profileId(profile);
  const name = playerDisplayName(profile);
  if (!id) return false;

  const exists = staffSlots.some(slot =>
    text(slot && (
      slot.memberId ||
      (slot.memberSnapshot && slot.memberSnapshot.memberId)
    )) === id
  );
  if (exists) return false;

  const order = staffSlots.length + 1;
  staffSlots.push({
    id: "staff_line_" + id,
    order,
    label: "DM",
    memberId: id,
    displayName: name,
    isCrossPlay: false,
    position: "",
    memberSnapshot: {
      memberId: id,
      displayName: name,
      lineDisplayName: text(profile && profile.lineDisplayName),
      position: "",
      isCrossPlay: false,
      source: "line_group_mention"
    },
    source: "line_group_mention",
    createdAt: now,
    updatedAt: now
  });
  return true;
}

function upsertPendingCandidate(candidates, data) {
  const lineUserId = text(data && data.lineUserId);
  if (!lineUserId) return false;
  const index = candidates.findIndex(row =>
    text(row && row.lineUserId) === lineUserId
  );
  const previous = index >= 0 ? candidates[index] : null;
  const next = {
    ...(previous || {}),
    lineUserId,
    targetRole: normalizeRole(data.targetRole),
    status: "pending_identity",
    source: "line_group_mention",
    groupId: text(data.groupId),
    addedByLineUserId: text(data.addedByLineUserId),
    createdAt: text(previous && previous.createdAt) || text(data.now),
    updatedAt: text(data.now)
  };
  if (index >= 0) candidates[index] = next;
  else candidates.push(next);
  return true;
}

function historyItem(role, count, pendingCount, now) {
  const label = roleLabel(role);
  return {
    type: "LINE 群組新增人員",
    text:
      "LINE 小助手登記" + label + " " + String(count) + " 人" +
      (pendingCount ? "，另 " + String(pendingCount) + " 人待認領" : ""),
    time: now,
    source: "line_group_mention"
  };
}

async function addMentionedRosterMembers(context, roleInput, dependencies = {}) {
  const role = normalizeRole(roleInput);
  const userIds = mentionedUserIds(context && context.message && context.message.mentions);
  if (!role) return { changed: false, reason: "role_invalid" };
  if (!context || context.source.type !== "group" || !text(context.source.groupId)) {
    return { changed: false, reason: "group_required" };
  }
  if (!text(context.source.userId)) {
    return { changed: false, reason: "actor_missing" };
  }
  if (!userIds.length) {
    return { changed: false, reason: "mentions_required" };
  }

  const actorReader = dependencies.findPlayerByLineUserId || findPlayerByLineUserId;
  const batchReader = dependencies.findPlayersByLineUserIds || findPlayersByLineUserIds;
  const mutate = dependencies.applyCarMutation || applyCarMutation;
  const studioSync = dependencies.syncActivity || syncActivity;
  const readGroupProfile =
    dependencies.getGroupMemberProfile ||
    getGroupMemberProfile;

  const actorProfile = await actorReader(context.source.userId);
  if (!actorProfile) {
    return { changed: false, reason: "line_identity_unlinked" };
  }

  const linkedProfiles = await batchReader(userIds);
  const profileMap = buildProfileMap(linkedProfiles);

  const unresolvedIds =
    userIds.filter(
      lineUserId =>
        !profileMap.has(
          lineUserId
        )
    );

  const groupProfileRows =
    await Promise.all(
      unresolvedIds.map(
        async function (
          lineUserId
        ) {
          try {
            const profile =
              await readGroupProfile(
                context.source.groupId,
                lineUserId,
                dependencies
              );

            return {
              lineUserId,
              displayName:
                text(
                  profile &&
                  profile.displayName
                )
            };
          } catch (error) {
            console.warn(
              "LINE group roster profile lookup failed.",
              {
                lineUserId,
                message:
                  text(
                    error &&
                    error.message
                  )
              }
            );

            return {
              lineUserId,
              displayName: ""
            };
          }
        }
      )
    );

  const groupProfileMap =
    new Map(
      groupProfileRows.map(
        row => [
          row.lineUserId,
          row
        ]
      )
    );

  const carId = text(context.accountingCarId);
  if (!carId) return { changed: false, reason: "binding_required" };

  const now = new Date(Number(context.timestamp) || Date.now()).toISOString();

  const result = await mutate(carId, async car => {
    if (!isManager(actorProfile, car)) {
      return { changed: false, reason: "owner_or_manager_required" };
    }

    const players = cloneRows(car.players);
    const staffSlots = cloneRows(car.staffSlots);
    const slots = cloneRows(car.slots);
    const candidates = cloneRows(car.lineRosterCandidates);
    const history = cloneRows(car.history);

    let addedCount = 0;
    let seatedCount = 0;
    let pendingIdentityCount = 0;
    let alreadyExistsCount = 0;

    for (const lineUserId of userIds) {
      const profile = profileMap.get(lineUserId);
      if (!profile || !profileId(profile)) {
        const groupProfile =
          groupProfileMap.get(
            lineUserId
          ) || {};

        const pendingDisplayName =
          text(
            groupProfile.displayName
          );

        upsertPendingCandidate(candidates, {
          lineUserId,
          targetRole: role,
          groupId: context.source.groupId,
          addedByLineUserId: context.source.userId,
          now
        });

        if (role === "dm") {
          if (
            pendingDisplayName &&
            addProvisionalStaffSlot(
              staffSlots,
              lineUserId,
              pendingDisplayName,
              now
            )
          ) {
            addedCount += 1;
          } else if (
            staffSlots.some(
              slot =>
                text(
                  slot &&
                  slot.pendingLineUserId
                ) ===
                lineUserId
            )
          ) {
            alreadyExistsCount += 1;
          }
        } else {
          const syntheticId =
            syntheticLineId(
              lineUserId
            );

          const existingPending =
            players.find(
              player =>
                text(
                  player &&
                  player.pendingLineUserId
                ) ===
                  lineUserId ||
                text(
                  player &&
                  (
                    player.playerId ||
                    player.id ||
                    player.profileId
                  )
                ) ===
                  syntheticId
            );

          if (existingPending) {
            alreadyExistsCount += 1;
          } else if (
            pendingDisplayName
          ) {
            const provisional =
              makeProvisionalPlayer(
                lineUserId,
                pendingDisplayName,
                role,
                now
              );

            players.push(
              provisional
            );

            addedCount += 1;

            if (
              assignSeat(
                slots,
                provisional,
                role,
                now
              )
            ) {
              seatedCount += 1;
            }
          }
        }

        pendingIdentityCount += 1;
        continue;
      }

      const memberId = profileId(profile);

      if (role === "dm") {
        if (addStaffSlot(staffSlots, profile, now)) {
          addedCount += 1;
        } else {
          alreadyExistsCount += 1;
        }
        continue;
      }

      const existing = players.find(player =>
        text(player && (
          player.playerId ||
          player.id ||
          player.profileId
        )) === memberId &&
        !["已取消", "取消", "cancelled", "canceled"].includes(
          text(player && player.status)
        )
      );

      if (existing) {
        alreadyExistsCount += 1;
        continue;
      }

      const player = makePlayer(profile, role, now);
      players.push(player);
      addedCount += 1;
      if (assignSeat(slots, player, role, now)) seatedCount += 1;
    }

    if (!addedCount && !pendingIdentityCount) {
      return {
        changed: false,
        reason: "no_roster_change",
        addedCount,
        seatedCount,
        pendingIdentityCount,
        alreadyExistsCount,
        targetCount: userIds.length
      };
    }

    history.push(historyItem(role, addedCount, pendingIdentityCount, now));

    const updateData = {
      history,
      lineRosterCandidates: candidates,
      updatedAt: now
    };
    const changedFields = [
      "history",
      "lineRosterCandidates",
      "updatedAt"
    ];

    if (role === "dm") {
      updateData.staffSlots = staffSlots;
      changedFields.push("staffSlots");
    } else {
      updateData.players = players;
      updateData.playerIds = activePlayerIds({ players });
      updateData.slots = slots;
      changedFields.push("players", "playerIds", "slots");
    }

    return {
      changed: true,
      reason: "roster_updated",
      updateData,
      changedFields,
      role,
      addedCount,
      seatedCount,
      pendingIdentityCount,
      alreadyExistsCount,
      targetCount: userIds.length
    };
  }, dependencies);

  if (
    result &&
    result.changed &&
    role !== "dm" &&
    result.afterCar &&
    (result.afterCar.studioId || result.afterCar.organizationId)
  ) {
    try {
      await studioSync(result.afterCar);
    } catch (error) {
      console.error("LINE roster Studio Recruitment sync failed.", error);
      result.studioSyncError = text(error && error.message);
    }
  }

  return result;
}

module.exports = {
  MAX_TARGETS,
  normalizeRole,
  roleLabel,
  mentionedUserIds,
  buildProfileMap,
  isManager,
  findAvailableSeat,
  makePlayer,
  makeProvisionalPlayer,
  assignSeat,
  addStaffSlot,
  addProvisionalStaffSlot,
  upsertPendingCandidate,
  syntheticLineId,
  addMentionedRosterMembers
};

"use strict";

const BASE_URL = "https://api.line.me/v2/bot/group";

function text(value) { return String(value == null ? "" : value).trim(); }
function token() { return text(process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN); }

async function lineGet(path, dependencies = {}) {
  const accessToken = dependencies.accessToken || token();
  const request = dependencies.fetch || fetch;
  if (!accessToken) throw new Error("line_messaging_channel_access_token_missing");
  const response = await request(`${BASE_URL}/${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`line_group_membership_failed_${response.status}`);
  return response.json();
}

async function getGroupSummary(groupId, dependencies = {}) {
  const rawId = text(groupId);
  const id = encodeURIComponent(rawId);
  if (!id) throw new Error("line_group_id_required");
  const result = await lineGet(`${id}/summary`, dependencies);
  return {
    groupId: text(result && result.groupId) || rawId,
    groupName: text(result && result.groupName),
    pictureUrl: text(result && result.pictureUrl)
  };
}

async function getGroupMemberCount(groupId, dependencies = {}) {
  const id = encodeURIComponent(text(groupId));
  if (!id) throw new Error("line_group_id_required");
  const result = await lineGet(`${id}/members/count`, dependencies);
  return Math.max(0, Number(result && result.count) || 0);
}

async function listGroupMemberIds(groupId, dependencies = {}) {
  const id = encodeURIComponent(text(groupId));
  if (!id) throw new Error("line_group_id_required");
  const ids = [];
  let continuationToken = "";
  do {
    const suffix = continuationToken
      ? `?start=${encodeURIComponent(continuationToken)}`
      : "";
    const result = await lineGet(`${id}/members/ids${suffix}`, dependencies);
    for (const userId of (result && result.memberIds || [])) {
      const normalized = text(userId);
      if (normalized) ids.push(normalized);
    }
    continuationToken = text(result && result.next);
  } while (continuationToken);
  return Array.from(new Set(ids));
}

module.exports = { getGroupSummary, getGroupMemberCount, listGroupMemberIds };

console.log("picker-data.js 已成功載入！");

(function () {
  function getDatabase() {
    const db = window.db || null;
    if (!db) throw new Error("Firebase 尚未載入");
    return db;
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  function text(value) {
    return String(value || "").trim();
  }

  function getMemberName(member) {
    const safeMember = member || {};
    return text(
      safeMember.displayName || safeMember.nickname || safeMember.playerName ||
      safeMember.lineDisplayName || safeMember.name || "未命名工作人員"
    );
  }

  function getMemberSearchValues(member) {
    const safeMember = member || {};
    const aliases = Array.isArray(safeMember.aliases) ? safeMember.aliases : [];
    return [
      safeMember.displayName, safeMember.nickname, safeMember.playerName,
      safeMember.lineDisplayName, safeMember.name, safeMember.memberCode,
      safeMember.phone, ...aliases
    ].map(text).filter(Boolean);
  }

  function sortMembersByName(members) {
    return (Array.isArray(members) ? [...members] : []).sort(function (a, b) {
      return getMemberName(a).localeCompare(getMemberName(b), "zh-Hant");
    });
  }

  function removeDeletedMembers(members) {
    return (Array.isArray(members) ? members : []).filter(function (member) {
      const status = text(member.status).toLowerCase();
      return status !== "deleted" && status !== "removed" && status !== "merged";
    });
  }

  function getCanonicalMemberId(member) {
    const safe = member || {};
    return text(
      safe.canonicalPersonId || safe.canonicalProfileId || safe.canonicalMemberId ||
      safe.mergedIntoPersonId || safe.mergedIntoProfileId || safe.mergedIntoMemberId ||
      safe.personId || safe.profileId || safe.identityId || safe.id
    );
  }

  function evidenceScore(member) {
    const safe = member || {};
    let score = 0;
    if (text(safe.lineUserId) || text(safe.lineIdentityId)) score += 100;
    if (text(safe.identityId)) score += 60;
    if (text(safe.profileId)) score += 40;
    if (text(safe.personId)) score += 30;
    if (Array.isArray(safe.linkedPlayerIds)) score += Math.min(safe.linkedPlayerIds.length, 20);
    if (safe.isCanonicalPerson === true || safe.isCanonicalProfile === true) score += 200;
    return score;
  }

  function dedupeCanonicalMembers(members) {
    const byCanonical = new Map();
    (Array.isArray(members) ? members : []).forEach(function (member) {
      const key = getCanonicalMemberId(member) || text(member && member.id);
      if (!key) return;
      const existing = byCanonical.get(key);
      if (!existing || evidenceScore(member) > evidenceScore(existing)) {
        byCanonical.set(key, member);
      }
    });
    return Array.from(byCanonical.values());
  }

  async function loadAllMembers() {
    const snapshot = await getDatabase().collection("players").get();
    const members = snapshot.docs.map(function (doc) {
      return { id: doc.id, ...doc.data() };
    });
    return sortMembersByName(dedupeCanonicalMembers(removeDeletedMembers(members)));
  }

  function searchMembers(members, keyword) {
    const target = normalizeText(keyword);
    if (!target) return [];
    return (Array.isArray(members) ? members : []).filter(function (member) {
      return getMemberSearchValues(member).some(function (value) {
        return normalizeText(value).includes(target);
      });
    });
  }

  function getDirectStudioMemberIds(car) {
    const safeCar = car || {};
    const possibleLists = [safeCar.staffIds, safeCar.dmIds, safeCar.studioStaffIds, safeCar.studioMemberIds];
    return [...new Set(possibleLists.flatMap(function (list) {
      return Array.isArray(list) ? list : [];
    }).map(String).map(function (id) { return id.trim(); }).filter(Boolean))];
  }

  function getStudioId(car) {
    const safeCar = car || {};
    return text(safeCar.studioId || safeCar.organizerId);
  }

  async function loadStudioById(studioId) {
    const safeStudioId = text(studioId);
    if (!safeStudioId) return null;
    const snapshot = await getDatabase().collection("studios").doc(safeStudioId).get();
    if (!snapshot.exists) return null;
    return { id: snapshot.id, ...snapshot.data() };
  }

  function getStudioMemberIds(studio) {
    const safeStudio = studio || {};
    const possibleLists = [safeStudio.staffIds, safeStudio.memberIds, safeStudio.dmIds, safeStudio.ownerIds];
    return [...new Set(possibleLists.flatMap(function (list) {
      return Array.isArray(list) ? list : [];
    }).map(String).map(function (id) { return id.trim(); }).filter(Boolean))];
  }

  async function loadStudioMemberIds(car) {
    const directIds = getDirectStudioMemberIds(car);
    if (directIds.length > 0) return directIds;
    const studioId = getStudioId(car);
    if (!studioId) return [];
    try {
      return getStudioMemberIds(await loadStudioById(studioId));
    } catch (error) {
      console.warn("讀取工作室人員名單失敗：", error);
      return [];
    }
  }

  function getMembersByIds(members, memberIds) {
    const idSet = new Set((Array.isArray(memberIds) ? memberIds : []).map(String).filter(Boolean));
    return (Array.isArray(members) ? members : []).filter(function (member) {
      return idSet.has(String(member.id)) || idSet.has(getCanonicalMemberId(member));
    });
  }

  function findDuplicateMember(members, displayName) {
    const target = normalizeText(displayName);
    if (!target) return null;
    return (Array.isArray(members) ? members : []).find(function (member) {
      return getMemberSearchValues(member).some(function (value) {
        return normalizeText(value) === target;
      });
    }) || null;
  }

  window.JLYMemberPickerData = {
    normalizeText, getMemberName, getMemberSearchValues,
    getCanonicalMemberId, dedupeCanonicalMembers,
    loadAllMembers, searchMembers,
    loadStudioById, loadStudioMemberIds, getStudioMemberIds,
    getMembersByIds, findDuplicateMember
  };
})();
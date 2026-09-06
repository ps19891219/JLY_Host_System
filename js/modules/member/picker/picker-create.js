console.log("picker-create.js 已成功載入！");

(function () {
  function getDatabase() {
    const db = window.db || null;
    if (!db) throw new Error("Firebase 尚未載入");
    return db;
  }

  function getDataModule() {
    const module = window.JLYMemberPickerData;
    if (!module) throw new Error("JLYMemberPickerData 尚未載入");
    return module;
  }

  function getStateModule() {
    const module = window.JLYMemberPickerState;
    if (!module) throw new Error("JLYMemberPickerState 尚未載入");
    return module;
  }

  function normalizeDisplayName(displayName) {
    return String(displayName || "").trim().replace(/\s+/g, " ");
  }

  function validateDisplayName(displayName) {
    const safeName = normalizeDisplayName(displayName);
    if (!safeName) return { valid: false, message: "請輸入工作人員名稱" };
    if (safeName.length > 50) return { valid: false, message: "名稱不可超過 50 個字" };
    return { valid: true, value: safeName };
  }

  function createMemberPayload(displayName) {
    const now = new Date().toISOString();
    return {
      displayName,
      nickname: displayName,
      aliases: [],
      roles: ["staff"],
      memberType: "guest",
      type: "guest",
      status: "active",
      isLineLinked: false,
      lineUserId: null,
      lineDisplayName: "",
      linePictureUrl: "",
      staffEnabled: true,
      source: "host_manual_staff",
      createdAt: now,
      updatedAt: now
    };
  }

  function buildCreatedMember(documentId, payload) {
    return { id: String(documentId), ...payload };
  }

  async function findSameNameCandidates(displayName) {
    const dataModule = getDataModule();
    let members = getStateModule().getAllMembers();
    let matches = dataModule.findDuplicateMembers
      ? dataModule.findDuplicateMembers(members, displayName)
      : [dataModule.findDuplicateMember(members, displayName)].filter(Boolean);

    if (matches.length > 0) return matches;

    // Picker state may be filtered or stale. Re-read the canonical source before creating.
    members = await dataModule.loadAllMembers();
    return dataModule.findDuplicateMembers
      ? dataModule.findDuplicateMembers(members, displayName)
      : [dataModule.findDuplicateMember(members, displayName)].filter(Boolean);
  }

  async function findDuplicate(displayName) {
    return (await findSameNameCandidates(displayName))[0] || null;
  }

  async function createMember(displayName, options = {}) {
    const validation = validateDisplayName(displayName);
    if (!validation.valid) throw new Error(validation.message);

    const safeName = validation.value;
    const allowSameNamePerson = options.allowSameNamePerson === true;
    const sameNameCandidates = await findSameNameCandidates(safeName);

    if (sameNameCandidates.length > 0 && !allowSameNamePerson) {
      return {
        created: false,
        duplicate: true,
        requiresExplicitSameNameOverride: true,
        sameNameCandidates,
        member: null
      };
    }

    const payload = createMemberPayload(safeName);
    if (sameNameCandidates.length > 0 && allowSameNamePerson) {
      payload.sameNameOverride = true;
      payload.sameNameReferenceIds = sameNameCandidates.map(function (member) {
        return String(member.id || "");
      }).filter(Boolean);
      payload.source = "host_manual_staff_same_name_override";
    }

    const documentRef = await getDatabase().collection("players").add(payload);
    const member = buildCreatedMember(documentRef.id, payload);
    getStateModule().addMember(member);

    return {
      created: true,
      duplicate: sameNameCandidates.length > 0,
      sameNameCandidates,
      member
    };
  }

  async function createOrUseExisting(displayName, options = {}) {
    const result = await createMember(displayName, options);
    if (!result.created) {
      const error = new Error("找到同名 Person，請先選擇既有 Person，或明確確認要建立另一位同名 Person。");
      error.code = "same_name_person_requires_resolution";
      error.sameNameCandidates = result.sameNameCandidates || [];
      throw error;
    }
    return result.member;
  }

  async function ensureStaffRole(member) {
    if (!member || !member.id) throw new Error("找不到 Member 資料");
    const currentRoles = Array.isArray(member.roles) ? member.roles.map(String) : [];
    if (currentRoles.includes("staff") && member.staffEnabled === true) return member;

    const nextRoles = [...new Set([...currentRoles, "staff"])];
    const updatedAt = new Date().toISOString();
    await getDatabase().collection("players").doc(String(member.id)).update({
      roles: nextRoles,
      staffEnabled: true,
      updatedAt
    });

    const updatedMember = { ...member, roles: nextRoles, staffEnabled: true, updatedAt };
    getStateModule().addMember(updatedMember);
    return updatedMember;
  }

  async function prepareMemberForStaff(displayName, options = {}) {
    const member = await createOrUseExisting(displayName, options);
    return ensureStaffRole(member);
  }

  window.JLYMemberPickerCreate = {
    normalizeDisplayName,
    validateDisplayName,
    createMemberPayload,
    findSameNameCandidates,
    findDuplicate,
    createMember,
    createOrUseExisting,
    ensureStaffRole,
    prepareMemberForStaff
  };
})();
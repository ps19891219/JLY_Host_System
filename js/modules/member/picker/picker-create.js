console.log(
  "picker-create.js 已成功載入！"
);

(function () {
  function getDatabase() {
    const db =
      window.db || null;

    if (!db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    return db;
  }

  function getDataModule() {
    const dataModule =
      window
        .JLYMemberPickerData;

    if (!dataModule) {
      throw new Error(
        "JLYMemberPickerData 尚未載入"
      );
    }

    return dataModule;
  }

  function getStateModule() {
    const stateModule =
      window
        .JLYMemberPickerState;

    if (!stateModule) {
      throw new Error(
        "JLYMemberPickerState 尚未載入"
      );
    }

    return stateModule;
  }

  function normalizeDisplayName(
    displayName
  ) {
    return String(
      displayName || ""
    )
      .trim()
      .replace(/\s+/g, " ");
  }

  function validateDisplayName(
    displayName
  ) {
    const safeName =
      normalizeDisplayName(
        displayName
      );

    if (!safeName) {
      return {
        valid: false,
        message:
          "請輸入工作人員名稱"
      };
    }

    if (safeName.length > 50) {
      return {
        valid: false,
        message:
          "名稱不可超過 50 個字"
      };
    }

    return {
      valid: true,
      value: safeName
    };
  }

  function createMemberPayload(
    displayName
  ) {
    const now =
      new Date()
        .toISOString();

    return {
      displayName:
        displayName,

      nickname:
        displayName,

      aliases:
        [],

      roles: [
        "staff"
      ],

      memberType:
        "guest",

      type:
        "guest",

      status:
        "active",

      isLineLinked:
        false,

      lineUserId:
        null,

      lineDisplayName:
        "",

      linePictureUrl:
        "",

      staffEnabled:
        true,

      source:
        "host_manual_staff",

      createdAt:
        now,

      updatedAt:
        now
    };
  }

  function buildCreatedMember(
    documentId,
    payload
  ) {
    return {
      id:
        String(documentId),

      ...payload
    };
  }

  async function findDuplicate(
    displayName
  ) {
    const dataModule =
      getDataModule();

    const stateModule =
      getStateModule();

    const members =
      stateModule
        .getAllMembers();

    return dataModule
      .findDuplicateMember(
        members,
        displayName
      );
  }

  async function createMember(
    displayName,
    options = {}
  ) {
    const validation =
      validateDisplayName(
        displayName
      );

    if (!validation.valid) {
      throw new Error(
        validation.message
      );
    }

    const safeName =
      validation.value;

    const allowDuplicate =
      Boolean(
        options.allowDuplicate
      );

    if (!allowDuplicate) {
      const duplicate =
        await findDuplicate(
          safeName
        );

      if (duplicate) {
        return {
          created: false,
          duplicate: true,
          member: duplicate
        };
      }
    }

    const db =
      getDatabase();

    const payload =
      createMemberPayload(
        safeName
      );

    const documentRef =
      await db
        .collection("players")
        .add(payload);

    const member =
      buildCreatedMember(
        documentRef.id,
        payload
      );

    const stateModule =
      getStateModule();

    stateModule.addMember(
      member
    );

    return {
      created: true,
      duplicate: false,
      member: member
    };
  }

  async function createOrUseExisting(
    displayName
  ) {
    const result =
      await createMember(
        displayName
      );

    return result.member;
  }

  async function ensureStaffRole(
    member
  ) {
    if (
      !member ||
      !member.id
    ) {
      throw new Error(
        "找不到 Member 資料"
      );
    }

    const currentRoles =
      Array.isArray(
        member.roles
      )
        ? member.roles
            .map(String)
        : [];

    if (
      currentRoles.includes(
        "staff"
      ) &&
      member.staffEnabled ===
        true
    ) {
      return member;
    }

    const nextRoles = [
      ...new Set([
        ...currentRoles,
        "staff"
      ])
    ];

    const updatedAt =
      new Date()
        .toISOString();

    const db =
      getDatabase();

    await db
      .collection("players")
      .doc(String(member.id))
      .update({
        roles:
          nextRoles,

        staffEnabled:
          true,

        updatedAt:
          updatedAt
      });

    const updatedMember = {
      ...member,

      roles:
        nextRoles,

      staffEnabled:
        true,

      updatedAt:
        updatedAt
    };

    getStateModule()
      .addMember(
        updatedMember
      );

    return updatedMember;
  }

  async function prepareMemberForStaff(
    displayName
  ) {
    const member =
      await createOrUseExisting(
        displayName
      );

    return ensureStaffRole(
      member
    );
  }

  window.JLYMemberPickerCreate = {
    normalizeDisplayName,
    validateDisplayName,
    createMemberPayload,

    findDuplicate,
    createMember,
    createOrUseExisting,
    ensureStaffRole,
    prepareMemberForStaff
  };
})();
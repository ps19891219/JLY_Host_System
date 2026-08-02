console.log(
  "staff-actions.js V2 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // 基礎工具
  // ============================================================

  function getText(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function getBoolean(value) {
    return value === true;
  }

  function cloneValue(value) {
    if (
      !value ||
      typeof value !== "object"
    ) {
      return value;
    }

    try {
      return JSON.parse(
        JSON.stringify(value)
      );
    } catch (error) {
      return {
        ...value
      };
    }
  }

  // ============================================================
  // 取得工作人員欄位
  // ============================================================

  function getStaffSlots(car) {
    if (
      window.JLYStaffData &&
      typeof window.JLYStaffData
        .getStaffSlots ===
        "function"
    ) {
      const staffSlots =
        window.JLYStaffData
          .getStaffSlots(car);

      if (
        Array.isArray(staffSlots)
      ) {
        return staffSlots.map(
          function (staff) {
            return {
              ...staff,

              memberSnapshot:
                cloneValue(
                  staff.memberSnapshot ||
                  {}
                )
            };
          }
        );
      }
    }

    const sourceSlots =
      car &&
      Array.isArray(
        car.staffSlots
      )
        ? car.staffSlots
        : [];

    return sourceSlots.map(
      function (staff) {
        return {
          ...staff,

          memberSnapshot:
            cloneValue(
              staff.memberSnapshot ||
              {}
            )
        };
      }
    );
  }

  // ============================================================
  // 建立 ID
  // ============================================================

  function createStaffId() {
    return (
      "staff_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 8)
    );
  }

  // ============================================================
  // 取得會員資料
  // ============================================================

  function getMemberSource(member) {
    const safeMember =
      member &&
      typeof member === "object"
        ? member
        : {};

    if (
      safeMember.member &&
      typeof safeMember.member ===
        "object"
    ) {
      return {
        ...safeMember.member,
        ...safeMember
      };
    }

    if (
      safeMember.player &&
      typeof safeMember.player ===
        "object"
    ) {
      return {
        ...safeMember.player,
        ...safeMember
      };
    }

    return safeMember;
  }

  function getMemberId(member) {
    const safeMember =
      getMemberSource(
        member
      );

    return getText(
      safeMember.memberId ||
      safeMember.playerId ||
      safeMember.profileId ||
      safeMember.id ||
      safeMember.applicationId
    );
  }

  function getMemberDisplayName(
    member
  ) {
    const safeMember =
      getMemberSource(
        member
      );

    return getText(
      safeMember.hostAlias ||
      safeMember.displayName ||
      safeMember.playerName ||
      safeMember.nickname ||
      safeMember.name ||
      safeMember.lineDisplayName
    );
  }

  function getMemberPosition(
    member
  ) {
    const safeMember =
      getMemberSource(
        member
      );

    return getText(
      safeMember.position ||
      safeMember.playPosition ||
      safeMember.currentPosition ||
      safeMember.requestedPosition ||
      safeMember.roleChoice
    );
  }

  function getMemberCrossPlay(
    member
  ) {
    const safeMember =
      getMemberSource(
        member
      );

    return (
      safeMember.isCrossPlay ===
      true
    );
  }

  function buildMemberSnapshot(
    member
  ) {
    const safeMember =
      getMemberSource(
        member
      );

    return {
      memberId:
        getMemberId(
          safeMember
        ),

      displayName:
        getMemberDisplayName(
          safeMember
        ),

      isCrossPlay:
        getMemberCrossPlay(
          safeMember
        ),

      position:
        getMemberPosition(
          safeMember
        ),

      hostAlias:
        getText(
          safeMember.hostAlias
        ),

      playerName:
        getText(
          safeMember.playerName
        ),

      lineDisplayName:
        getText(
          safeMember.lineDisplayName
        ),

      source:
        getText(
          safeMember.source ||
          "member_picker"
        )
    };
  }

  // ============================================================
  // 建立空白工作人員欄位
  // ============================================================

  function createLocalStaffSlot(
    order
  ) {
    const safeOrder =
      Number(order || 1);

    if (
      window.JLYStaffData &&
      typeof window.JLYStaffData
        .createStaffSlot ===
        "function"
    ) {
      return window.JLYStaffData
        .createStaffSlot(
          safeOrder,
          {
            id:
              createStaffId(),

            order:
              safeOrder,

            label:
              "",

            memberId:
              "",

            displayName:
              "",

            isCrossPlay:
              false,

            position:
              "",

            memberSnapshot:
              {},

            source:
              "host_manual"
          }
        );
    }

    return {
      id:
        createStaffId(),

      order:
        safeOrder,

      label:
        "",

      memberId:
        "",

      displayName:
        "",

      isCrossPlay:
        false,

      position:
        "",

      memberSnapshot:
        {},

      source:
        "host_manual"
    };
  }

  // ============================================================
  // 標準化
  // ============================================================

  function normalizeStaffSlots(
    staffSlots
  ) {
    const safeSlots =
      Array.isArray(
        staffSlots
      )
        ? staffSlots
        : [];

    if (
      window.JLYStaffData &&
      typeof window.JLYStaffData
        .normalizeStaffSlots ===
        "function"
    ) {
      return window.JLYStaffData
        .normalizeStaffSlots(
          safeSlots
        );
    }

    return safeSlots.map(
      function (
        staff,
        index
      ) {
        const safeStaff =
          staff || {};

        return {
          id:
            getText(
              safeStaff.id
            ) ||
            createStaffId(),

          order:
            index + 1,

          label:
            getText(
              safeStaff.label
            ),

          memberId:
            getText(
              safeStaff.memberId
            ),

          displayName:
            getText(
              safeStaff.displayName
            ),

          isCrossPlay:
            getBoolean(
              safeStaff.isCrossPlay
            ),

          position:
            getText(
              safeStaff.position
            ),

          memberSnapshot:
            cloneValue(
              safeStaff.memberSnapshot ||
              {}
            ),

          source:
            getText(
              safeStaff.source ||
              "host_manual"
            )
        };
      }
    );
  }

  // ============================================================
  // 查找欄位
  // ============================================================

  function findStaffSlot(
    staffSlots,
    staffId
  ) {
    if (
      window.JLYStaffData &&
      typeof window.JLYStaffData
        .findStaffSlot ===
        "function"
    ) {
      return window.JLYStaffData
        .findStaffSlot(
          staffSlots,
          staffId
        );
    }

    const targetId =
      getText(
        staffId
      );

    return (
      (
        Array.isArray(
          staffSlots
        )
          ? staffSlots
          : []
      ).find(
        function (staff) {
          return (
            getText(
              staff && staff.id
            ) === targetId
          );
        }
      ) ||
      null
    );
  }

  function getStaffIndex(
    staffSlots,
    staffId
  ) {
    const targetId =
      getText(
        staffId
      );

    return (
      Array.isArray(
        staffSlots
      )
        ? staffSlots
        : []
    ).findIndex(
      function (staff) {
        return (
          getText(
            staff && staff.id
          ) === targetId
        );
      }
    );
  }

  // ============================================================
  // Firestore 儲存
  // ============================================================

  async function saveStaffSlots(
    car,
    staffSlots
  ) {
    const db =
      window.db;

    if (!db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    if (
      !car ||
      !car.id
    ) {
      throw new Error(
        "找不到車團 ID"
      );
    }

    const normalizedSlots =
      normalizeStaffSlots(
        staffSlots
      );

    const updateData = {
      staffSlots:
        normalizedSlots
    };

    if (
      window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore
        .FieldValue
    ) {
      updateData.updatedAt =
        window.firebase.firestore
          .FieldValue
          .serverTimestamp();
    }

    await db
      .collection("cars")
      .doc(car.id)
      .update(updateData);

    car.staffSlots =
      normalizedSlots;

    window.currentCarData =
      car;

    return normalizedSlots;
  }

  // ============================================================
  // 新增欄位
  // ============================================================

  async function addStaffSlot(
    car
  ) {
    if (!car) {
      throw new Error(
        "找不到目前車團資料"
      );
    }

    const staffSlots =
      getStaffSlots(car);

    const newStaffSlot =
      createLocalStaffSlot(
        staffSlots.length + 1
      );

    staffSlots.push(
      newStaffSlot
    );

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  // ============================================================
  // 修改欄位名稱
  // ============================================================

  async function updateStaffLabel(
    car,
    staffId,
    label
  ) {
    const staffSlots =
      getStaffSlots(car);

    const target =
      findStaffSlot(
        staffSlots,
        staffId
      );

    if (!target) {
      throw new Error(
        "找不到要修改的工作人員欄位"
      );
    }

    target.label =
      getText(label);

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  // ============================================================
  // 手動修改顯示名稱
  // ============================================================

  async function updateStaffName(
    car,
    staffId,
    displayName
  ) {
    const staffSlots =
      getStaffSlots(car);

    const target =
      findStaffSlot(
        staffSlots,
        staffId
      );

    if (!target) {
      throw new Error(
        "找不到要修改的工作人員欄位"
      );
    }

    const nextName =
      getText(
        displayName
      );

    target.displayName =
      nextName;

    target.memberSnapshot = {
      ...(
        target.memberSnapshot ||
        {}
      ),

      memberId:
        getText(
          target.memberId
        ),

      displayName:
        nextName,

      isCrossPlay:
        getBoolean(
          target.isCrossPlay
        ),

      position:
        getText(
          target.position
        )
    };

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  // ============================================================
  // 選擇或更換工作人員
  // ============================================================

  async function updateStaffMember(
    car,
    staffId,
    member
  ) {
    const staffSlots =
      getStaffSlots(car);

    const target =
      findStaffSlot(
        staffSlots,
        staffId
      );

    if (!target) {
      throw new Error(
        "找不到要修改的工作人員欄位"
      );
    }

    const memberId =
      getMemberId(member);

    const displayName =
      getMemberDisplayName(
        member
      );

    if (!memberId) {
      throw new Error(
        "找不到選取人員的 memberId"
      );
    }

    if (!displayName) {
      throw new Error(
        "找不到選取人員的顯示名稱"
      );
    }

    const snapshot =
      buildMemberSnapshot(
        member
      );

    target.memberId =
      memberId;

    target.displayName =
      displayName;

    target.isCrossPlay =
      getMemberCrossPlay(
        member
      );

    target.position =
      getMemberPosition(
        member
      );

    target.memberSnapshot = {
      ...snapshot,

      memberId,

      displayName,

      isCrossPlay:
        target.isCrossPlay,

      position:
        target.position
    };

    target.source =
      "member_picker";

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  // ============================================================
  // 刪除整個工作人員欄位
  //
  // 只會刪除這台車裡的欄位，
  // 不會刪除玩家／會員資料庫中的人物。
  // ============================================================

  async function removeStaffSlot(
    car,
    staffId
  ) {
    const staffSlots =
      getStaffSlots(car);

    const targetIndex =
      getStaffIndex(
        staffSlots,
        staffId
      );

    if (targetIndex < 0) {
      throw new Error(
        "找不到要刪除的工作人員欄位"
      );
    }

    staffSlots.splice(
      targetIndex,
      1
    );

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  // ============================================================
  // 舊版清除人員
  //
  // 保留函式名稱避免舊程式報錯。
  // 新版畫面不會使用它。
  // ============================================================

  async function clearStaffMember(
    car,
    staffId
  ) {
    const staffSlots =
      getStaffSlots(car);

    const target =
      findStaffSlot(
        staffSlots,
        staffId
      );

    if (!target) {
      throw new Error(
        "找不到要清除的工作人員欄位"
      );
    }

    target.memberId =
      "";

    target.displayName =
      "";

    target.isCrossPlay =
      false;

    target.position =
      "";

    target.memberSnapshot =
      {};

    target.source =
      "host_manual";

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  // ============================================================
  // 移動整個工作人員欄位
  // ============================================================

  async function moveStaffSlot(
    car,
    sourceStaffId,
    targetStaffId
  ) {
    const staffSlots =
      getStaffSlots(car);

    const sourceIndex =
      getStaffIndex(
        staffSlots,
        sourceStaffId
      );

    const targetIndex =
      getStaffIndex(
        staffSlots,
        targetStaffId
      );

    if (
      sourceIndex < 0 ||
      targetIndex < 0
    ) {
      throw new Error(
        "找不到要移動的工作人員欄位"
      );
    }

    if (
      sourceIndex ===
      targetIndex
    ) {
      return staffSlots;
    }

    const movedItems =
      staffSlots.splice(
        sourceIndex,
        1
      );

    const movedSlot =
      movedItems[0];

    staffSlots.splice(
      targetIndex,
      0,
      movedSlot
    );

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  // ============================================================
  // 移動工作人員名字
  //
  // 來源欄位保留，但人員資料移到目標欄位。
  // 若目標已有工作人員，兩邊交換。
  // ============================================================

  async function moveStaffMember(
    car,
    sourceStaffId,
    targetStaffId
  ) {
    const staffSlots =
      getStaffSlots(car);

    const source =
      findStaffSlot(
        staffSlots,
        sourceStaffId
      );

    const target =
      findStaffSlot(
        staffSlots,
        targetStaffId
      );

    if (
      !source ||
      !target
    ) {
      throw new Error(
        "找不到要移動的工作人員欄位"
      );
    }

    if (
      getText(source.id) ===
      getText(target.id)
    ) {
      return staffSlots;
    }

    const sourceMemberData = {
      memberId:
        getText(
          source.memberId
        ),

      displayName:
        getText(
          source.displayName
        ),

      isCrossPlay:
        getBoolean(
          source.isCrossPlay
        ),

      position:
        getText(
          source.position
        ),

      memberSnapshot:
        cloneValue(
          source.memberSnapshot ||
          {}
        ),

      source:
        getText(
          source.source ||
          "host_manual"
        )
    };

    const targetMemberData = {
      memberId:
        getText(
          target.memberId
        ),

      displayName:
        getText(
          target.displayName
        ),

      isCrossPlay:
        getBoolean(
          target.isCrossPlay
        ),

      position:
        getText(
          target.position
        ),

      memberSnapshot:
        cloneValue(
          target.memberSnapshot ||
          {}
        ),

      source:
        getText(
          target.source ||
          "host_manual"
        )
    };

    Object.assign(
      source,
      targetMemberData
    );

    Object.assign(
      target,
      sourceMemberData
    );

    return await saveStaffSlots(
      car,
      staffSlots
    );
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYStaffActions = {
    getText,

    getStaffSlots,

    createStaffId,

    createLocalStaffSlot,

    normalizeStaffSlots,

    findStaffSlot,

    getStaffIndex,

    getMemberSource,

    getMemberId,

    getMemberDisplayName,

    getMemberPosition,

    getMemberCrossPlay,

    buildMemberSnapshot,

    saveStaffSlots,

    addStaffSlot,

    updateStaffLabel,

    updateStaffName,

    updateStaffMember,

    removeStaffSlot,

    clearStaffMember,

    moveStaffSlot,

    moveStaffMember
  };

  console.log(
    "✅ Staff Actions V2 已載入"
  );
})();
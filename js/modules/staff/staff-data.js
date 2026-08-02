console.log(
  "staff-data.js V2 已成功載入！"
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

  function createStaffSlotId(
    order
  ) {
    return (
      "staff-slot-" +
      Date.now() +
      "-" +
      Number(order || 1) +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 8)
    );
  }

  // ============================================================
  // 工作人員的人員快照
  //
  // 這份資料屬於「這一台車」。
  // 不會因會員資料日後修改而回頭改動歷史車團。
  // ============================================================

  function cloneMemberSnapshot(
    source
  ) {
    const safeSource =
      source &&
      typeof source === "object"
        ? source
        : {};

    const nestedMember =
      safeSource.member &&
      typeof safeSource.member ===
        "object"
        ? safeSource.member
        : {};

    return {
      memberId:
        getText(
          safeSource.memberId ||
          safeSource.playerId ||
          safeSource.profileId ||
          safeSource.id ||
          nestedMember.memberId ||
          nestedMember.playerId ||
          nestedMember.profileId ||
          nestedMember.id
        ),

      displayName:
        getText(
          safeSource.displayName ||
          safeSource.hostAlias ||
          safeSource.playerName ||
          safeSource.nickname ||
          safeSource.name ||
          nestedMember.displayName ||
          nestedMember.hostAlias ||
          nestedMember.playerName ||
          nestedMember.nickname ||
          nestedMember.name
        ),

      isCrossPlay:
        getBoolean(
          safeSource.isCrossPlay
        ) ||
        getBoolean(
          nestedMember.isCrossPlay
        ),

      position:
        getText(
          safeSource.position ||
          safeSource.playPosition ||
          safeSource.currentPosition ||
          nestedMember.position ||
          nestedMember.playPosition ||
          nestedMember.currentPosition
        ),

      source:
        getText(
          safeSource.source ||
          nestedMember.source
        )
    };
  }

  // ============================================================
  // 複製單一工作人員欄位
  // ============================================================

  function cloneStaffSlot(slot) {
    const safeSlot =
      slot &&
      typeof slot === "object"
        ? slot
        : {};

    const snapshot =
      cloneMemberSnapshot(
        safeSlot.memberSnapshot ||
        safeSlot.player ||
        safeSlot.member ||
        safeSlot
      );

    const memberId =
      getText(
        safeSlot.memberId ||
        safeSlot.playerId ||
        snapshot.memberId
      );

    const displayName =
      getText(
        safeSlot.displayName ||
        safeSlot.name ||
        snapshot.displayName
      );

    return {
      id:
        getText(
          safeSlot.id ||
          safeSlot.slotId
        ),

      order:
        Number(
          safeSlot.order || 0
        ),

      label:
        getText(
          safeSlot.label ||
          safeSlot.roleLabel ||
          safeSlot.title
        ),

      memberId,

      displayName,

      isCrossPlay:
        getBoolean(
          safeSlot.isCrossPlay
        ) ||
        getBoolean(
          snapshot.isCrossPlay
        ),

      position:
        getText(
          safeSlot.position ||
          safeSlot.playPosition ||
          snapshot.position
        ),

      memberSnapshot: {
        ...snapshot,

        memberId:
          memberId ||
          snapshot.memberId,

        displayName:
          displayName ||
          snapshot.displayName,

        isCrossPlay:
          getBoolean(
            safeSlot.isCrossPlay
          ) ||
          getBoolean(
            snapshot.isCrossPlay
          ),

        position:
          getText(
            safeSlot.position ||
            safeSlot.playPosition ||
            snapshot.position
          )
      },

      source:
        getText(
          safeSlot.source ||
          snapshot.source ||
          "staff_slot"
        )
    };
  }

  // ============================================================
  // 建立單一工作人員欄位
  // ============================================================

  function createStaffSlot(
    index,
    data
  ) {
    const safeData =
      data &&
      typeof data === "object"
        ? data
        : {};

    const order =
      Number(
        safeData.order ||
        index ||
        1
      );

    const cloned =
      cloneStaffSlot(
        safeData
      );

    return {
      id:
        cloned.id ||
        createStaffSlotId(
          order
        ),

      order,

      /*
       * 沒有自訂稱謂時，
       * 畫面會使用目前順序 1、2、3。
       *
       * 不在資料層強制寫入 DM。
       */
      label:
        getText(
          cloned.label
        ),

      memberId:
        getText(
          cloned.memberId
        ),

      displayName:
        getText(
          cloned.displayName
        ),

      isCrossPlay:
        getBoolean(
          cloned.isCrossPlay
        ),

      position:
        getText(
          cloned.position
        ),

      memberSnapshot: {
        ...cloneMemberSnapshot(
          cloned.memberSnapshot
        ),

        memberId:
          getText(
            cloned.memberId
          ),

        displayName:
          getText(
            cloned.displayName
          ),

        isCrossPlay:
          getBoolean(
            cloned.isCrossPlay
          ),

        position:
          getText(
            cloned.position
          )
      },

      source:
        getText(
          cloned.source ||
          "staff_slot"
        )
    };
  }

  // ============================================================
  // 舊 dmList 轉換
  //
  // 舊資料可以繼續顯示，
  // 但不會再自動把每一欄寫成「DM」。
  // 若舊資料本身已有自訂 role／title，才會保留。
  // ============================================================

  function convertDmListToStaffSlots(
    car
  ) {
    const safeCar =
      car || {};

    const dmList =
      Array.isArray(
        safeCar.dmList
      )
        ? safeCar.dmList
        : [];

    return dmList.map(
      function (
        dm,
        index
      ) {
        const data =
          typeof dm === "string"
            ? {
                displayName:
                  dm
              }
            : (
                dm || {}
              );

        return createStaffSlot(
          index + 1,
          {
            label:
              getText(
                data.label ||
                data.roleLabel ||
                data.role ||
                data.title
              ),

            memberId:
              getText(
                data.memberId ||
                data.playerId ||
                data.profileId
              ),

            displayName:
              getText(
                data.displayName ||
                data.name ||
                data.dmName
              ),

            isCrossPlay:
              getBoolean(
                data.isCrossPlay
              ),

            position:
              getText(
                data.position ||
                data.playPosition
              ),

            memberSnapshot:
              cloneMemberSnapshot(
                data
              ),

            source:
              "legacy_dmList"
          }
        );
      }
    );
  }

  // ============================================================
  // 取得工作人員欄位
  // ============================================================

  function getStaffSlots(car) {
    const safeCar =
      car || {};

    if (
      Array.isArray(
        safeCar.staffSlots
      )
    ) {
      return safeCar.staffSlots
        .map(
          cloneStaffSlot
        )
        .map(
          function (
            slot,
            index
          ) {
            return createStaffSlot(
              index + 1,
              slot
            );
          }
        )
        .sort(
          function (a, b) {
            return (
              Number(
                a.order || 0
              ) -
              Number(
                b.order || 0
              )
            );
          }
        );
    }

    return convertDmListToStaffSlots(
      safeCar
    );
  }

  // ============================================================
  // 儲存前標準化
  //
  // order 會依目前排列重新編號，
  // 但 label 是使用者自訂內容，不會擅自修改。
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

    return safeSlots.map(
      function (
        slot,
        index
      ) {
        return createStaffSlot(
          index + 1,
          {
            ...(
              slot || {}
            ),

            order:
              index + 1
          }
        );
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
    const targetId =
      getText(
        staffId
      );

    if (!targetId) {
      return null;
    }

    const safeSlots =
      Array.isArray(
        staffSlots
      )
        ? staffSlots
        : [];

    return (
      safeSlots.find(
        function (slot) {
          return (
            getText(
              slot && slot.id
            ) ===
            targetId
          );
        }
      ) ||
      null
    );
  }

  // ============================================================
  // 是否已安排人員
  // ============================================================

  function hasAssignedMember(
    staff
  ) {
    const safeStaff =
      staff || {};

    return Boolean(
      getText(
        safeStaff.memberId
      ) ||
      getText(
        safeStaff.displayName
      )
    );
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYStaffData = {
    getText,

    createStaffSlotId,

    cloneMemberSnapshot,

    cloneStaffSlot,

    createStaffSlot,

    convertDmListToStaffSlots,

    getStaffSlots,

    normalizeStaffSlots,

    findStaffSlot,

    hasAssignedMember
  };

  console.log(
    "✅ Staff Data V2 已載入"
  );
})();
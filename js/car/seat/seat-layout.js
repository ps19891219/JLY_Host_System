console.log("seat-layout.js 已成功載入！");

// ============================================================
// JLY Host System
// Seat Engine V2 - Layout
//
// 負責：
// 1. 將座位依男位、女位、不限位分區
// 2. 維持每個座位目前的順序
// 3. 提供畫面 Render 所需的分組資料
// 4. 判斷空位、已入座與分區統計
//
// 不負責：
// - 安排玩家
// - 修改 slot.playerId
// - Firestore 寫入
// - DOM Render
// - 拖曳事件
// ============================================================

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 取得 Seat Data
  // ------------------------------------------------------------

  function getSeatData() {
    if (!window.JLYSeatData) {
      throw new Error(
        "JLYSeatData 尚未載入，請先載入 seat-data.js"
      );
    }

    return window.JLYSeatData;
  }

  // ------------------------------------------------------------
  // 分區基本設定
  // ------------------------------------------------------------

  const SECTION_ORDER = [
    "male",
    "female",
    "flexible"
  ];

  const SECTION_LABELS = {
    male: "男位",
    female: "女位",
    flexible: "不限位"
  };

  // ------------------------------------------------------------
  // 取得座位真正所屬分區
  //
  // 使用 originalType，而不是目前 type。
  //
  // 原因：
  // 不限位坐入男位玩家後，
  // slot.type 可能暫時變成 male，
  // 但這個座位本質仍然是不限位。
  // ------------------------------------------------------------

  function getSlotSectionType(slot) {
    const SeatData = getSeatData();

    return SeatData.normalizePosition(
      slot &&
      (
        slot.originalType ||
        slot.type
      )
        ? (
            slot.originalType ||
            slot.type
          )
        : "flexible"
    );
  }

  function getSectionLabel(type) {
    const SeatData = getSeatData();

    const normalizedType =
      SeatData.normalizePosition(
        type
      );

    return (
      SECTION_LABELS[
        normalizedType
      ] ||
      SECTION_LABELS.flexible
    );
  }

  // ------------------------------------------------------------
  // 座位排序
  // ------------------------------------------------------------

  function sortSlotsByOrder(slots) {
    const SeatData = getSeatData();

    return SeatData.cloneSlots(
      slots
    ).sort(
      function (a, b) {
        const aOrder =
          Number(a.order || 0);

        const bOrder =
          Number(b.order || 0);

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return String(
          a.slotId || a.id || ""
        ).localeCompare(
          String(
            b.slotId || b.id || ""
          )
        );
      }
    );
  }

  // ------------------------------------------------------------
  // 建立單一分區
  // ------------------------------------------------------------

  function createSection(
    type,
    slots
  ) {
    const SeatData = getSeatData();

    const normalizedType =
      SeatData.normalizePosition(
        type
      );

    const sectionSlots =
      sortSlotsByOrder(
        slots
      ).filter(
        function (slot) {
          return (
            getSlotSectionType(
              slot
            ) ===
            normalizedType
          );
        }
      );

    const occupiedSlots =
      sectionSlots.filter(
        function (slot) {
          return Boolean(
            slot.playerId
          );
        }
      );

    const emptySlots =
      sectionSlots.filter(
        function (slot) {
          return !slot.playerId;
        }
      );

    return {
      type:
        normalizedType,

      label:
        getSectionLabel(
          normalizedType
        ),

      slots:
        sectionSlots,

      occupiedSlots,

      emptySlots,

      totalCount:
        sectionSlots.length,

      occupiedCount:
        occupiedSlots.length,

      emptyCount:
        emptySlots.length,

      isEmpty:
        sectionSlots.length === 0
    };
  }

  // ------------------------------------------------------------
  // 建立全部分區
  //
  // 預設順序：
  // 男位
  // 女位
  // 不限位
  // ------------------------------------------------------------

  function buildSections(
    slots,
    options
  ) {
    const settings = {
      includeEmptySections:
        false,

      sectionOrder:
        SECTION_ORDER,

      ...(
        options || {}
      )
    };

    const sourceSlots =
      Array.isArray(slots)
        ? slots
        : [];

    const requestedOrder =
      Array.isArray(
        settings.sectionOrder
      )
        ? settings.sectionOrder
        : SECTION_ORDER;

    const sections =
      requestedOrder.map(
        function (type) {
          return createSection(
            type,
            sourceSlots
          );
        }
      );

    if (
      settings.includeEmptySections
    ) {
      return sections;
    }

    return sections.filter(
      function (section) {
        return !section.isEmpty;
      }
    );
  }

  // ------------------------------------------------------------
  // 建立完整 Layout
  // ------------------------------------------------------------

  function buildLayout(
    slots,
    waitingPlayers,
    options
  ) {
    const SeatData = getSeatData();

    const sourceSlots =
      sortSlotsByOrder(
        slots
      );

    const sourceWaitingPlayers =
      Array.isArray(
        waitingPlayers
      )
        ? waitingPlayers
        : [];

    const sections =
      buildSections(
        sourceSlots,
        options
      );

    const occupiedSlots =
      sourceSlots.filter(
        function (slot) {
          return Boolean(
            slot.playerId
          );
        }
      );

    const emptySlots =
      sourceSlots.filter(
        function (slot) {
          return !slot.playerId;
        }
      );

    return {
      slots:
        SeatData.cloneSlots(
          sourceSlots
        ),

      sections,

      waitingPlayers:
        sourceWaitingPlayers,

      totalSeatCount:
        sourceSlots.length,

      occupiedSeatCount:
        occupiedSlots.length,

      emptySeatCount:
        emptySlots.length,

      waitingCount:
        sourceWaitingPlayers.length,

      isFull:
        sourceSlots.length > 0 &&
        emptySlots.length === 0,

      hasWaitingPlayers:
        sourceWaitingPlayers.length >
        0,

      hasEmptySeats:
        emptySlots.length > 0
    };
  }

  // ------------------------------------------------------------
  // 取得指定分區
  // ------------------------------------------------------------

  function getSectionByType(
    layoutOrSections,
    type
  ) {
    const SeatData = getSeatData();

    const normalizedType =
      SeatData.normalizePosition(
        type
      );

    const sections =
      Array.isArray(
        layoutOrSections
      )
        ? layoutOrSections
        : (
            layoutOrSections &&
            Array.isArray(
              layoutOrSections.sections
            )
              ? layoutOrSections.sections
              : []
          );

    return (
      sections.find(
        function (section) {
          return (
            section.type ===
            normalizedType
          );
        }
      ) ||
      null
    );
  }

  // ------------------------------------------------------------
  // 判斷座位是否應顯示分類標籤
  //
  // 若畫面已經有：
  //
  // 男位
  // ├─ 座位一
  // └─ 座位二
  //
  // 每一列可以不再重複顯示「男位」。
  // ------------------------------------------------------------

  function shouldShowSlotType(
    slot,
    options
  ) {
    const settings = {
      groupedView: true,

      showFlexibleType:
        true,

      ...(
        options || {}
      )
    };

    if (
      !settings.groupedView
    ) {
      return true;
    }

    const sectionType =
      getSlotSectionType(
        slot
      );

    if (
      sectionType ===
      "flexible"
    ) {
      return Boolean(
        settings.showFlexibleType
      );
    }

    return false;
  }

  // ------------------------------------------------------------
  // 取得座位顯示名稱
  //
  // 優先順序：
  // 1. 角色名稱
  // 2. 自訂座位名稱
  // 3. 席位編號
  // ------------------------------------------------------------

  function getSlotDisplayName(
    slot
  ) {
    if (!slot) {
      return "未命名席位";
    }

    const roleName =
      String(
        slot.roleName ||
        slot.characterName ||
        ""
      ).trim();

    if (roleName) {
      return roleName;
    }

    const seatLabel =
      String(
        slot.seatLabel ||
        ""
      ).trim();

    if (seatLabel) {
      return seatLabel;
    }

    const order =
      Number(
        slot.order || 0
      );

    if (order > 0) {
      return (
        "席位 " +
        String(order)
      );
    }

    return "未命名席位";
  }

  // ------------------------------------------------------------
  // 取得座位狀態
  // ------------------------------------------------------------

  function getSlotStatus(slot) {
    if (!slot) {
      return "unknown";
    }

    if (slot.playerId) {
      return "occupied";
    }

    return "empty";
  }

  // ------------------------------------------------------------
  // 建立 Render 用的座位 View Model
  // ------------------------------------------------------------

  function buildSlotViewModel(
    slot
  ) {
    const SeatData = getSeatData();

    const normalizedSlot =
      SeatData.normalizeSlot(
        slot,
        Number(
          slot &&
          slot.order
            ? slot.order
            : 1
        ) - 1
      );

    return {
      ...normalizedSlot,

      sectionType:
        getSlotSectionType(
          normalizedSlot
        ),

      sectionLabel:
        getSectionLabel(
          getSlotSectionType(
            normalizedSlot
          )
        ),

      displayName:
        getSlotDisplayName(
          normalizedSlot
        ),

      status:
        getSlotStatus(
          normalizedSlot
        ),

      isOccupied:
        Boolean(
          normalizedSlot.playerId
        ),

      isEmpty:
        !normalizedSlot.playerId
    };
  }

  // ------------------------------------------------------------
  // 建立完整 Render View Model
  // ------------------------------------------------------------

  function buildViewModel(
    slots,
    waitingPlayers,
    options
  ) {
    const layout =
      buildLayout(
        slots,
        waitingPlayers,
        options
      );

    return {
      ...layout,

      sections:
        layout.sections.map(
          function (section) {
            return {
              ...section,

              slots:
                section.slots.map(
                  buildSlotViewModel
                )
            };
          }
        )
    };
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatLayout = {
    SECTION_ORDER,
    SECTION_LABELS,

    getSlotSectionType,
    getSectionLabel,

    sortSlotsByOrder,
    createSection,
    buildSections,
    buildLayout,

    getSectionByType,

    shouldShowSlotType,
    getSlotDisplayName,
    getSlotStatus,

    buildSlotViewModel,
    buildViewModel
  };
})();
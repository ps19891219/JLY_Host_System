console.log(
  "picker-data.js 已成功載入！"
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

  function normalizeText(value) {
    return String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function getMemberName(member) {
    const safeMember =
      member || {};

    return String(
      safeMember.displayName ||
        safeMember.nickname ||
        safeMember.playerName ||
        safeMember.lineDisplayName ||
        safeMember.name ||
        "未命名工作人員"
    ).trim();
  }

  function getMemberSearchValues(
    member
  ) {
    const safeMember =
      member || {};

    const aliases =
      Array.isArray(
        safeMember.aliases
      )
        ? safeMember.aliases
        : [];

    return [
      safeMember.displayName,
      safeMember.nickname,
      safeMember.playerName,
      safeMember.lineDisplayName,
      safeMember.name,
      safeMember.memberCode,
      safeMember.phone,
      ...aliases
    ]
      .map(function (value) {
        return String(
          value || ""
        ).trim();
      })
      .filter(Boolean);
  }

  function sortMembersByName(
    members
  ) {
    return (
      Array.isArray(members)
        ? [...members]
        : []
    ).sort(
      function (a, b) {
        return getMemberName(a)
          .localeCompare(
            getMemberName(b),
            "zh-Hant"
          );
      }
    );
  }

  function removeDeletedMembers(
    members
  ) {
    return (
      Array.isArray(members)
        ? members
        : []
    ).filter(
      function (member) {
        const status =
          String(
            member.status || ""
          )
            .trim()
            .toLowerCase();

        return (
          status !== "deleted" &&
          status !== "removed"
        );
      }
    );
  }

  async function loadAllMembers() {
    const db =
      getDatabase();

    const snapshot =
      await db
        .collection("players")
        .get();

    const members =
      snapshot.docs.map(
        function (doc) {
          return {
            id: doc.id,
            ...doc.data()
          };
        }
      );

    return sortMembersByName(
      removeDeletedMembers(
        members
      )
    );
  }

  function searchMembers(
    members,
    keyword
  ) {
    const target =
      normalizeText(keyword);

    if (!target) {
      return [];
    }

    const safeMembers =
      Array.isArray(members)
        ? members
        : [];

    return safeMembers.filter(
      function (member) {
        return getMemberSearchValues(
          member
        ).some(
          function (value) {
            return normalizeText(
              value
            ).includes(target);
          }
        );
      }
    );
  }

  function getDirectStudioMemberIds(
    car
  ) {
    const safeCar =
      car || {};

    const possibleLists = [
      safeCar.staffIds,
      safeCar.dmIds,
      safeCar.studioStaffIds,
      safeCar.studioMemberIds
    ];

    const memberIds =
      possibleLists.flatMap(
        function (list) {
          return Array.isArray(list)
            ? list
            : [];
        }
      );

    return [
      ...new Set(
        memberIds
          .map(String)
          .map(function (id) {
            return id.trim();
          })
          .filter(Boolean)
      )
    ];
  }

  function getStudioId(car) {
    const safeCar =
      car || {};

    return String(
      safeCar.studioId ||
        safeCar.organizerId ||
        ""
    ).trim();
  }

  async function loadStudioById(
    studioId
  ) {
    const safeStudioId =
      String(studioId || "")
        .trim();

    if (!safeStudioId) {
      return null;
    }

    const db =
      getDatabase();

    const snapshot =
      await db
        .collection("studios")
        .doc(safeStudioId)
        .get();

    if (!snapshot.exists) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  }

  function getStudioMemberIds(
    studio
  ) {
    const safeStudio =
      studio || {};

    const possibleLists = [
      safeStudio.staffIds,
      safeStudio.memberIds,
      safeStudio.dmIds,
      safeStudio.ownerIds
    ];

    const memberIds =
      possibleLists.flatMap(
        function (list) {
          return Array.isArray(list)
            ? list
            : [];
        }
      );

    return [
      ...new Set(
        memberIds
          .map(String)
          .map(function (id) {
            return id.trim();
          })
          .filter(Boolean)
      )
    ];
  }

  async function loadStudioMemberIds(
    car
  ) {
    const directIds =
      getDirectStudioMemberIds(
        car
      );

    if (directIds.length > 0) {
      return directIds;
    }

    const studioId =
      getStudioId(car);

    if (!studioId) {
      return [];
    }

    try {
      const studio =
        await loadStudioById(
          studioId
        );

      return getStudioMemberIds(
        studio
      );
    } catch (error) {
      console.warn(
        "讀取工作室人員名單失敗：",
        error
      );

      return [];
    }
  }

  function getMembersByIds(
    members,
    memberIds
  ) {
    const idSet =
      new Set(
        (
          Array.isArray(memberIds)
            ? memberIds
            : []
        )
          .map(String)
          .filter(Boolean)
      );

    return (
      Array.isArray(members)
        ? members
        : []
    ).filter(
      function (member) {
        return idSet.has(
          String(member.id)
        );
      }
    );
  }

  function findDuplicateMember(
    members,
    displayName
  ) {
    const target =
      normalizeText(
        displayName
      );

    if (!target) {
      return null;
    }

    return (
      (
        Array.isArray(members)
          ? members
          : []
      ).find(
        function (member) {
          return getMemberSearchValues(
            member
          ).some(
            function (value) {
              return (
                normalizeText(value) ===
                target
              );
            }
          );
        }
      ) ||
      null
    );
  }

  window.JLYMemberPickerData = {
    normalizeText,
    getMemberName,
    getMemberSearchValues,

    loadAllMembers,
    searchMembers,

    loadStudioById,
    loadStudioMemberIds,
    getStudioMemberIds,

    getMembersByIds,
    findDuplicateMember
  };
})();
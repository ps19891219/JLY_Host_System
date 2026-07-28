console.log(
  "picker-state.js 已成功載入！"
);

(function () {
  const state = {
    pickerRoot: null,
    currentOptions: {},
    allMembers: [],
    studioMemberIds: [],
    isLoading: false
  };

  function getPickerRoot() {
    return state.pickerRoot;
  }

  function setPickerRoot(root) {
    state.pickerRoot =
      root || null;

    return state.pickerRoot;
  }

  function getCurrentOptions() {
    return (
      state.currentOptions ||
      {}
    );
  }

  function setCurrentOptions(
    options
  ) {
    state.currentOptions =
      options &&
      typeof options === "object"
        ? { ...options }
        : {};

    return state.currentOptions;
  }

  function getCurrentCar() {
    const options =
      getCurrentOptions();

    return (
      options.car ||
      {}
    );
  }

  function getAllMembers() {
    return Array.isArray(
      state.allMembers
    )
      ? [...state.allMembers]
      : [];
  }

  function setAllMembers(
    members
  ) {
    state.allMembers =
      Array.isArray(members)
        ? [...members]
        : [];

    return getAllMembers();
  }

  function addMember(member) {
    if (
      !member ||
      !member.id
    ) {
      return null;
    }

    const memberId =
      String(member.id);

    const exists =
      state.allMembers.some(
        function (item) {
          return (
            String(item.id) ===
            memberId
          );
        }
      );

    if (exists) {
      state.allMembers =
        state.allMembers.map(
          function (item) {
            if (
              String(item.id) ===
              memberId
            ) {
              return {
                ...item,
                ...member
              };
            }

            return item;
          }
        );
    } else {
      state.allMembers.push(
        member
      );
    }

    return member;
  }

  function getMemberById(
    memberId
  ) {
    const targetId =
      String(memberId || "");

    if (!targetId) {
      return null;
    }

    return (
      state.allMembers.find(
        function (member) {
          return (
            String(member.id) ===
            targetId
          );
        }
      ) ||
      null
    );
  }

  function getStudioMemberIds() {
    return Array.isArray(
      state.studioMemberIds
    )
      ? [...state.studioMemberIds]
      : [];
  }

  function setStudioMemberIds(
    memberIds
  ) {
    const safeIds =
      Array.isArray(memberIds)
        ? memberIds
            .map(String)
            .filter(Boolean)
        : [];

    state.studioMemberIds = [
      ...new Set(safeIds)
    ];

    return getStudioMemberIds();
  }

  function getMembersByIds(
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

    return state.allMembers.filter(
      function (member) {
        return idSet.has(
          String(member.id)
        );
      }
    );
  }

  function getIsLoading() {
    return Boolean(
      state.isLoading
    );
  }

  function setIsLoading(
    isLoading
  ) {
    state.isLoading =
      Boolean(isLoading);

    return state.isLoading;
  }

  function reset() {
    state.pickerRoot = null;
    state.currentOptions = {};
    state.allMembers = [];
    state.studioMemberIds = [];
    state.isLoading = false;
  }

  window.JLYMemberPickerState = {
    getPickerRoot,
    setPickerRoot,

    getCurrentOptions,
    setCurrentOptions,
    getCurrentCar,

    getAllMembers,
    setAllMembers,
    addMember,
    getMemberById,

    getStudioMemberIds,
    setStudioMemberIds,
    getMembersByIds,

    getIsLoading,
    setIsLoading,

    reset
  };
})();
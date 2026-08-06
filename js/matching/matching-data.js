(function () {
  "use strict";

  function getDb() {
    const db =
      window.db;

    if (!db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    return db;
  }

  function nowTime() {
    return new Date()
      .toISOString();
  }

  async function getCar(carId) {
    if (!carId) {
      throw new Error(
        "找不到車團 ID"
      );
    }

    const snapshot =
      await getDb()
        .collection("cars")
        .doc(carId)
        .get();

    if (!snapshot.exists) {
      throw new Error(
        "找不到這台車"
      );
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  }

  async function getConflictCars() {
  const snapshot =
    await getDb()
      .collection("cars")
      .get();

  return snapshot.docs.map(
    function (doc) {
      return {
        id:
          doc.id,

        ...doc.data()
      };
    }
  );
}

  async function createMatching(
    carId
  ) {
    const car =
      await getCar(carId);

    const existingMatching =
      car.matching &&
      typeof car.matching ===
        "object"
        ? car.matching
        : null;

    if (existingMatching) {
      return existingMatching;
    }

    const now =
      nowTime();

    const matching = {
      version: 1,

      status:
        "draft",

      visibility:
        "private",

      currentRound:
        1,

      commonSlots: [
        {
          id: "morning",
          label: "上午",
          icon: "🌅",
          time: "09:00",
          enabled: true,
          isCustom: false
        },
        {
          id: "afternoon",
          label: "下午",
          icon: "🌞",
          time: "14:00",
          enabled: true,
          isCustom: false
        },
        {
          id: "evening",
          label: "晚上",
          icon: "🌙",
          time: "19:00",
          enabled: true,
          isCustom: false
        }
      ],

      selectedDates: [],

      candidateSlots: [],

      responses: {},

      selectedSlotId:
        "",

      createdAt:
        now,

      updatedAt:
        now
    };

    await getDb()
      .collection("cars")
      .doc(carId)
      .update({
        matching,

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()
      });

    return matching;
  }

  async function saveCommonSlots(
    carId,
    commonSlots
  ) {
    if (!carId) {
      throw new Error(
        "找不到車團 ID"
      );
    }

    if (
      !Array.isArray(
        commonSlots
      )
    ) {
      throw new Error(
        "時段資料格式不正確"
      );
    }

    const enabledSlots =
      commonSlots.filter(
        function (slot) {
          return (
            slot.enabled === true &&
            slot.time
          );
        }
      );

    if (
      enabledSlots.length === 0
    ) {
      throw new Error(
        "至少要保留一個啟用中的時段"
      );
    }

    const normalizedSlots =
      commonSlots.map(
        function (
          slot,
          index
        ) {
          return {
            id:
              slot.id ||
              (
                "custom-" +
                Date.now() +
                "-" +
                index
              ),

            label:
              String(
                slot.label ||
                "自訂"
              ).trim(),

            icon:
              slot.icon ||
              "🕒",

            time:
              String(
                slot.time || ""
              ),

            enabled:
              slot.enabled ===
              true,

            isCustom:
              slot.isCustom ===
              true
          };
        }
      );

    const updatedAt =
      nowTime();

    await getDb()
      .collection("cars")
      .doc(carId)
      .update({
        "matching.commonSlots":
          normalizedSlots,

        "matching.updatedAt":
          updatedAt,

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()
      });

    return {
      commonSlots:
        normalizedSlots,

      updatedAt
    };
  }

  async function saveCandidateSlots(
  carId,
  selectedDates,
  candidateSlots
) {
  if (!carId) {
    throw new Error(
      "找不到車團 ID"
    );
  }

  const normalizedDates =
    Array.from(
      new Set(
        Array.isArray(
          selectedDates
        )
          ? selectedDates
          : []
      )
    ).sort();

  const normalizedSlots =
    (
      Array.isArray(
        candidateSlots
      )
        ? candidateSlots
        : []
    ).map(function (
      slot,
      index
    ) {
      return {
        id:
          slot.id ||
          (
            "candidate-" +
            Date.now() +
            "-" +
            index
          ),

        date:
          String(
            slot.date || ""
          ),

        label:
          String(
            slot.label ||
            "自訂"
          ).trim(),

        icon:
          slot.icon ||
          "🕒",

        time:
          String(
            slot.time || ""
          ),

        enabled:
          slot.enabled !==
          false,

        sourceSlotId:
          slot.sourceSlotId ||
          "",

        conflictNotes:
          Array.isArray(
            slot.conflictNotes
          )
            ? slot.conflictNotes
            : []
      };
    });

  const updatedAt =
    nowTime();

  await getDb()
    .collection("cars")
    .doc(carId)
    .update({
      "matching.selectedDates":
        normalizedDates,

      "matching.candidateSlots":
        normalizedSlots,

      "matching.updatedAt":
        updatedAt,

      updatedAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp()
    });

  return {
    selectedDates:
      normalizedDates,

    candidateSlots:
      normalizedSlots,

    updatedAt
  };
}

  async function publishMatching(
    carId
  ) {
    if (!carId) {
      throw new Error(
        "找不到車團 ID"
      );
    }

    const publishedAt =
      nowTime();

    await getDb()
      .collection("cars")
      .doc(carId)
      .update({
        "matching.status":
          "published",

        "matching.visibility":
          "link",

        "matching.matchingType":
          "host",

        "matching.currentStep":
          4,

        "matching.publishedAt":
          publishedAt,

        "matching.updatedAt":
          publishedAt,

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()
      });

    return {
      status:
        "published",

      visibility:
        "link",

      matchingType:
        "host",

      currentStep:
        4,

      publishedAt,

      updatedAt:
        publishedAt
    };
  }

    window.JLYMatchingData = {
    getCar,
    getConflictCars,
    createMatching,
    saveCommonSlots,
    saveCandidateSlots,
    publishMatching
  };

  console.log(
    "✅ Matching Data V3 已載入"
  );
})();
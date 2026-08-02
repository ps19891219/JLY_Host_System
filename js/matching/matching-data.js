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

  async function getCar(
    carId
  ) {
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
      new Date()
        .toISOString();

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
          enabled: true
        },
        {
          id: "afternoon",
          label: "下午",
          icon: "🌞",
          time: "14:00",
          enabled: true
        },
        {
          id: "evening",
          label: "晚上",
          icon: "🌙",
          time: "19:00",
          enabled: true
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

  window.JLYMatchingData = {
    getCar,
    createMatching
  };

  console.log(
    "✅ Matching Data V1 已載入"
  );
})();
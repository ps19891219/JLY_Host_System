console.log(
  "recruit-data.js 已成功載入！"
);

(function () {
  "use strict";

  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase 尚未初始化"
      );
    }

    return window.db;
  }

  function normalizeText(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function uniqueIds(values) {
    return Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .map(normalizeText)
          .filter(function (value) {
            return value &&
              !value.toLowerCase().startsWith("line:");
          })
      )
    );
  }

  function getProfileIdentityIds(profile) {
    const source =
      profile && typeof profile === "object"
        ? profile
        : {};

    return uniqueIds([
      source.id,
      source.playerId,
      source.profileId,
      source.personId,
      source.identityId,
      source.memberId,
      source.canonicalPersonId,
      source.canonicalProfileId,
      source.canonicalMemberId,
      source.mergedIntoPersonId,
      source.mergedIntoProfileId,
      source.mergedIntoMemberId,
      ...(Array.isArray(source.linkedPlayerIds)
        ? source.linkedPlayerIds
        : [])
    ]);
  }

  function getShareToken() {
    return normalizeText(
      new URLSearchParams(
        location.search
      ).get("t")
    );
  }

  async function getRecruitPageByToken(
    token
  ) {
    const normalizedToken =
      normalizeText(token);

    if (!normalizedToken) {
      return null;
    }

    const snapshot =
      await getDb()
        .collection(
          "recruitPages"
        )
        .doc(normalizedToken)
        .get();

    if (!snapshot.exists) {
      return null;
    }

    return {
      token:
        snapshot.id,

      ...snapshot.data()
    };
  }

  async function resolveOwnerIdentityIds(
    ownerId
  ) {
    const normalizedOwnerId =
      normalizeText(ownerId);

    if (!normalizedOwnerId) {
      return [];
    }

    const db = getDb();
    const ids = new Set();
    const queue = [];
    const checked = new Set();
    const reverseFields = [
      "identityId",
      "personId",
      "profileId",
      "playerId",
      "memberId",
      "canonicalPersonId",
      "canonicalProfileId",
      "canonicalMemberId",
      "mergedIntoPersonId",
      "mergedIntoProfileId",
      "mergedIntoMemberId"
    ];

    function remember(value) {
      const normalized = normalizeText(value);
      if (
        !normalized ||
        normalized.toLowerCase().startsWith("line:") ||
        ids.has(normalized)
      ) {
        return;
      }
      ids.add(normalized);
      queue.push(normalized);
    }

    function rememberProfile(snapshot) {
      if (!snapshot || !snapshot.exists) {
        return;
      }
      const profile = {
        id: snapshot.id,
        ...(snapshot.data() || {})
      };
      getProfileIdentityIds(profile).forEach(remember);
    }

    remember(normalizedOwnerId);

    /*
      舊 recruit token、舊 cars.ownerId 與現在 canonical identity
      可能落在不同世代。這裡沿用既有 MyCar 歷史 identity 欄位，
      只對已知 ID 做 alias/direct/reverse bounded lookup，不掃描 cars。
    */
    while (queue.length && checked.size < 80) {
      const id = queue.shift();
      if (!id || checked.has(id)) {
        continue;
      }
      checked.add(id);

      try {
        const aliasSnapshot = await db
          .collection("myCarViewAliases")
          .doc(id)
          .get();
        if (aliasSnapshot.exists) {
          remember((aliasSnapshot.data() || {}).viewerId);
        }
      } catch (error) {
        console.warn(
          "Recruit owner alias lookup skipped:",
          id,
          error
        );
      }

      try {
        rememberProfile(
          await db
            .collection("players")
            .doc(id)
            .get()
        );
      } catch (error) {
        console.warn(
          "Recruit owner direct profile lookup skipped:",
          id,
          error
        );
      }

      for (const field of reverseFields) {
        try {
          const snapshot = await db
            .collection("players")
            .where(field, "==", id)
            .limit(10)
            .get();
          snapshot.docs.forEach(rememberProfile);
        } catch (error) {
          console.warn(
            "Recruit owner reverse profile lookup skipped:",
            field,
            id,
            error
          );
        }
      }

      try {
        const linkedSnapshot = await db
          .collection("players")
          .where("linkedPlayerIds", "array-contains", id)
          .limit(10)
          .get();
        linkedSnapshot.docs.forEach(rememberProfile);
      } catch (error) {
        console.warn(
          "Recruit owner linkedPlayerIds lookup skipped:",
          id,
          error
        );
      }
    }

    return uniqueIds(Array.from(ids));
  }

  async function getRecruitCarsByOwner(
    ownerId
  ) {
    if (
      !window.JLYCarData ||
      typeof window.JLYCarData.getCarsByOwner !==
        "function"
    ) {
      throw new Error(
        "Car Data 模組尚未載入"
      );
    }

    const ownerIdentityIds =
      await resolveOwnerIdentityIds(ownerId);

    if (ownerIdentityIds.length === 0) {
      return [];
    }

    const groups =
      await Promise.all(
        ownerIdentityIds.map(function (identityId) {
          return window.JLYCarData
            .getCarsByOwner(identityId);
        })
      );

    const carsById = new Map();

    groups.forEach(function (cars) {
      (Array.isArray(cars) ? cars : [])
        .forEach(function (car) {
          if (car && car.id) {
            carsById.set(car.id, car);
          }
        });
    });

    return Array.from(carsById.values());
  }

  window.JLYRecruitData = {
    getShareToken,
    getRecruitPageByToken,
    resolveOwnerIdentityIds,
    getRecruitCarsByOwner
  };
})();

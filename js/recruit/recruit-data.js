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
    const ids = new Set([normalizedOwnerId]);

    /*
      recruitPages 可能保存歷史 Identity。
      myCarViewAliases 是既有 alias -> canonical viewerId 對照，
      因此只做單筆 bounded read，不掃描 cars。
    */
    try {
      const aliasSnapshot =
        await db
          .collection("myCarViewAliases")
          .doc(normalizedOwnerId)
          .get();

      if (aliasSnapshot.exists) {
        const alias = aliasSnapshot.data() || {};
        const viewerId = normalizeText(alias.viewerId);
        if (viewerId) {
          ids.add(viewerId);
        }
      }
    } catch (error) {
      console.warn(
        "Recruit owner alias lookup skipped:",
        error
      );
    }

    /*
      canonical player/profile 若可讀，補上既有正式歷史 aliases。
      只讀目前已知 ID 對應的文件，不做 collection scan。
    */
    const knownIds = Array.from(ids);

    for (const id of knownIds) {
      try {
        const profileSnapshot =
          await db
            .collection("players")
            .doc(id)
            .get();

        if (!profileSnapshot.exists) {
          continue;
        }

        const profile = {
          id: profileSnapshot.id,
          ...(profileSnapshot.data() || {})
        };

        getProfileIdentityIds(profile)
          .forEach(function (identityId) {
            ids.add(identityId);
          });
      } catch (error) {
        console.warn(
          "Recruit owner profile alias lookup skipped:",
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
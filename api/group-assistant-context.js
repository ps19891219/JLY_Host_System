"use strict";

const {
  verifyGroupAssistantToken
} = require("../services/line/group-assistant-link");

const {
  getBindingByGroupId
} = require("../services/firebase/line-group-binding-repository");

const {
  getCarById
} = require("../services/firebase/line-accounting-authorization-repository");

const {
  readCookie,
  verifyMemberSession
} = require("../services/line/member-session");

const {
  getFirestore
} = require("../services/firebase/admin");

const {
  buildActivityAccountingSummary
} = require("../services/accounting/activity-accounting-summary");

const {
  collectMembers
} = require("../services/line/quick-accounting-service");


function normalizeText(value) {
  return String(value || "").trim();
}


function members(car) {
  return collectMembers(car).map(item => ({
    memberId: item.personId,
    displayName: item.displayName || "成員",
    role: item.role
  }));
}


function send(res, status, data) {
  res.statusCode = status;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.end(
    JSON.stringify(data)
  );
}


async function resolveCurrentMember(
  session,
  carMembers
) {
  if (
    !session ||
    !session.valid ||
    !session.data
  ) {
    return null;
  }

  const data = session.data;

  const candidateIds = new Set(
    [
      data.profileId,
      data.identityId
    ]
      .map(normalizeText)
      .filter(Boolean)
  );

  const profileId =
    normalizeText(
      data.profileId
    );

  if (profileId) {
    try {
      const profileSnapshot =
        await getFirestore()
          .collection("players")
          .doc(profileId)
          .get();

      if (profileSnapshot.exists) {
        const profile =
          profileSnapshot.data() || {};

        [
          profileSnapshot.id,
          profile.identityId,
          profile.playerId,
          profile.personId
        ]
          .map(normalizeText)
          .filter(Boolean)
          .forEach(id =>
            candidateIds.add(id)
          );

        const linkedPlayerIds =
          Array.isArray(
            profile.linkedPlayerIds
          )
            ? profile.linkedPlayerIds
            : [];

        linkedPlayerIds
          .map(normalizeText)
          .filter(Boolean)
          .forEach(id =>
            candidateIds.add(id)
          );
      }
    } catch (error) {
      console.error(
        "讀取目前使用者 Player Profile 失敗",
        error
      );
    }
  }

  const matchedMember =
    (carMembers || []).find(member =>
      candidateIds.has(
        normalizeText(
          member.memberId
        )
      )
    );

  return {
    profileId:
      normalizeText(
        data.profileId
      ),

    identityId:
      normalizeText(
        data.identityId
      ),

    memberId:
      matchedMember
        ? normalizeText(
            matchedMember.memberId
          )
        : "",

    displayName:
      matchedMember &&
      matchedMember.displayName
        ? matchedMember.displayName
        : normalizeText(
            data.displayName
          )
  };
}


async function totalSummary(carId) {
  const db = getFirestore();
  const root = db.collection("cars").doc(carId);
  const viewRef = root.collection("accountingViews").doc("activityCurrent");

  // Canonical read: the web/player view is derived directly from the same
  // accountingEntries + accountingSettlements used by Accounting Core.
  // activityCurrent remains only a rebuildable summary cache.
  const [entries, settlements] = await Promise.all([
    root.collection("accountingEntries").get(),
    root.collection("accountingSettlements").get()
  ]);

  const transactions = entries.docs
    .map(doc => ({ transactionId: doc.id, ...doc.data() }))
    .filter(item => item && item.status !== "deleted");

  const settlementRecords = settlements.docs
    .map(doc => ({ settlementId: doc.id, ...doc.data() }));

  const summary = buildActivityAccountingSummary(
    transactions,
    settlementRecords
  );

  const latestEntryVersion = transactions.reduce(
    (latest, item) => String(item.updatedAt || "") > latest
      ? String(item.updatedAt || "")
      : latest,
    ""
  );

  const latestSettlementVersion = settlementRecords.reduce(
    (latest, item) => String(item.updatedAt || "") > latest
      ? String(item.updatedAt || "")
      : latest,
    ""
  );

  const sourceVersion = `${latestEntryVersion}|${latestSettlementVersion}`;
  const recentEntries = [...transactions]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 20);

  const result = {
    ...summary,
    activeEntryCount: transactions.length,
    recentEntries,
    summarySourceVersion: sourceVersion
  };

  await viewRef.set(
    {
      ...summary,
      summarySourceVersion: sourceVersion,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  return result;
}


module.exports =
async function handler(
  req,
  res
) {
  if (
    req.method !== "GET"
  ) {
    return send(
      res,
      405,
      {
        success: false,
        error:
          "method_not_allowed"
      }
    );
  }

  try {
    const result =
      verifyGroupAssistantToken(
        req.query &&
        req.query.token
      );

    if (!result.valid) {
      return send(
        res,
        401,
        {
          success: false,
          error:
            "invalid_link"
        }
      );
    }

    const {
      groupId,
      carId
    } = result.data;

    const binding =
      await getBindingByGroupId(
        groupId
      );

    if (
      !binding ||
      binding.status !==
        "active" ||
      String(
        binding.carId
      ) !==
      String(
        carId
      )
    ) {
      return send(
        res,
        403,
        {
          success: false,
          error:
            "binding_inactive"
        }
      );
    }

    const [
      car,
      total
    ] = await Promise.all([
      getCarById(
        carId
      ),

      totalSummary(
        carId
      )
    ]);

    if (!car) {
      return send(
        res,
        404,
        {
          success: false,
          error:
            "car_not_found"
        }
      );
    }

    const carMembers =
      members(car);

    const session =
      verifyMemberSession(
        readCookie(req)
      );

    const currentMember =
      await resolveCurrentMember(
        session,
        carMembers
      );

    return send(
      res,
      200,
      {
        success: true,

        currentMember,

        car: {
          id:
            car.id,

          scriptName:
            car.scriptName ||
            car.title ||
            car.name ||
            "JLY 車團",

          date:
            car.gameDate ||
            car.date ||
            car.startDate ||
            "",

          location:
            car.location ||
            car.storeName ||
            ""
        },

        members:
          carMembers,

        accounting: {
          ...total,

          activeEntryCount:
            Number(
              total.activeEntryCount
            ) || 0,

          recentEntries:
            Array.isArray(
              total.recentEntries
            )
              ? total.recentEntries
              : []
        }
      }
    );

  } catch (error) {
    console.error(
      "讀取群組助手資料失敗",
      error
    );

    return send(
      res,
      500,
      {
        success: false,
        error:
          "assistant_context_failed"
      }
    );
  }
};
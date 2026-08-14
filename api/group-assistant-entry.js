"use strict";

const crypto = require("crypto");

const {
  verifyGroupAssistantToken
} = require("../services/line/group-assistant-link");

const {
  readCookie,
  verifyMemberSession
} = require("../services/line/member-session");

const {
  getBindingByGroupId
} = require("../services/firebase/line-group-binding-repository");

const {
  getCarById
} = require("../services/firebase/line-accounting-authorization-repository");

const {
  saveCarAccountingEntry,
  listCarAccountingEntries,
  completeCarAccountingSplit
} = require("../services/firebase/car-accounting-repository");


// ============================================================
// Helpers
// ============================================================

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


function parseBody(req) {
  if (
    req.body &&
    typeof req.body === "object"
  ) {
    return req.body;
  }

  try {
    return JSON.parse(
      req.body || "{}"
    );
  } catch (_error) {
    return {};
  }
}


function identities(session) {
  return new Set(
    [
      session.profileId,
      session.identityId
    ]
      .map(String)
      .filter(Boolean)
  );
}


// ============================================================
// Handler
// ============================================================

module.exports = async function handler(req, res) {

  if (req.method !== "POST") {
    return send(
      res,
      405,
      {
        success: false,
        error: "method_not_allowed"
      }
    );
  }


  try {

    // --------------------------------------------------------
    // Request / login / binding
    // --------------------------------------------------------

    const input =
      parseBody(req);

    const link =
      verifyGroupAssistantToken(
        input.token
      );

    const session =
      verifyMemberSession(
        readCookie(req)
      );


    if (!link.valid) {
      return send(
        res,
        401,
        {
          success: false,
          error: "invalid_link"
        }
      );
    }


    if (!session.valid) {
      return send(
        res,
        401,
        {
          success: false,
          error: "line_login_required"
        }
      );
    }


    const {
      groupId,
      carId
    } = link.data;


    const [
      binding,
      car
    ] = await Promise.all([
      getBindingByGroupId(groupId),
      getCarById(carId)
    ]);


    if (
      !binding ||
      binding.status !== "active" ||
      String(binding.carId) !==
        String(carId)
    ) {
      return send(
        res,
        403,
        {
          success: false,
          error: "binding_inactive"
        }
      );
    }


    if (!car) {
      return send(
        res,
        404,
        {
          success: false,
          error: "car_not_found"
        }
      );
    }


    // --------------------------------------------------------
    // Activity members
    // --------------------------------------------------------

    const players =
      Array.isArray(car.players)
        ? car.players
        : [];


    const memberIds =
      new Set(
        players
          .map(player =>
            String(
              player.playerId ||
              player.memberId ||
              player.id ||
              ""
            )
          )
          .filter(Boolean)
      );


    const playerMap =
      new Map(
        players.map(player => [
          String(
            player.playerId ||
            player.memberId ||
            player.id ||
            ""
          ),

          String(
            player.displayName ||
            player.playerName ||
            player.name ||
            player.nickname ||
            "成員"
          )
        ])
      );


    const actorIds =
      identities(
        session.data
      );


    const isOwner =
      actorIds.has(
        String(
          car.ownerId || ""
        )
      );


    const isCarMember =
      [...actorIds].some(
        id =>
          memberIds.has(id)
      );


    if (
      !isCarMember &&
      !isOwner
    ) {
      return send(
        res,
        403,
        {
          success: false,
          error: "car_member_required"
        }
      );
    }


    // --------------------------------------------------------
    // Entry common fields
    // --------------------------------------------------------

    const type =
      input.type === "income"
        ? "income"
        : "expense";


    const amount =
      Number(
        input.amount
      );


    const description =
      String(
        input.description || ""
      ).trim();


    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 100000000 ||
      !description
    ) {
      return send(
        res,
        400,
        {
          success: false,
          error: "invalid_entry"
        }
      );
    }


    // ========================================================
    // Shares / Splits
    // ========================================================

    const requestedShares =
      Array.isArray(input.shares)
        ? input.shares
        : [];


    const splitNow =
      input.splitMode === "now";


    const seenShareMembers =
      new Set();


    const shares =
      type === "expense" &&
      splitNow

        ? requestedShares
            .map(item => ({
              memberId:
                String(
                  (
                    item &&
                    item.memberId
                  ) ||
                  ""
                ),

              amount:
                Number(
                  item &&
                  item.amount
                )
            }))

            .filter(item => {

              if (
                !memberIds.has(
                  item.memberId
                )
              ) {
                return false;
              }


              if (
                seenShareMembers.has(
                  item.memberId
                )
              ) {
                return false;
              }


              seenShareMembers.add(
                item.memberId
              );

              return true;
            })

            .map(item => ({
              ...item,

              displayName:
                playerMap.get(
                  item.memberId
                ) ||
                "成員"
            }))

        : [];


    if (
      type === "expense" &&
      splitNow &&
      !shares.length
    ) {
      return send(
        res,
        400,
        {
          success: false,
          error: "share_members_required"
        }
      );
    }


    if (
      type === "expense" &&
      splitNow
    ) {

      const shareTotal =
        shares.reduce(
          (sum, item) =>
            sum + item.amount,
          0
        );


      const invalidShare =
        shares.some(
          item =>
            !Number.isFinite(
              item.amount
            ) ||
            item.amount <= 0
        );


      if (
        invalidShare ||
        shareTotal !== amount
      ) {
        return send(
          res,
          400,
          {
            success: false,
            error: "share_total_mismatch"
          }
        );
      }
    }


    // ========================================================
    // Completing an existing pending split
    // ========================================================

    /*
     * Important:
     *
     * Completing a split must NOT change the original
     * transaction payments.
     *
     * The repository preserves the original payments[].
     */

    if (input.entryId) {

      const entries =
        await listCarAccountingEntries(
          carId
        );


      const existing =
        entries.find(
          entry =>
            entry.id ===
            String(
              input.entryId
            )
        );


      if (
        !existing ||
        existing.splitStatus !==
          "pending"
      ) {
        return send(
          res,
          404,
          {
            success: false,
            error:
              "pending_entry_not_found"
          }
        );
      }


      const isCreator =
        actorIds.has(
          String(
            existing.actorMemberId ||
            ""
          )
        ) ||
        String(
          existing.userId ||
          ""
        ) ===
          String(
            session.data.lineUserId ||
            ""
          );


      if (
        !isCreator &&
        !isOwner
      ) {
        return send(
          res,
          403,
          {
            success: false,
            error:
              "entry_permission_denied"
          }
        );
      }


      const updated =
        await completeCarAccountingSplit({
          carId,

          entryId:
            existing.id,

          shares,

          actorUserId:
            session.data.lineUserId,

          actorMemberId:
            session.data.profileId,

          actorDisplayName:
            session.data.displayName,

          authorityReason:
            isOwner
              ? "car_owner"
              : "entry_creator"
        });


      return send(
        res,
        200,
        {
          success: true,
          entryId:
            updated.id,
          splitCompleted: true
        }
      );
    }


    // ========================================================
    // Payments
    // ========================================================

    const requestedPayments =
      Array.isArray(
        input.payments
      )
        ? input.payments
        : [];


    const fallbackPayerId =
      String(
        input.payerMemberId ||
        session.data.identityId ||
        session.data.profileId ||
        ""
      );


    const seenPaymentMembers =
      new Set();


    let payments =
      requestedPayments

        .map(item => ({
          memberId:
            String(
              (
                item &&
                (
                  item.memberId ||
                  item.personId ||
                  item.playerId
                )
              ) ||
              ""
            ),

          amount:
            Number(
              item &&
              item.amount
            )
        }))

        .filter(item => {

          if (
            !item.memberId
          ) {
            return false;
          }


          const validMember =
            memberIds.has(
              item.memberId
            ) ||
            actorIds.has(
              item.memberId
            );


          if (!validMember) {
            return false;
          }


          if (
            seenPaymentMembers.has(
              item.memberId
            )
          ) {
            return false;
          }


          seenPaymentMembers.add(
            item.memberId
          );

          return true;
        })

        .map(item => ({
          ...item,

          displayName:
            playerMap.get(
              item.memberId
            ) ||
            (
              actorIds.has(
                item.memberId
              )
                ? session.data.displayName
                : "成員"
            )
        }));


    // --------------------------------------------------------
    // Legacy / single-payer compatibility
    // --------------------------------------------------------

    if (!payments.length) {

      const validFallback =
        fallbackPayerId &&
        (
          memberIds.has(
            fallbackPayerId
          ) ||
          actorIds.has(
            fallbackPayerId
          )
        );


      if (!validFallback) {
        return send(
          res,
          400,
          {
            success: false,
            error: "invalid_payer"
          }
        );
      }


      payments = [
        {
          memberId:
            fallbackPayerId,

          displayName:
            playerMap.get(
              fallbackPayerId
            ) ||
            session.data.displayName,

          amount
        }
      ];
    }


    // --------------------------------------------------------
    // Payment total validation
    // --------------------------------------------------------

    const invalidPayment =
      payments.some(
        item =>
          !Number.isFinite(
            item.amount
          ) ||
          item.amount <= 0
      );


    const paymentTotal =
      payments.reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );


    if (
      invalidPayment ||
      paymentTotal !== amount
    ) {
      return send(
        res,
        400,
        {
          success: false,
          error:
            "payment_total_mismatch"
        }
      );
    }


    // ========================================================
    // Create new transaction
    // ========================================================

    const entryId =
      `web-${crypto.randomUUID()}`;


    /*
     * payerMemberId / payerDisplayName remain only
     * as compatibility aliases.
     *
     * payments[] is the formal actual-payment source.
     */

    const firstPayment =
      payments[0];


    const entry =
      await saveCarAccountingEntry({

        carId,

        groupId,

        entryId,

        messageId:
          entryId,

        userId:
          session.data.lineUserId,

        actorMemberId:
          session.data.profileId,

        actorDisplayName:
          session.data.displayName,

        // Legacy aliases
        payerMemberId:
          firstPayment.memberId,

        payerDisplayName:
          firstPayment.displayName,

        // Formal actual payments
        payments,

        shares,

        splitStatus:
          type === "expense" &&
          !splitNow
            ? "pending"
            : "completed",

        type,

        amount,

        description,

        source:
          "group_assistant_web"
      });


    return send(
      res,
      200,
      {
        success: true,

        entryId:
          entry.messageId,

        amount,

        type,

        description,

        payments
      }
    );


  } catch (error) {

    console.error(
      "群組助手帳目處理失敗",
      error
    );


    return send(
      res,
      500,
      {
        success: false,
        error:
          "entry_create_failed"
      }
    );
  }
};
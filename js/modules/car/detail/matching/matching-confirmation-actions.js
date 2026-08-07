/*
====================================================

JLY Host System V3

Module：
Car Detail Matching Confirmation Actions

用途：
1. 處理媒合完成後的玩家時間確認
2. 確認玩家繼續保留
3. 將無法配合的玩家移出車團
4. 同步 players、slots、history
5. 所有人處理後完成媒合確認

依賴：
- window.db
- window.getCarId
- window.renderCarDetail
- window.JLYCarDetailPlayerActions

====================================================
*/

console.log(
  "matching-confirmation-actions.js 已成功載入！"
);

(function () {
  "use strict";

  function getCarId() {
    if (
      typeof window.getCarId ===
      "function"
    ) {
      return window.getCarId();
    }

    return new URLSearchParams(
      location.search
    ).get("id");
  }

  function nowTime() {
    if (
      typeof window.nowTime ===
      "function"
    ) {
      return window.nowTime();
    }

    return new Date()
      .toISOString();
  }

  async function refreshPage() {
    if (
      typeof window.renderCarDetail ===
      "function"
    ) {
      await window.renderCarDetail();
    }
  }

  function getPlayerActions() {
    const module =
      window
        .JLYCarDetailPlayerActions;

    if (!module) {
      throw new Error(
        "Player Actions 模組尚未載入"
      );
    }

    return module;
  }

  function normalizeId(value) {
    return String(
      value || ""
    ).trim();
  }

  function getPlayerId(player) {
    const actions =
      getPlayerActions();

    if (
      typeof actions.getPlayerId ===
      "function"
    ) {
      return normalizeId(
        actions.getPlayerId(
          player
        )
      );
    }

    return normalizeId(
      player &&
      (
        player.playerId ||
        player.id
      )
    );
  }

  function getPlayerDisplayName(
    player
  ) {
    const actions =
      getPlayerActions();

    if (
      typeof actions
        .getPlayerDisplayName ===
      "function"
    ) {
      return actions
        .getPlayerDisplayName(
          player
        );
    }

    return (
      player.hostAlias ||
      player.displayName ||
      player.playerName ||
      player.name ||
      "未命名玩家"
    );
  }

  function getConfirmationPlayer(
    confirmation,
    playerId
  ) {
    const players =
      confirmation &&
      Array.isArray(
        confirmation.players
      )
        ? confirmation.players
        : [];

    return (
      players.find(
        function (player) {
          return (
            normalizeId(
              player.playerId
            ) ===
            normalizeId(
              playerId
            )
          );
        }
      ) ||
      null
    );
  }

  function findCarPlayerIndex(
    players,
    confirmationPlayer
  ) {
    const targetId =
      normalizeId(
        confirmationPlayer.playerId
      );

    const byId =
      players.findIndex(
        function (player) {
          return (
            getPlayerId(player) ===
            targetId
          );
        }
      );

    if (byId >= 0) {
      return byId;
    }

    /*
      舊資料沒有穩定 ID 時，
      暫時使用玩家名稱相容。
    */
    const targetName =
      String(
        confirmationPlayer
          .playerName ||
        ""
      ).trim();

    if (!targetName) {
      return -1;
    }

    return players.findIndex(
      function (player) {
        return (
          String(
            getPlayerDisplayName(
              player
            )
          ).trim() ===
          targetName
        );
      }
    );
  }

  function updatePendingCount(
    confirmation
  ) {
    const players =
      Array.isArray(
        confirmation.players
      )
        ? confirmation.players
        : [];

    confirmation.pendingCount =
      players.filter(
        function (player) {
          return (
            player &&
            player.resolved !== true
          );
        }
      ).length;

    confirmation.updatedAt =
      nowTime();

    /*
      即使已經全部逐一處理，
      仍維持 pending，
      等主揪按下「確認完成」。
    */
    confirmation.status =
      "pending";

    return confirmation;
  }

  function buildHistory(
    car
  ) {
    return Array.isArray(
      car.history
    )
      ? [
          ...car.history
        ]
      : [];
  }

  async function confirmMatchingPlayerKeep(
    playerId
  ) {
    const db =
      window.db;

    const carId =
      getCarId();

    if (!db) {
      alert(
        "Firebase 尚未載入"
      );

      return;
    }

    if (!carId) {
      alert(
        "找不到車團 ID"
      );

      return;
    }

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      await db.runTransaction(
        async function (
          transaction
        ) {
          const snapshot =
            await transaction.get(
              carRef
            );

          if (!snapshot.exists) {
            throw new Error(
              "找不到這台車"
            );
          }

          const car =
            snapshot.data() ||
            {};

          const confirmation =
            car.matchingConfirmation &&
            typeof car
              .matchingConfirmation ===
              "object"
              ? {
                  ...car
                    .matchingConfirmation,

                  players:
                    Array.isArray(
                      car
                        .matchingConfirmation
                        .players
                    )
                      ? car
                          .matchingConfirmation
                          .players
                          .map(
                            function (
                              player
                            ) {
                              return {
                                ...player
                              };
                            }
                          )
                      : []
                }
              : null;

          if (
            !confirmation ||
            confirmation.status !==
              "pending"
          ) {
            throw new Error(
              "目前沒有需要處理的媒合確認"
            );
          }

          const target =
            getConfirmationPlayer(
              confirmation,
              playerId
            );

          if (!target) {
            throw new Error(
              "找不到這位待確認玩家"
            );
          }

          target.resolved =
            true;

          target.resolution =
            "keep";

          target.action =
            "keep";

          target.resolvedAt =
            nowTime();

          updatePendingCount(
            confirmation
          );

          const history =
            buildHistory(car);

          history.push({
            type:
              "媒合玩家確認",

            text:
              "已確認玩家「" +
              (
                target.playerName ||
                "未命名玩家"
              ) +
              "」可以參加最終時段",

            time:
              nowTime(),

            playerId:
              target.playerId ||
              ""
          });

          transaction.update(
            carRef,
            {
              matchingConfirmation:
                confirmation,

              history,

              updatedAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp()
            }
          );
        }
      );

      await refreshPage();
    } catch (error) {
      console.error(
        "確認保留玩家失敗：",
        error
      );

      alert(
        "確認失敗：" +
        (
          error &&
          error.message
            ? error.message
            : "未知錯誤"
        )
      );
    }
  }

  async function removeMatchingPlayer(
    playerId
  ) {
    const db =
      window.db;

    const carId =
      getCarId();

    if (!db) {
      alert(
        "Firebase 尚未載入"
      );

      return;
    }

    if (!carId) {
      alert(
        "找不到車團 ID"
      );

      return;
    }

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      const preview =
        await carRef.get();

      if (!preview.exists) {
        throw new Error(
          "找不到這台車"
        );
      }

      const previewCar =
        preview.data() ||
        {};

      const previewConfirmation =
        previewCar
          .matchingConfirmation;

      const previewTarget =
        getConfirmationPlayer(
          previewConfirmation,
          playerId
        );

      if (!previewTarget) {
        throw new Error(
          "找不到這位待確認玩家"
        );
      }

      const confirmed =
        confirm(
          "確定將「" +
          (
            previewTarget.playerName ||
            "這位玩家"
          ) +
          "」移出車團嗎？\n\n" +
          "玩家會從名單移除，原本席位會恢復為空位。"
        );

      if (!confirmed) {
        return;
      }

      await db.runTransaction(
        async function (
          transaction
        ) {
          const snapshot =
            await transaction.get(
              carRef
            );

          if (!snapshot.exists) {
            throw new Error(
              "找不到這台車"
            );
          }

          const car =
            snapshot.data() ||
            {};

          const players =
            Array.isArray(
              car.players
            )
              ? [
                  ...car.players
                ]
              : [];

          const slots =
            Array.isArray(
              car.slots
            )
              ? car.slots
              : [];

          const confirmation =
            car.matchingConfirmation &&
            typeof car
              .matchingConfirmation ===
              "object"
              ? {
                  ...car
                    .matchingConfirmation,

                  players:
                    Array.isArray(
                      car
                        .matchingConfirmation
                        .players
                    )
                      ? car
                          .matchingConfirmation
                          .players
                          .map(
                            function (
                              player
                            ) {
                              return {
                                ...player
                              };
                            }
                          )
                      : []
                }
              : null;

          if (
            !confirmation ||
            confirmation.status !==
              "pending"
          ) {
            throw new Error(
              "目前沒有需要處理的媒合確認"
            );
          }

          const targetConfirmation =
            getConfirmationPlayer(
              confirmation,
              playerId
            );

          if (!targetConfirmation) {
            throw new Error(
              "找不到這位待確認玩家"
            );
          }

          const playerIndex =
            findCarPlayerIndex(
              players,
              targetConfirmation
            );

          let targetPlayer =
            null;

          let nextPlayers =
            players;

          let nextSlots =
            slots;

          const history =
            buildHistory(car);

          if (playerIndex >= 0) {
            targetPlayer =
              players[playerIndex];

            nextPlayers = [
              ...players
            ];

            nextPlayers.splice(
              playerIndex,
              1
            );

            const actions =
              getPlayerActions();

            nextSlots =
              actions
                .removePlayerFromSlots(
                  slots,
                  targetPlayer
                );

            const removeHistory =
              actions
                .createRemoveHistoryItem(
                  targetPlayer
                );

            removeHistory.text =
              removeHistory.text +
              "（媒合最終時間無法配合）";

            history.push(
              removeHistory
            );
          }

          targetConfirmation
            .resolved =
            true;

          targetConfirmation
            .resolution =
            "remove";

          targetConfirmation
            .action =
            "remove";

          targetConfirmation
            .resolvedAt =
            nowTime();

          updatePendingCount(
            confirmation
          );

          transaction.update(
            carRef,
            {
              players:
                nextPlayers,

              slots:
                nextSlots,

              matchingConfirmation:
                confirmation,

              history,

              updatedAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp()
            }
          );
        }
      );

      await refreshPage();
    } catch (error) {
      console.error(
        "媒合移除玩家失敗：",
        error
      );

      alert(
        "移除失敗：" +
        (
          error &&
          error.message
            ? error.message
            : "未知錯誤"
        )
      );
    }
  }

  async function finalizeMatchingConfirmation() {
    const db =
      window.db;

    const carId =
      getCarId();

    if (!db) {
      alert(
        "Firebase 尚未載入"
      );

      return;
    }

    if (!carId) {
      alert(
        "找不到車團 ID"
      );

      return;
    }

    const confirmed =
      confirm(
        "所有玩家都已處理完成。\n\n確定完成這次媒合確認嗎？"
      );

    if (!confirmed) {
      return;
    }

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      await db.runTransaction(
        async function (
          transaction
        ) {
          const snapshot =
            await transaction.get(
              carRef
            );

          if (!snapshot.exists) {
            throw new Error(
              "找不到這台車"
            );
          }

          const car =
            snapshot.data() ||
            {};

          const confirmation =
            car.matchingConfirmation &&
            typeof car
              .matchingConfirmation ===
              "object"
              ? {
                  ...car
                    .matchingConfirmation,

                  players:
                    Array.isArray(
                      car
                        .matchingConfirmation
                        .players
                    )
                      ? car
                          .matchingConfirmation
                          .players
                          .map(
                            function (
                              player
                            ) {
                              return {
                                ...player
                              };
                            }
                          )
                      : []
                }
              : null;

          if (!confirmation) {
            throw new Error(
              "找不到媒合確認資料"
            );
          }

          const remaining =
            confirmation.players
              .filter(
                function (player) {
                  return (
                    player &&
                    player.resolved !== true
                  );
                }
              );

          if (
            remaining.length > 0
          ) {
            throw new Error(
              "仍有 " +
              remaining.length +
              " 位玩家尚未處理"
            );
          }

          const timestamp =
            nowTime();

          confirmation.status =
            "completed";

          confirmation.pendingCount =
            0;

          confirmation.completedAt =
            timestamp;

          confirmation.updatedAt =
            timestamp;

          const history =
            buildHistory(car);

          history.push({
            type:
              "媒合確認完成",

            text:
              "最終時段的玩家確認已全部完成",

            time:
              timestamp
          });

          transaction.update(
            carRef,
            {
              matchingConfirmation:
                confirmation,

              history,

              updatedAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp()
            }
          );
        }
      );

      await refreshPage();
    } catch (error) {
      console.error(
        "完成媒合確認失敗：",
        error
      );

      alert(
        "完成失敗：" +
        (
          error &&
          error.message
            ? error.message
            : "未知錯誤"
        )
      );
    }
  }

  window
    .confirmMatchingPlayerKeep =
    confirmMatchingPlayerKeep;

  window
    .removeMatchingPlayer =
    removeMatchingPlayer;

  window
    .finalizeMatchingConfirmation =
    finalizeMatchingConfirmation;

  window
    .JLYCarDetailMatchingConfirmationActions = {
      confirmPlayerKeep:
        confirmMatchingPlayerKeep,

      removePlayer:
        removeMatchingPlayer,

      finalize:
        finalizeMatchingConfirmation
    };

  console.log(
    "✅ Matching Confirmation Actions 已載入"
  );
})();
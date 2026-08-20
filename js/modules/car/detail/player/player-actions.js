/*
====================================================

JLY Host System V3

Module：
Car Detail Player Actions

用途：
1. 將玩家移出車團
2. 清除玩家所佔席位
3. 寫入車團歷史紀錄
4. 更新 Firestore
5. 重新整理車團詳情頁

規則：
- 玩家編輯交給 Player Editor
- 玩家搜尋交給 Player Search
- 不建立玩家
- 不處理報名審核
- 不直接 Render HTML

依賴：
- window.db
- window.getCarId
- window.closePlayerEditor
- window.renderCarDetail

====================================================
*/

console.log(
  "player-actions.js 已成功載入！"
);

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 共用工具
  // ------------------------------------------------------------

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

  function closeEditor() {
    if (
      typeof window.closePlayerEditor ===
        "function"
    ) {
      window.closePlayerEditor();
    }
  }

  // ------------------------------------------------------------
  // 取得玩家顯示名稱
  // ------------------------------------------------------------

  function getPlayerDisplayName(
    player
  ) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return (
      source.hostAlias ||
      source.displayName ||
      source.playerName ||
      source.name ||
      "未命名玩家"
    );
  }

  // ------------------------------------------------------------
  // 取得穩定玩家 ID
  // ------------------------------------------------------------

  function getPlayerId(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return String(
      source.playerId ||
      source.id ||
      source.profileId ||
      source.applicationId ||
      ""
    ).trim();
  }

  // ------------------------------------------------------------
  // 取得玩家可能名稱
  // ------------------------------------------------------------

  function getPlayerNames(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return new Set(
      [
        source.hostAlias,
        source.displayName,
        source.playerName,
        source.name
      ]
        .map(function (name) {
          return String(
            name || ""
          ).trim();
        })
        .filter(Boolean)
    );
  }


  // ------------------------------------------------------------
  // Player Query Index V1
  // players[] 仍是正式資料；playerIds 僅供 Firestore 查詢使用。
  // 已取消玩家不放入索引。
  // ------------------------------------------------------------

  function buildActivePlayerIds(players) {
    const source =
      Array.isArray(players)
        ? players
        : [];

    return Array.from(
      new Set(
        source
          .filter(function (player) {
            const status =
              String(
                (player && player.status) ||
                ""
              ).trim().toLowerCase();

            return (
              status !== "已取消" &&
              status !== "取消" &&
              status !== "cancelled" &&
              status !== "canceled"
            );
          })
          .map(function (player) {
            return String(
              
              (player && (
                player.playerId ||
                player.id ||
                player.profileId
              )) ||
              ""

            ).trim();
          })
          .filter(Boolean)
      )
    );
  }

  // ------------------------------------------------------------
  // 判斷 Seat 是否屬於指定玩家
  // ------------------------------------------------------------

  function isSeatOwnedByPlayer(
    slot,
    playerId,
    playerNames
  ) {
    if (!slot) {
      return false;
    }

    const seatedPlayer =
      slot.player &&
      typeof slot.player ===
        "object"
        ? slot.player
        : {};

    const seatedPlayerId =
      String(
        slot.playerId ||
        seatedPlayer.playerId ||
        seatedPlayer.id ||
        ""
      ).trim();

    const seatedPlayerName =
      String(
        seatedPlayer.hostAlias ||
        seatedPlayer.displayName ||
        seatedPlayer.playerName ||
        seatedPlayer.name ||
        slot.hostAlias ||
        slot.displayName ||
        slot.playerName ||
        ""
      ).trim();

    const matchedById =
      Boolean(playerId) &&
      seatedPlayerId ===
        playerId;

    const matchedByName =
      !playerId &&
      Boolean(seatedPlayerName) &&
      playerNames.has(
        seatedPlayerName
      );

    return (
      matchedById ||
      matchedByName
    );
  }

  // ------------------------------------------------------------
  // 清空 Seat
  // ------------------------------------------------------------

  function clearSeat(slot) {
    return {
      ...slot,

      playerId:
        null,

      player:
        null,

      playerName:
        "",

      displayName:
        "",

      hostAlias:
        "",

      assignedPlayer:
        null,

      assignment:
        null,

      type:
        slot.originalType ||
        slot.type,

      updatedAt:
        nowTime()
    };
  }

  // ------------------------------------------------------------
  // 清除玩家所佔席位
  // ------------------------------------------------------------

  function removePlayerFromSlots(
    slots,
    player
  ) {
    const playerId =
      getPlayerId(
        player
      );

    const playerNames =
      getPlayerNames(
        player
      );

    const sourceSlots =
      Array.isArray(slots)
        ? slots
        : [];

    return sourceSlots.map(
      function (slot) {
        if (
          !isSeatOwnedByPlayer(
            slot,
            playerId,
            playerNames
          )
        ) {
          return slot;
        }

        return clearSeat(
          slot
        );
      }
    );
  }

  // ------------------------------------------------------------
  // 建立移除紀錄
  // ------------------------------------------------------------

  function createRemoveHistoryItem(
    player
  ) {
    const source =
      player || {};

    const playerDisplayName =
      getPlayerDisplayName(
        source
      );

    return {
      type:
        "主揪移除玩家",

      text:
        `主揪將玩家「${playerDisplayName}」移出車團`,

      time:
        nowTime(),

      playerId:
        getPlayerId(
          source
        ),

      playerName:
        source.playerName ||
        source.displayName ||
        playerDisplayName,

      hostAlias:
        source.hostAlias ||
        "",

      position:
        source.position ||
        "不限",

      isCrossPlay:
        Boolean(
          source.isCrossPlay
        ),

      source:
        source.source ||
        ""
    };
  }

  // ------------------------------------------------------------
  // 將玩家移出車團
  // ------------------------------------------------------------

  async function removePlayerFromCar(
    playerIndex
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

    const normalizedPlayerIndex =
      Number(
        playerIndex
      );

    if (
      !Number.isInteger(
        normalizedPlayerIndex
      ) ||
      normalizedPlayerIndex < 0
    ) {
      alert(
        "找不到要移除的玩家"
      );

      return;
    }

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      const carSnapshot =
        await carRef.get();

      if (!carSnapshot.exists) {
        alert(
          "找不到這台車"
        );

        return;
      }

      const carData =
        carSnapshot.data() ||
        {};

      const players =
        Array.isArray(
          carData.players
        )
          ? [...carData.players]
          : [];

      if (
        normalizedPlayerIndex >=
        players.length
      ) {
        alert(
          "這位玩家已不存在，請重新整理頁面"
        );

        await refreshPage();

        return;
      }

      const targetPlayer =
        players[
          normalizedPlayerIndex
        ] || {};

      const playerDisplayName =
        getPlayerDisplayName(
          targetPlayer
        );

      const confirmRemove =
        confirm(
          `確定要將「${playerDisplayName}」移出這台車嗎？\n\n` +
          "移除後會保留在車團紀錄時間軸中。"
        );

      if (!confirmRemove) {
        return;
      }

      players.splice(
        normalizedPlayerIndex,
        1
      );

      const currentSlots =
        Array.isArray(
          carData.slots
        )
          ? carData.slots
          : [];

      const cleanedSlots =
        removePlayerFromSlots(
          currentSlots,
          targetPlayer
        );

      const history =
        Array.isArray(
          carData.history
        )
          ? [...carData.history]
          : [];

      history.push(
        createRemoveHistoryItem(
          targetPlayer
        )
      );

      const updateData = {
        players,

        playerIds:
          buildActivePlayerIds(
            players
          ),

        playerIdsIndexVersion:
          1,

        slots:
          cleanedSlots,

        history
      };

      if (
        window.firebase &&
        window.firebase.firestore &&
        window.firebase.firestore
          .FieldValue
      ) {
        updateData.updatedAt =
          window.firebase.firestore
            .FieldValue
            .serverTimestamp();
      } else {
        updateData.updatedAt =
          nowTime();
      }

      await carRef.update(
        updateData
      );

      closeEditor();

      alert(
        `已將「${playerDisplayName}」移出車團`
      );

      await refreshPage();
    } catch (error) {
      console.error(
        "removePlayerFromCar 發生錯誤：",
        error
      );

      alert(
        "移除玩家失敗，請稍後再試。\n\n" +
        (
          error &&
          error.message
            ? error.message
            : ""
        )
      );
    }
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailPlayerActions = {
    getPlayerDisplayName,

    getPlayerId,

    getPlayerNames,

    isSeatOwnedByPlayer,

    clearSeat,

    removePlayerFromSlots,

    createRemoveHistoryItem,

    removePlayerFromCar
  };

  console.log(
    "✅ Car Detail Player Actions 已載入"
  );
})();
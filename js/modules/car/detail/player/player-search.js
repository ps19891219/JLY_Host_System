/*
====================================================

JLY Host System V3

Module：
Car Detail Player Search

用途：
1. 正規化玩家名稱
2. 取得玩家資料庫顯示名稱
3. 搜尋同名玩家
4. 建立訪客玩家
5. 選擇既有玩家或建立新玩家

規則：
- 只處理 Player 資料庫
- 不修改車團 players
- 不修改 slots
- 不操作 Seat Engine
- 不 Render 車團詳情頁

依賴：
- window.db

====================================================
*/

console.log(
  "player-search.js 已成功載入！"
);

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 時間
  // ------------------------------------------------------------

  function nowTime() {
    return new Date().toISOString();
  }

  // ------------------------------------------------------------
  // 名稱正規化
  // ------------------------------------------------------------

  function normalizePlayerName(name) {
    return String(
      name == null
        ? ""
        : name
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  // ------------------------------------------------------------
  // 取得玩家資料庫名稱
  // ------------------------------------------------------------

  function getPlayerDatabaseName(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return (
      source.displayName ||
      source.nickname ||
      source.playerName ||
      source.name ||
      "未命名玩家"
    );
  }

  // ------------------------------------------------------------
  // 取得玩家所有可搜尋名稱
  // ------------------------------------------------------------

  function getSearchableNames(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    const aliases =
      Array.isArray(source.aliases)
        ? source.aliases
        : [];

    return [
      source.displayName,
      source.nickname,
      source.playerName,
      source.name,
      source.lineDisplayName,
      ...aliases
    ]
      .map(normalizePlayerName)
      .filter(Boolean);
  }

  // ------------------------------------------------------------
  // 搜尋玩家
  //
  // 現階段沿用原本完整讀取 players Collection 的方式。
  // 後續建立 normalizedName 索引後，再改為 Firestore Query。
  // ------------------------------------------------------------

  async function searchPlayersByName(name) {
    const db =
      window.db;

    if (!db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    const targetName =
      normalizePlayerName(name);

    if (!targetName) {
      return [];
    }

    const snapshot =
      await db
        .collection("players")
        .get();

    return snapshot.docs
      .map(function (doc) {
        return {
          id:
            doc.id,

          ...doc.data()
        };
      })
      .filter(function (player) {
        return getSearchableNames(
          player
        ).some(function (item) {
          return item === targetName;
        });
      });
  }

  // ------------------------------------------------------------
  // 建立訪客玩家資料
  // ------------------------------------------------------------

  function buildGuestPlayerData(
    playerName,
    playerId
  ) {
    const cleanName =
      String(
        playerName || ""
      ).trim();

    const now =
      nowTime();

    return {
      id:
        playerId || "",

      displayName:
        cleanName,

      nickname:
        cleanName,

      aliases:
        cleanName
          ? [cleanName]
          : [],

      normalizedName:
        normalizePlayerName(
          cleanName
        ),

      memberType:
        "guest",

      type:
        "guest",

      status:
        "active",

      isLineLinked:
        false,

      lineUserId:
        null,

      lineDisplayName:
        "",

      linePictureUrl:
        "",

      defaultPosition:
        "不限",

      defaultCrossPlay:
        false,

      playCount:
        0,

      source:
        "host_manual",

      createdAt:
        now,

      updatedAt:
        now
    };
  }

  // ------------------------------------------------------------
  // 建立訪客玩家
  // ------------------------------------------------------------

  async function createGuestPlayer(
    playerName
  ) {
    const db =
      window.db;

    if (!db) {
      throw new Error(
        "Firebase 尚未載入"
      );
    }

    const cleanName =
      String(
        playerName || ""
      ).trim();

    if (!cleanName) {
      throw new Error(
        "玩家名稱不可空白"
      );
    }

    const playerRef =
      db
        .collection("players")
        .doc();

    const playerData =
      buildGuestPlayerData(
        cleanName,
        playerRef.id
      );

    await playerRef.set(
      playerData,
      {
        merge: true
      }
    );

    return playerData;
  }

  // ------------------------------------------------------------
  // 建立同名玩家選擇文字
  // ------------------------------------------------------------

  function buildPlayerSelectionMessage(
    matches
  ) {
    const sourceMatches =
      Array.isArray(matches)
        ? matches
        : [];

    let message =
      "找到以下玩家：\n\n";

    sourceMatches.forEach(
      function (
        player,
        index
      ) {
        const linkedText =
          player.isLineLinked === true
            ? "已串 LINE"
            : "訪客玩家";

        const defaultPosition =
          player.defaultPosition ||
          "不限";

        const crossPlayText =
          player.defaultCrossPlay === true
            ? "／反串"
            : "";

        const playCount =
          Number(
            player.playCount || 0
          );

        message +=
          `${index + 1}. ` +
          `${getPlayerDatabaseName(
            player
          )}` +
          `／${linkedText}` +
          `／${defaultPosition}` +
          `${crossPlayText}` +
          `／已玩 ${playCount} 本\n`;
      }
    );

    message +=
      "\n請輸入玩家前面的編號。\n" +
      "輸入 0 可建立新的訪客玩家。";

    return message;
  }

  // ------------------------------------------------------------
  // 選擇既有玩家
  // ------------------------------------------------------------

  function selectPlayerFromMatches(
    matches
  ) {
    const sourceMatches =
      Array.isArray(matches)
        ? matches
        : [];

    if (sourceMatches.length === 0) {
      return {
        cancelled:
          false,

        selectedPlayer:
          null,

        createNew:
          true
      };
    }

    const selectedInput =
      prompt(
        buildPlayerSelectionMessage(
          sourceMatches
        ),
        "1"
      );

    if (selectedInput === null) {
      return {
        cancelled:
          true,

        selectedPlayer:
          null,

        createNew:
          false
      };
    }

    const selectedNumber =
      Number(
        String(selectedInput).trim()
      );

    if (
      !Number.isInteger(
        selectedNumber
      ) ||
      selectedNumber < 0 ||
      selectedNumber >
        sourceMatches.length
    ) {
      alert(
        "輸入的編號不正確"
      );

      return {
        cancelled:
          true,

        selectedPlayer:
          null,

        createNew:
          false
      };
    }

    if (selectedNumber === 0) {
      return {
        cancelled:
          false,

        selectedPlayer:
          null,

        createNew:
          true
      };
    }

    return {
      cancelled:
        false,

      selectedPlayer:
        sourceMatches[
          selectedNumber - 1
        ],

      createNew:
        false
    };
  }

  // ------------------------------------------------------------
  // 選擇或建立玩家
  // ------------------------------------------------------------

  async function selectOrCreatePlayer(
    playerName
  ) {
    const cleanName =
      String(
        playerName || ""
      ).trim();

    if (!cleanName) {
      return null;
    }

    const matches =
      await searchPlayersByName(
        cleanName
      );

    const selection =
      selectPlayerFromMatches(
        matches
      );

    if (selection.cancelled) {
      return null;
    }

    if (selection.selectedPlayer) {
      return selection.selectedPlayer;
    }

    const createNew =
      confirm(
        matches.length > 0
          ? `確定要建立另一位新的「${cleanName}」嗎？`
          : `目前沒有「${cleanName}」的資料，是否建立為訪客玩家？`
      );

    if (!createNew) {
      return null;
    }

    return createGuestPlayer(
      cleanName
    );
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailPlayerSearch = {
    normalizePlayerName,

    getPlayerDatabaseName,

    getSearchableNames,

    searchPlayersByName,

    buildGuestPlayerData,

    createGuestPlayer,

    buildPlayerSelectionMessage,

    selectPlayerFromMatches,

    selectOrCreatePlayer
  };

  console.log(
    "✅ Car Detail Player Search 已載入"
  );
})();
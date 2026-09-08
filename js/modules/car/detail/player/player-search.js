/*
====================================================
JLY Host System V3
Module：Car Detail Player Search

用途：
1. 主揪手動新增玩家時優先選擇既有 Person
2. 已綁 LINE / Identity 的 Person 沿用原身份，不重新認領
3. 同名只作候選，不作自動身份合併
4. 真正新人才能建立新的 guest Person

規則：
- 正式 Person 來源仍是既有 players collection
- 優先共用 JLYMemberPickerData 的 canonical directory
- 不修改車團 players / slots / Seat Engine
====================================================
*/

console.log("player-search.js 已成功載入！");

(function () {
  "use strict";

  function nowTime() {
    return new Date().toISOString();
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizePlayerName(name) {
    return text(name).toLowerCase().replace(/\s+/g, "");
  }

  function getPlayerDatabaseName(player) {
    const source = player && typeof player === "object" ? player : {};
    return source.displayName || source.nickname || source.playerName || source.lineDisplayName || source.name || "未命名人員";
  }

  function getSearchableNames(player) {
    const source = player && typeof player === "object" ? player : {};
    const aliases = Array.isArray(source.aliases) ? source.aliases : [];
    return [
      source.displayName,
      source.nickname,
      source.playerName,
      source.name,
      source.lineDisplayName,
      ...aliases
    ].map(normalizePlayerName).filter(Boolean);
  }

  function getPersonDataModule() {
    return window.JLYMemberPickerData || null;
  }

  async function loadCanonicalPeople() {
    const dataModule = getPersonDataModule();
    if (dataModule && typeof dataModule.loadPersonDirectory === "function") {
      return dataModule.loadPersonDirectory();
    }

    const db = window.db;
    if (!db) throw new Error("Firebase 尚未載入");

    const snapshot = await db.collection("players").get();
    const rows = snapshot.docs.map(function (doc) {
      return { id: doc.id, ...doc.data() };
    });

    if (dataModule && typeof dataModule.dedupeCanonicalMembers === "function") {
      return dataModule.dedupeCanonicalMembers(rows);
    }

    return rows;
  }

  async function searchPlayersByName(name) {
    const targetName = normalizePlayerName(name);
    if (!targetName) return [];

    const people = await loadCanonicalPeople();
    return people.filter(function (person) {
      return getSearchableNames(person).some(function (item) {
        return item === targetName;
      });
    });
  }

  function buildGuestPlayerData(playerName, playerId) {
    const cleanName = text(playerName);
    const now = nowTime();
    return {
      id: playerId || "",
      displayName: cleanName,
      nickname: cleanName,
      aliases: cleanName ? [cleanName] : [],
      normalizedName: normalizePlayerName(cleanName),
      memberType: "guest",
      type: "guest",
      status: "active",
      isLineLinked: false,
      lineUserId: null,
      lineDisplayName: "",
      linePictureUrl: "",
      defaultPosition: "不限",
      defaultCrossPlay: false,
      playCount: 0,
      source: "host_manual",
      createdAt: now,
      updatedAt: now
    };
  }

  async function createGuestPlayer(playerName) {
    const db = window.db;
    if (!db) throw new Error("Firebase 尚未載入");

    const cleanName = text(playerName);
    if (!cleanName) throw new Error("玩家名稱不可空白");

    const sameNamePeople = await searchPlayersByName(cleanName);
    if (sameNamePeople.length > 0) {
      const error = new Error("找到同名 Person，必須先明確選擇既有人員或確認建立另一位真人。");
      error.code = "same_name_person_requires_resolution";
      error.sameNameCandidates = sameNamePeople;
      throw error;
    }

    const playerRef = db.collection("players").doc();
    const playerData = buildGuestPlayerData(cleanName, playerRef.id);
    await playerRef.set(playerData, { merge: true });
    return playerData;
  }

  function getIdentityLabel(player) {
    const dataModule = getPersonDataModule();
    if (dataModule && typeof dataModule.getIdentityLabel === "function") {
      return dataModule.getIdentityLabel(player);
    }
    return player && (player.isLineLinked === true || text(player.lineUserId))
      ? "已連結 LINE"
      : "尚未連結";
  }

  function buildPlayerSelectionMessage(matches) {
    const sourceMatches = Array.isArray(matches) ? matches : [];
    let message = "找到以下既有人員：\n\n";

    sourceMatches.forEach(function (player, index) {
      const defaultPosition = player.defaultPosition || "不限";
      const crossPlayText = player.defaultCrossPlay === true ? "／反串" : "";
      const playCount = Number(player.playCount || 0);
      message += `${index + 1}. ${getPlayerDatabaseName(player)}／${getIdentityLabel(player)}／${defaultPosition}${crossPlayText}／歷史 ${playCount} 場\n`;
    });

    message += "\n請輸入人員前面的編號。\n輸入 0 代表這是另一位不同的真人，準備建立新人。";
    return message;
  }

  function selectPlayerFromMatches(matches) {
    const sourceMatches = Array.isArray(matches) ? matches : [];
    if (sourceMatches.length === 0) {
      return { cancelled: false, selectedPlayer: null, createNew: true };
    }

    const selectedInput = prompt(buildPlayerSelectionMessage(sourceMatches), "1");
    if (selectedInput === null) {
      return { cancelled: true, selectedPlayer: null, createNew: false };
    }

    const selectedNumber = Number(String(selectedInput).trim());
    if (!Number.isInteger(selectedNumber) || selectedNumber < 0 || selectedNumber > sourceMatches.length) {
      alert("輸入的編號不正確");
      return { cancelled: true, selectedPlayer: null, createNew: false };
    }

    if (selectedNumber === 0) {
      return { cancelled: false, selectedPlayer: null, createNew: true };
    }

    return {
      cancelled: false,
      selectedPlayer: sourceMatches[selectedNumber - 1],
      createNew: false
    };
  }

  async function selectOrCreatePlayer(playerName) {
    const cleanName = text(playerName);
    if (!cleanName) return null;

    const matches = await searchPlayersByName(cleanName);
    const selection = selectPlayerFromMatches(matches);
    if (selection.cancelled) return null;
    if (selection.selectedPlayer) return selection.selectedPlayer;

    const createNew = confirm(
      matches.length > 0
        ? `確定「${cleanName}」是另一位不同的真人，要建立新的 Person 嗎？\n\n如果是上方已存在的人，請取消並選擇既有人員。`
        : `目前沒有人員「${cleanName}」，是否建立為新的 Person？`
    );
    if (!createNew) return null;

    if (matches.length > 0) {
      const db = window.db;
      if (!db) throw new Error("Firebase 尚未載入");
      const playerRef = db.collection("players").doc();
      const playerData = buildGuestPlayerData(cleanName, playerRef.id);
      playerData.sameNameOverride = true;
      playerData.sameNameReferenceIds = matches.map(function (person) {
        return text(person.id);
      }).filter(Boolean);
      playerData.source = "host_manual_same_name_override";
      await playerRef.set(playerData, { merge: true });
      return playerData;
    }

    return createGuestPlayer(cleanName);
  }

  window.JLYCarDetailPlayerSearch = {
    normalizePlayerName,
    getPlayerDatabaseName,
    getSearchableNames,
    loadCanonicalPeople,
    searchPlayersByName,
    buildGuestPlayerData,
    createGuestPlayer,
    getIdentityLabel,
    buildPlayerSelectionMessage,
    selectPlayerFromMatches,
    selectOrCreatePlayer
  };

  console.log("✅ Car Detail Player Search 已載入");
})();
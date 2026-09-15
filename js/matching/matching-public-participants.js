(function () {
  "use strict";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizedName(value) {
    return text(value).toLowerCase().replace(/\s+/g, "");
  }

  function responseName(response) {
    return text(
      response && (
        response.participantName ||
        response.displayName ||
        response.name ||
        response.playerName ||
        response.dmName
      )
    );
  }

  function augmentPublicMatchingParticipants(car) {
    if (!car || typeof car !== "object") return car;

    const matching = car.matching && typeof car.matching === "object" ? car.matching : null;
    const responseMap = matching && matching.responses && typeof matching.responses === "object"
      ? matching.responses
      : {};

    const players = Array.isArray(car.players) ? car.players.slice() : [];
    const existingIds = new Set();
    const existingNames = new Set();

    players.forEach(function (player) {
      if (!player) return;
      [player.playerId, player.id, player.personId, player.identityId, player.lineUserId]
        .map(text)
        .filter(Boolean)
        .forEach(function (id) { existingIds.add(id); });
      const name = normalizedName(
        player.hostAlias || player.displayName || player.playerName || player.name
      );
      if (name) existingNames.add(name);
    });

    Object.values(responseMap).forEach(function (response) {
      if (!response || response.status === "deleted") return;
      if (response.source !== "public_matching_line" && response.participantType !== "line_user") return;

      const participantKey = text(response.participantKey);
      const participantId = text(response.participantId);
      const lineUserId = text(response.lineUserId);
      const name = responseName(response) || "LINE 使用者";
      const nameKey = normalizedName(name);

      const identityMatches = [participantKey, participantId, lineUserId]
        .filter(Boolean)
        .some(function (id) { return existingIds.has(id); });

      if (identityMatches || (nameKey && existingNames.has(nameKey))) return;

      const matrixKey = participantKey || (lineUserId ? "line:" + lineUserId : participantId);
      if (!matrixKey) return;

      players.push({
        id: matrixKey,
        playerId: matrixKey,
        playerName: name,
        displayName: name,
        position: "媒合參與者",
        status: "matching_only",
        source: "public_matching_line",
        matchingOnly: true,
        lineUserId: lineUserId || undefined,
        identityId: participantId || undefined
      });

      existingIds.add(matrixKey);
      if (participantId) existingIds.add(participantId);
      if (lineUserId) existingIds.add(lineUserId);
      if (nameKey) existingNames.add(nameKey);
    });

    car.players = players;
    return car;
  }

  window.JLYMatchingPublicParticipants = {
    augment: augmentPublicMatchingParticipants
  };

  let currentValue = window.currentMatchingCar || null;
  Object.defineProperty(window, "currentMatchingCar", {
    configurable: true,
    enumerable: true,
    get: function () { return currentValue; },
    set: function (value) { currentValue = augmentPublicMatchingParticipants(value); }
  });

  if (currentValue) currentValue = augmentPublicMatchingParticipants(currentValue);
})();

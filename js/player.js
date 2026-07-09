console.log("player.js 已成功載入！");

// Player Module v1.0
// 負責：玩家建立、搜尋、手動加入車團

function createTempPlayerId() {
  return "temp_" + Date.now();
}

function nowTime() {
  return new Date().toISOString();
}

async function findPlayerByName(name) {
  const db = window.db;
  const snapshot = await db
    .collection("players")
    .where("nickname", "==", name)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  };
}

async function createManualPlayer(name) {
  const db = window.db;
  const now = nowTime();

  const player = {
    nickname: name,
    lineDisplayName: "",
    lineUserId: null,
    isLineLinked: false,
    createdByHost: true,
    createdAt: now,
    updatedAt: now
  };

  const ref = await db.collection("players").add(player);

  return {
    id: ref.id,
    ...player
  };
}

async function getOrCreateManualPlayer(name) {
  const existingPlayer = await findPlayerByName(name);

  if (existingPlayer) {
    return existingPlayer;
  }

  return await createManualPlayer(name);
}

async function addManualPlayerToCar(carId) {
  const db = window.db;

  const name = prompt("請輸入玩家名稱：");
  if (!name || !name.trim()) return;

  const roleChoice = prompt("請輸入位置：男位 / 女位 / 不限", "不限") || "不限";
  const isCrossPlay = confirm("這位玩家是否反串？");

  try {
    const player = await getOrCreateManualPlayer(name.trim());

    const carRef = db.collection("cars").doc(carId);
    const carDoc = await carRef.get();

    if (!carDoc.exists) {
      alert("找不到這台車");
      return;
    }

    const car = carDoc.data();
    const players = car.players || [];

    players.push({
      playerId: player.id,
      name: player.nickname,
      roleChoice,
      isCrossPlay,
      source: "manual",
      status: "已加入",
      joinedAt: nowTime()
    });

    await carRef.update({
      players,
      updatedAt: nowTime()
    });

    alert("已加入玩家！");
    location.reload();

  } catch (error) {
    console.error("手動加入玩家失敗：", error);
    alert("加入失敗：" + error.message);
  }
}

window.addManualPlayerToCar = addManualPlayerToCar;
console.log("players.js 已成功載入！");

function nowTime() {
  return new Date().toISOString();
}

function getPlayerListBox() {
  return document.getElementById("playerList");
}

async function createGuestPlayer() {
  const db = window.db;
  const name = document.getElementById("newPlayerName").value.trim();
  const note = document.getElementById("newPlayerNote").value.trim();

  if (!db) return alert("Firebase 尚未載入");
  if (!name) return alert("請輸入玩家暱稱");

  const player = {
    displayName: name,
    nickname: name,
    note,
    source: "manual",
    type: "guest",
    isLineLinked: false,
    lineUserId: null,
    lineDisplayName: "",
    linePictureUrl: "",
    playCount: 0,
    createdAt: nowTime(),
    updatedAt: nowTime()
  };

  await db.collection("players").add(player);

  document.getElementById("newPlayerName").value = "";
  document.getElementById("newPlayerNote").value = "";

  alert("已新增訪客玩家");
  renderPlayers();
}

async function deletePlayer(playerId, name) {
  if (!confirm("確定要刪除「" + name + "」嗎？")) return;

  await window.db.collection("players").doc(playerId).delete();
  alert("已刪除玩家");
  renderPlayers();
}

async function editPlayer(playerId) {
  const db = window.db;
  const doc = await db.collection("players").doc(playerId).get();

  if (!doc.exists) return alert("找不到玩家");

  const player = doc.data();

  const newName = prompt("玩家暱稱", player.nickname || player.displayName || "");
  if (!newName || !newName.trim()) return;

  const newNote = prompt("備註", player.note || "") || "";

  await db.collection("players").doc(playerId).update({
    displayName: newName.trim(),
    nickname: newName.trim(),
    note: newNote.trim(),
    updatedAt: nowTime()
  });

  alert("已更新玩家");
  renderPlayers();
}

function buildPlayerCard(player) {
  const linkedText = player.isLineLinked ? "🟢 已串 LINE" : "🟡 訪客玩家";

  return `
    <div class="card">
      <h3>👤 ${player.nickname || player.displayName || "未命名玩家"}</h3>
      <p>${linkedText}</p>
      <p>📝 ${player.note || "無備註"}</p>
      <p>📚 已玩：${player.playCount || 0} 本</p>

      <button type="button" onclick="editPlayer('${player.id}')">✏️ 編輯</button>
      <button class="gray" type="button" onclick="deletePlayer('${player.id}', '${player.nickname || player.displayName || "玩家"}')">
        🗑️ 刪除
      </button>
    </div>
  `;
}

async function renderPlayers() {
  const db = window.db;
  const box = getPlayerListBox();
  const input = document.getElementById("playerSearchInput");

  if (!box) return;
  if (!db) {
    box.innerHTML = `<div class="card"><h3>Firebase 尚未載入</h3></div>`;
    return;
  }

  box.innerHTML = `<div class="card">載入中...</div>`;

  const keyword = (input && input.value ? input.value : "").trim().toLowerCase();

  try {
    const snapshot = await db.collection("players").orderBy("createdAt", "desc").get();

    let players = snapshot.docs.map(function (doc) {
      return {
        id: doc.id,
        ...doc.data()
      };
    });

    if (keyword) {
      players = players.filter(function (player) {
        const text = [
          player.nickname || "",
          player.displayName || "",
          player.lineDisplayName || "",
          player.note || "",
          player.type || "",
          player.source || ""
        ].join(" ").toLowerCase();

        return text.includes(keyword);
      });
    }

    if (players.length === 0) {
      box.innerHTML = `<div class="card"><h3>目前沒有玩家資料</h3></div>`;
      return;
    }

    box.innerHTML = players.map(buildPlayerCard).join("");

  } catch (error) {
    console.error("讀取玩家失敗：", error);
    box.innerHTML = `<div class="card"><h3>讀取失敗</h3><p>${error.message}</p></div>`;
  }
}

window.createGuestPlayer = createGuestPlayer;
window.editPlayer = editPlayer;
window.deletePlayer = deletePlayer;

document.addEventListener("DOMContentLoaded", function () {
  renderPlayers();

  const input = document.getElementById("playerSearchInput");
  if (input) {
    input.addEventListener("input", renderPlayers);
  }
});
// ==============================
// 玩家資料中心
// ==============================

function getPlayerDatabase() {
    return getPlayers();
}

function savePlayerDatabase(players) {
    savePlayers(players);
}

function findPlayer(name) {
    return getPlayerDatabase().find(p => p.name === name);
}

function addPlayerToDatabase(player) {

    let players = getPlayerDatabase();

    let exist = players.find(p => p.name === player.name);

    if (exist) {

        exist.totalGames++;

        savePlayerDatabase(players);

        return;

    }

    players.push({

        id: createId(),

        name: player.name,

        lineId: "",

        phone: "",

        gender: player.position,

        totalGames: 1,

        cancelCount: 0,

        noShowCount: 0,

        note: ""

    });

    savePlayerDatabase(players);

}
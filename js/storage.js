// ===============================
// JLY Host Assistant
// storage.js
// 專門負責 LocalStorage 資料存取
// ===============================

const STORAGE_KEYS = {
    cars: "jly_cars",
    players: "jly_players",
    scripts: "jly_scripts",
    studios: "jly_studios",
    dms: "jly_dms"
};

function getData(key) {
    return JSON.parse(localStorage.getItem(key)) || [];
}

function setData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function createId() {
    return Date.now().toString();
}

// 車輛資料
function getCars() {
    return getData(STORAGE_KEYS.cars);
}

function saveCars(cars) {
    setData(STORAGE_KEYS.cars, cars);
}

// 玩家資料
function getPlayers() {
    return getData(STORAGE_KEYS.players);
}

function savePlayers(players) {
    setData(STORAGE_KEYS.players, players);
}

// 劇本歷史資料
function getScripts() {
    return getData(STORAGE_KEYS.scripts);
}

function saveScripts(scripts) {
    setData(STORAGE_KEYS.scripts, scripts);
}

// 工作室歷史資料
function getStudios() {
    return getData(STORAGE_KEYS.studios);
}

function saveStudios(studios) {
    setData(STORAGE_KEYS.studios, studios);
}

// DM 歷史資料
function getDms() {
    return getData(STORAGE_KEYS.dms);
}

function saveDms(dms) {
    setData(STORAGE_KEYS.dms, dms);
}
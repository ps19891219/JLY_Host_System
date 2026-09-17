console.log("recruit-public-data.js loaded");

(function () {
  "use strict";

  var viewCache = {};
  var aliasCache = {};
  var carCache = {};

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function unique(values) {
    var seen = {};
    return (Array.isArray(values) ? values : []).map(text).filter(function (value) {
      if (!value || value.toLowerCase().indexOf("line:") === 0 || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function db() {
    if (!window.db) throw new Error("Firebase 尚未初始化");
    return window.db;
  }

  function getShareToken() {
    return text(new URLSearchParams(window.location.search).get("t"));
  }

  async function getRecruitPageByToken(token) {
    var id = text(token);
    if (!id) return null;
    var snapshot = await db().collection("recruitPages").doc(id).get();
    if (!snapshot.exists) return null;
    return Object.assign({ token: snapshot.id }, snapshot.data() || {});
  }

  async function resolveViewerId(aliasId) {
    var id = text(aliasId);
    if (!id) return "";
    if (Object.prototype.hasOwnProperty.call(aliasCache, id)) return aliasCache[id];
    var viewerId = id;
    try {
      var snapshot = await db().collection("myCarViewAliases").doc(id).get();
      if (snapshot.exists) viewerId = text((snapshot.data() || {}).viewerId) || id;
    } catch (error) {
      console.warn("Recruit public alias lookup skipped", id, error);
    }
    aliasCache[id] = viewerId;
    return viewerId;
  }

  async function readPreparedView(viewerId) {
    var id = text(viewerId);
    if (!id) return null;
    if (Object.prototype.hasOwnProperty.call(viewCache, id)) return viewCache[id];
    var view = null;
    try {
      var snapshot = await db().collection("myCarViews").doc(id).get();
      if (snapshot.exists) {
        var value = snapshot.data() || {};
        if (value.viewType === "mycar_index" && Array.isArray(value.cars)) view = value;
      }
    } catch (error) {
      console.warn("Recruit public Prepared View lookup skipped", id, error);
    }
    viewCache[id] = view;
    return view;
  }

  async function resolveOwnerIdentityIds(ownerId) {
    var owner = text(ownerId);
    if (!owner) return [];
    var viewerId = await resolveViewerId(owner);
    var view = await readPreparedView(viewerId);
    return unique([owner, viewerId].concat(view && Array.isArray(view.identityIds) ? view.identityIds : []));
  }

  async function getHostCarsFromMyCarViews(viewerIds) {
    var requested = unique(viewerIds);
    var resolved = await Promise.all(requested.map(resolveViewerId));
    var ids = unique(resolved);
    var byId = {};
    await Promise.all(ids.map(async function (viewerId) {
      var view = await readPreparedView(viewerId);
      if (!view) return;
      view.cars.forEach(function (car) {
        if (!car || car.isHost !== true) return;
        var carId = text(car.id || car.carId);
        if (!carId) return;
        byId[carId] = Object.assign({}, car, { id: carId, preparedRead: true });
      });
    }));
    return Object.keys(byId).map(function (id) { return byId[id]; });
  }

  async function getRecruitCarsByOwner(ownerId) {
    var ids = await resolveOwnerIdentityIds(ownerId);
    if (!ids.length) return [];
    return getHostCarsFromMyCarViews(ids);
  }

  async function readPreparedCar(carId) {
    var id = text(carId);
    if (!id) return null;
    if (Object.prototype.hasOwnProperty.call(carCache, id)) return carCache[id];
    var car = null;
    try {
      var snapshot = await db().collection("carDetailViews").doc(id).get();
      if (snapshot.exists) {
        var value = snapshot.data() || {};
        if (value.car && typeof value.car === "object") car = Object.assign({}, value.car, { id: id, preparedRead: true });
      }
    } catch (error) {
      console.warn("Recruit public prepared car lookup skipped", id, error);
    }
    carCache[id] = car;
    return car;
  }

  async function getPreparedCarsByIds(carIds) {
    var cars = await Promise.all(unique(carIds).map(readPreparedCar));
    return cars.filter(Boolean);
  }

  window.JLYRecruitData = {
    getShareToken: getShareToken,
    getRecruitPageByToken: getRecruitPageByToken,
    resolveViewerId: resolveViewerId,
    readPreparedView: readPreparedView,
    resolveOwnerIdentityIds: resolveOwnerIdentityIds,
    getHostCarsFromMyCarViews: getHostCarsFromMyCarViews,
    getRecruitCarsByOwner: getRecruitCarsByOwner,
    readPreparedCar: readPreparedCar,
    getPreparedCarsByIds: getPreparedCarsByIds
  };
})();

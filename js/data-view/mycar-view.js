console.log("mycar-view.js V5 已成功載入！");

(function () {
  "use strict";

  const COLLECTION = "myCarViews";
  const SCHEMA_VERSION = 4;

  function getDb() {
    if (!window.db) throw new Error("Firebase 尚未初始化");
    return window.db;
  }

  function text(value) { return String(value == null ? "" : value).trim(); }
  function isFormalId(value) { const id = text(value); return Boolean(id) && !id.toLowerCase().startsWith("line:"); }
  function addFormalId(set, value) { if (isFormalId(value)) set.add(text(value)); }

  function getPlayerIdentityIds(player) {
    const source = player && typeof player === "object" ? player : {};
    const ids = new Set();
    [source.id, source.playerId, source.profileId, source.personId, source.identityId, source.memberId,
      source.applicationId, source.canonicalPersonId, source.canonicalProfileId, source.canonicalMemberId,
      source.mergedIntoPersonId, source.mergedIntoProfileId, source.mergedIntoMemberId]
      .forEach(value => addFormalId(ids, value));
    (Array.isArray(source.linkedPlayerIds) ? source.linkedPlayerIds : []).forEach(value => addFormalId(ids, value));
    return Array.from(ids);
  }

  function getOwnerIdentityIds(car) {
    const source = car && typeof car === "object" ? car : {};
    const ids = new Set();
    [source.ownerId, source.ownerPersonId, source.ownerProfileId, source.hostId,
      source.hostPersonId, source.hostProfileId, source.createdByPersonId]
      .forEach(value => addFormalId(ids, value));
    return Array.from(ids);
  }

  function compactPlayer(player) {
    const source = player && typeof player === "object" ? player : {};
    const identityIds = getPlayerIdentityIds(source);
    return {
      playerId: text(source.playerId || source.id || source.profileId || source.personId || source.identityId || source.memberId || identityIds[0]),
      identityIds,
      position: text(source.position || source.roleChoice || source.role),
      status: text(source.status)
    };
  }

  function normalizeSeatType(value) {
    const normalized = text(value).toLowerCase();
    if (["male", "m", "男", "男位", "boy"].includes(normalized)) return "male";
    if (["female", "f", "女", "女位", "girl"].includes(normalized)) return "female";
    return "flexible";
  }

  function preserveSeatSummary(summary) {
    const source = summary && typeof summary === "object" ? summary : null;
    if (!source) return null;
    const normalized = {
      totalSeatCount: Math.max(0, Number(source.totalSeatCount || 0)),
      occupiedSeatCount: Math.max(0, Number(source.occupiedSeatCount || 0)),
      maleTotal: Math.max(0, Number(source.maleTotal || 0)),
      maleOccupied: Math.max(0, Number(source.maleOccupied || 0)),
      femaleTotal: Math.max(0, Number(source.femaleTotal || 0)),
      femaleOccupied: Math.max(0, Number(source.femaleOccupied || 0)),
      flexibleTotal: Math.max(0, Number(source.flexibleTotal || 0)),
      flexibleOccupied: Math.max(0, Number(source.flexibleOccupied || 0)),
      waitingCount: Math.max(0, Number(source.waitingCount || 0))
    };
    return normalized.totalSeatCount > 0 || normalized.maleTotal > 0 || normalized.femaleTotal > 0 || normalized.flexibleTotal > 0 ? normalized : null;
  }

  function buildSeatSummary(car) {
    const source = car && typeof car === "object" ? car : {};
    const slots = Array.isArray(source.slots) ? source.slots : [];
    if (slots.length === 0) return preserveSeatSummary(source.seatSummary);
    const activePlayerIds = new Set();
    (Array.isArray(source.players) ? source.players : []).forEach(function (player) {
      const status = text(player && player.status).toLowerCase();
      if (["已取消", "取消", "cancelled", "canceled"].includes(status)) return;
      getPlayerIdentityIds(player).forEach(value => activePlayerIds.add(value));
    });
    const summary = { totalSeatCount: 0, occupiedSeatCount: 0, maleTotal: 0, maleOccupied: 0, femaleTotal: 0, femaleOccupied: 0, flexibleTotal: 0, flexibleOccupied: 0, waitingCount: 0 };
    slots.forEach(function (slot) {
      const safeSlot = slot && typeof slot === "object" ? slot : {};
      const sectionType = normalizeSeatType(safeSlot.originalType || safeSlot.sectionType || safeSlot.slotType || safeSlot.type);
      summary.totalSeatCount += 1;
      if (sectionType === "male") summary.maleTotal += 1; else if (sectionType === "female") summary.femaleTotal += 1; else summary.flexibleTotal += 1;
      const slotIds = [safeSlot.playerId, safeSlot.personId, safeSlot.profileId, safeSlot.identityId, safeSlot.memberId].map(text).filter(Boolean);
      const isOccupied = slotIds.length > 0 && (activePlayerIds.size === 0 || slotIds.some(id => activePlayerIds.has(id)));
      if (!isOccupied) return;
      summary.occupiedSeatCount += 1;
      if (sectionType === "male") summary.maleOccupied += 1; else if (sectionType === "female") summary.femaleOccupied += 1; else summary.flexibleOccupied += 1;
    });
    summary.waitingCount = Math.max(activePlayerIds.size - summary.occupiedSeatCount, 0);
    return summary;
  }

  function compactCar(car, viewerIdentityIds) {
    const source = car && typeof car === "object" ? car : {};
    const identitySet = new Set((Array.isArray(viewerIdentityIds) ? viewerIdentityIds : []).filter(isFormalId).map(text));
    const ownerIds = getOwnerIdentityIds(source);
    const ownerId = text(source.ownerId);
    const players = (Array.isArray(source.players) ? source.players : []).map(compactPlayer);
    const hasFormalViewerIdentity = identitySet.size > 0;
    const isHost = ownerIds.some(id => identitySet.has(id)) || (!hasFormalViewerIdentity && (source.isHost === true || text(source.role) === "host" || text(source.ownerType) === "self"));
    const isPlayer = !isHost && ((!hasFormalViewerIdentity && source.isPlayer === true) || players.some(function (player) {
      if (!player || !Array.isArray(player.identityIds) || !player.identityIds.some(id => identitySet.has(id))) return false;
      return !["已取消", "取消", "cancelled", "canceled"].includes(text(player.status).toLowerCase());
    }));
    return {
      id: text(source.id || source.carId), scriptName: text(source.scriptName || source.title || source.name),
      gameDate: text(source.gameDate || source.date), gameTime: text(source.gameTime || source.time), status: text(source.status), planningStatus: text(source.planningStatus),
      studioName: text(source.studioName || source.studio), organizerName: text(source.organizerName || source.groupName), locationName: text(source.locationName),
      location: text(source.location || source.address || source.placeName), dmName: text(source.dmName), price: Number(source.price || source.amount || 0), totalPeople: Number(source.totalPeople || 0),
      maleSlots: Number(source.maleSlots || 0), femaleSlots: Number(source.femaleSlots || 0), flexibleSlots: Number(source.flexibleSlots || source.flexSlots || 0), seatSummary: buildSeatSummary(source),
      players, tags: Array.isArray(source.tags) ? source.tags : [], scriptTags: Array.isArray(source.scriptTags) ? source.scriptTags : [], ownerId,
      isHost, isPlayer, role: isHost ? "host" : (isPlayer ? "player" : ""), ownerType: isHost ? "self" : "", updatedAt: source.updatedAt || null, createdAt: source.createdAt || null
    };
  }

  function getDateTimeValue(car) {
    const date = text(car && car.gameDate) || "9999-12-31";
    const time = text(car && car.gameTime) || "23:59";
    const value = new Date(`${date}T${time}`).getTime();
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }
  function isEnded(car) { const status = text(car && car.status); if (status === "已結束" || status === "已取消") return true; if (!text(car && car.gameDate)) return false; return getDateTimeValue(car) < Date.now(); }
  function isPlanning(car) { const status = text(car && car.status); return status === "規劃中" || text(car && car.planningStatus) === "unscheduled" || !text(car && car.gameDate); }
  function sortCars(cars) { return [...(Array.isArray(cars) ? cars : [])].sort(function (a, b) { function group(car) { if (isEnded(car)) return 2; if (isPlanning(car)) return 1; return 0; } const ag=group(a), bg=group(b); if(ag!==bg)return ag-bg; if(ag===1)return new Date(b.updatedAt||b.createdAt||0).getTime()-new Date(a.updatedAt||a.createdAt||0).getTime(); return getDateTimeValue(a)-getDateTimeValue(b); }); }

  function buildView(options) {
    const settings=options||{}, viewerId=text(settings.viewerId); if(!viewerId)throw new Error("mycar_viewer_required");
    const identityIds=Array.from(new Set([viewerId,...(Array.isArray(settings.identityIds)?settings.identityIds:[])].filter(isFormalId).map(text)));
    const cars=sortCars((Array.isArray(settings.cars)?settings.cars:[]).map(car=>compactCar(car,identityIds)).filter(car=>car.id&&(car.isHost||car.isPlayer)));
    return {schemaVersion:SCHEMA_VERSION,viewType:"mycar_index",viewerId,identityIds,cars,counts:{all:cars.length,host:cars.filter(car=>car.isHost).length,player:cars.filter(car=>car.isPlayer).length},builtAt:new Date().toISOString()};
  }

  async function read(viewerId) { const id=text(viewerId); if(!id)throw new Error("mycar_viewer_required"); const snapshot=await getDb().collection(COLLECTION).doc(id).get(); return snapshot.exists?(snapshot.data()||null):null; }
  async function write(view) { const viewerId=text(view&&view.viewerId); if(!viewerId)throw new Error("mycar_viewer_required"); await getDb().collection(COLLECTION).doc(viewerId).set(view,{merge:false}); return view; }

  function selectForUi(view,options) {
    const settings=options||{},tab=text(settings.tab)||"all",roleTab=text(settings.roleTab)||"all",keyword=text(settings.keyword).toLowerCase(),pageSize=Math.max(1,Math.min(50,Number(settings.pageSize||20))),pageIndex=Math.max(0,Number(settings.pageIndex||0));
    let cars=sortCars(view&&Array.isArray(view.cars)?view.cars:[]);
    if(tab==="planning")cars=cars.filter(isPlanning);
    if(tab==="active"){cars=cars.filter(car=>!isEnded(car)&&!isPlanning(car));if(roleTab==="host")cars=cars.filter(car=>car.isHost);if(roleTab==="player")cars=cars.filter(car=>car.isPlayer&&!car.isHost);}
    if(tab==="done")cars=cars.filter(isEnded);
    if(keyword)cars=cars.filter(function(car){return [car.scriptName,car.gameDate,car.gameTime,car.locationName,car.location,car.organizerName,car.studioName,car.dmName,...(car.tags||[]),...(car.scriptTags||[])].join(" ").toLowerCase().includes(keyword);});
    const start=pageIndex*pageSize;return {cars:cars.slice(start,start+pageSize),total:cars.length,hasMore:start+pageSize<cars.length};
  }

  function recalculateView(view,cars){const nextCars=sortCars(Array.isArray(cars)?cars:[]);return {...view,schemaVersion:SCHEMA_VERSION,viewType:"mycar_index",cars:nextCars,counts:{all:nextCars.length,host:nextCars.filter(car=>car.isHost).length,player:nextCars.filter(car=>car.isPlayer).length},builtAt:new Date().toISOString()};}
  function applyMutationToView(view,beforeCar,afterCar){if(!view||typeof view!=="object")return null;const viewerId=text(view.viewerId);const identityIds=Array.from(new Set([viewerId,...(Array.isArray(view.identityIds)?view.identityIds:[])].filter(isFormalId).map(text)));const carId=text((afterCar&&(afterCar.id||afterCar.carId))||(beforeCar&&(beforeCar.id||beforeCar.carId)));if(!carId)return view;let cars=(Array.isArray(view.cars)?view.cars:[]).filter(car=>text(car&&car.id)!==carId);if(afterCar){const compact=compactCar(afterCar,identityIds);if(compact.id&&(compact.isHost||compact.isPlayer))cars.push(compact);}return recalculateView(view,cars);}
  async function applyViewerMutation(viewerId,beforeCar,afterCar){const id=text(viewerId);if(!id)return {ok:false,skipped:"viewer_id_missing"};const current=await read(id);if(!current)return {ok:true,skipped:"view_not_bootstrapped",viewerId:id};const next=applyMutationToView(current,beforeCar,afterCar);await write(next);return {ok:true,viewerId:id};}
  async function applyCarMutation(beforeCar,afterCar){const ownerIds=new Set();[...(beforeCar?getOwnerIdentityIds(beforeCar):[]),...(afterCar?getOwnerIdentityIds(afterCar):[])].forEach(id=>addFormalId(ownerIds,id));const results=[];for(const viewerId of ownerIds)results.push(await applyViewerMutation(viewerId,beforeCar,afterCar));return results;}

  const api={COLLECTION,SCHEMA_VERSION,getPlayerIdentityIds,getOwnerIdentityIds,compactCar,buildView,read,write,recalculateView,applyMutationToView,applyViewerMutation,applyCarMutation,selectForUi,isEnded,isPlanning,sortCars};
  window.JLYMyCarView=api;
  if(window.JLYViewCore)window.JLYViewCore.registerViewType("mycar",api);
})();

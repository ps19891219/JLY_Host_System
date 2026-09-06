"use strict";

(function () {
  function text(value) { return String(value == null ? "" : value).trim(); }
  function list(value) { return Array.isArray(value) ? value : []; }
  function nowIso() { return new Date().toISOString(); }
  function isSynthetic(value) { return /^line:/i.test(text(value)); }
  function carId() {
    const params = new URLSearchParams(location.search);
    return text(params.get("id") || params.get("carId"));
  }

  function claimantName(app) {
    return text(app && (app.lineDisplayName || app.claimantDisplayName || app.displayName));
  }

  function isIdentityClaim(app) {
    return Boolean(app && app.source === "car_view_identity_claim" && ["existing_person", "existing_slot", "new_person"].includes(text(app.claimType)));
  }

  function candidateIds(value, app) {
    const source = value && typeof value === "object" ? value : {};
    const nested = source.player && typeof source.player === "object" ? source.player : {};
    return Array.from(new Set([
      app && app.targetPersonId,
      source.personId, source.memberId, source.profileId, source.playerId,
      nested.personId, nested.memberId, nested.profileId, nested.playerId, nested.id,
      ...list(source.linkedPlayerIds), ...list(nested.linkedPlayerIds)
    ].map(text).filter(id => id && !isSynthetic(id))));
  }

  async function resolveFormalPerson(db, target, app) {
    const ids = candidateIds(target, app);
    for (const id of ids) {
      const snap = await db.collection("players").doc(id).get();
      if (snap.exists) return { id: snap.id, data: snap.data() || {} };
    }

    const identityIds = Array.from(new Set([
      target && target.identityId,
      target && target.player && target.player.identityId
    ].map(text).filter(Boolean)));
    for (const identityId of identityIds) {
      const snapshot = await db.collection("players").where("identityId", "==", identityId).limit(2).get();
      if (snapshot.docs.length === 1) {
        return { id: snapshot.docs[0].id, data: snapshot.docs[0].data() || {} };
      }
      if (snapshot.docs.length > 1) {
        throw new Error("正式 Identity 對到多個 Person，請先做人員資料修復後再核准");
      }
    }

    throw new Error("這個既有名字目前缺少可安全辨識的 Person 證據，請先用 Member Picker 串回正式 Person；系統不會只靠同名自動合併");
  }

  function assertLineCanBind(person, app) {
    const current = text(person && person.data && person.data.lineUserId);
    const claimant = text(app && app.lineUserId);
    if (!claimant) throw new Error("這筆申請缺少已驗證 LINE Identity");
    if (current && current !== claimant) {
      throw new Error("這個 Person 已綁定其他 LINE Identity，已轉為人工處理，不會覆蓋原綁定");
    }
  }

  function personLinePatch(person, app, role) {
    const currentRoles = list(person && person.data && person.data.roles).map(text).filter(Boolean);
    const roles = Array.from(new Set([...currentRoles, role === "dm" ? "staff" : "player"]));
    return {
      lineUserId: text(app.lineUserId),
      lineDisplayName: claimantName(app),
      isLineLinked: true,
      lineLinkedAt: nowIso(),
      roles,
      staffEnabled: role === "dm" ? true : Boolean(person && person.data && person.data.staffEnabled),
      updatedAt: nowIso()
    };
  }

  function newPersonPayload(app, role) {
    const name = claimantName(app) || text(app && (app.playerName || app.name)) || "未命名成員";
    return {
      displayName: name,
      nickname: name,
      aliases: [],
      roles: [role === "dm" ? "staff" : "player"],
      memberType: "guest",
      type: "guest",
      status: "active",
      isLineLinked: true,
      lineUserId: text(app.lineUserId),
      lineDisplayName: claimantName(app),
      linePictureUrl: "",
      staffEnabled: role === "dm",
      source: "line_identity_claim_approved",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lineLinkedAt: nowIso()
    };
  }

  function findPlayer(players, app) {
    const targetId = text(app && app.targetPlayerId);
    return list(players).find(function (player) {
      return text(player && (player.playerId || player.id || player.profileId || player.memberId)) === targetId;
    }) || null;
  }

  function findStaff(staffSlots, app) {
    const targetId = text(app && app.targetStaffId);
    return list(staffSlots).find(function (slot) {
      return text(slot && (slot.id || slot.slotId)) === targetId;
    }) || null;
  }

  function updateExistingRosterIdentity(target, person, app) {
    target.personId = person.id;
    target.memberId = person.id;
    target.profileId = person.id;
    if (text(person.data && person.data.identityId)) target.identityId = text(person.data.identityId);
    target.lineUserId = text(app.lineUserId);
    target.lineDisplayName = claimantName(app);
    target.identityClaimedAt = nowIso();
    target.identityClaimSource = "host_approved_line_claim";
  }

  async function approveExistingPlayer(appIndex, app, car) {
    const db = window.db;
    const target = findPlayer(car.players, app);
    if (!target) throw new Error("找不到要認領的既有玩家，可能已被修改或移除");
    const person = await resolveFormalPerson(db, target, app);
    assertLineCanBind(person, app);

    const carRef = db.collection("cars").doc(carId());
    const personRef = db.collection("players").doc(person.id);
    await db.runTransaction(async function (transaction) {
      const freshCarSnap = await transaction.get(carRef);
      const freshPersonSnap = await transaction.get(personRef);
      if (!freshCarSnap.exists || !freshPersonSnap.exists) throw new Error("核准時資料已變動，請重新整理後再試");
      const freshCar = freshCarSnap.data() || {};
      const applications = list(freshCar.applications).map(item => ({ ...item }));
      const current = applications[Number(appIndex)];
      if (!current || text(current.id) !== text(app.id) || current.status && current.status !== "pending") {
        throw new Error("這筆玩家身分申請已經被處理或位置已變動");
      }
      const players = list(freshCar.players).map(item => ({ ...item }));
      const freshTarget = findPlayer(players, current);
      if (!freshTarget) throw new Error("找不到要認領的既有玩家");
      const latestPerson = { id: freshPersonSnap.id, data: freshPersonSnap.data() || {} };
      assertLineCanBind(latestPerson, current);
      updateExistingRosterIdentity(freshTarget, latestPerson, current);
      applications.splice(Number(appIndex), 1);
      transaction.set(personRef, personLinePatch(latestPerson, current, "player"), { merge: true });
      transaction.update(carRef, { players, applications, updatedAt: nowIso() });
    });

    alert(`✅ 已核准：LINE「${claimantName(app)}」已綁定既有玩家「${text(app.targetPlayerName) || text(target.playerName || target.displayName || target.name)}」`);
  }

  async function approveNewPlayer(appIndex, app, car, originalActions) {
    const db = window.db;
    const duplicate = await db.collection("players").where("lineUserId", "==", text(app.lineUserId)).limit(2).get();
    if (!duplicate.empty) throw new Error("這個 LINE Identity 已經有正式 Person，不能再建立第二個 Person");

    const personRef = db.collection("players").doc();
    const carRef = db.collection("cars").doc(carId());
    await db.runTransaction(async function (transaction) {
      const snap = await transaction.get(carRef);
      if (!snap.exists) throw new Error("找不到這台車");
      const freshCar = snap.data() || {};
      const applications = list(freshCar.applications).map(item => ({ ...item }));
      const current = applications[Number(appIndex)];
      if (!current || text(current.id) !== text(app.id) || current.status && current.status !== "pending") {
        throw new Error("這筆玩家申請已經被處理或位置已變動");
      }
      const payload = newPersonPayload(current, "player");
      const enriched = {
        ...current,
        playerId: personRef.id,
        profileId: personRef.id,
        memberId: personRef.id,
        displayName: payload.displayName,
        playerName: payload.displayName,
        name: payload.displayName
      };
      const players = list(freshCar.players).map(item => ({ ...item }));
      const player = originalActions.buildPlayerFromApplication(enriched, players.length);
      player.personId = personRef.id;
      player.memberId = personRef.id;
      player.profileId = personRef.id;
      player.lineUserId = text(current.lineUserId);
      player.lineDisplayName = claimantName(current);
      players.push(player);
      const autoSeatResult = originalActions.autoAssignApprovedPlayer(freshCar, player);
      const nextSlots = Array.isArray(autoSeatResult.slots) ? autoSeatResult.slots : list(freshCar.slots);
      applications.splice(Number(appIndex), 1);
      transaction.set(personRef, payload);
      transaction.update(carRef, {
        players,
        playerIds: Array.from(new Set(players.filter(p => !["已取消", "取消", "cancelled", "canceled"].includes(text(p.status))).map(p => text(p.playerId || p.id || p.profileId)).filter(Boolean))),
        applications,
        slots: nextSlots,
        updatedAt: nowIso()
      });
    });

    alert(`✅ 已核准並建立正式 Person：${claimantName(app)}`);
  }

  async function approveExistingDm(applicationId, app, car) {
    const db = window.db;
    const target = findStaff(car.staffSlots, app);
    if (!target) throw new Error("找不到要認領的既有 DM／工作人員");
    const person = await resolveFormalPerson(db, target, app);
    assertLineCanBind(person, app);
    const carRef = db.collection("cars").doc(carId());
    const personRef = db.collection("players").doc(person.id);

    await db.runTransaction(async function (transaction) {
      const freshCarSnap = await transaction.get(carRef);
      const freshPersonSnap = await transaction.get(personRef);
      if (!freshCarSnap.exists || !freshPersonSnap.exists) throw new Error("核准時資料已變動，請重新整理後再試");
      const freshCar = freshCarSnap.data() || {};
      const applications = list(freshCar.dmApplications).map(item => ({ ...item }));
      const appIndex = applications.findIndex(item => text(item.id) === text(applicationId));
      if (appIndex < 0 || applications[appIndex].status !== "pending") throw new Error("這筆 DM 身分申請已經被處理");
      const current = applications[appIndex];
      const staffSlots = list(freshCar.staffSlots).map(item => ({ ...item }));
      const freshTarget = findStaff(staffSlots, current);
      if (!freshTarget) throw new Error("找不到要認領的既有 DM／工作人員");
      const latestPerson = { id: freshPersonSnap.id, data: freshPersonSnap.data() || {} };
      assertLineCanBind(latestPerson, current);
      updateExistingRosterIdentity(freshTarget, latestPerson, current);
      freshTarget.source = "dm_application_identity_claimed";
      applications[appIndex] = { ...current, status: "approved", approvedAt: nowIso(), updatedAt: nowIso(), resolvedPersonId: latestPerson.id };
      transaction.set(personRef, personLinePatch(latestPerson, current, "dm"), { merge: true });
      transaction.update(carRef, { staffSlots, dmApplications: applications, updatedAt: nowIso() });
    });

    alert(`✅ 已核准：LINE「${claimantName(app)}」已綁定既有 DM「${text(app.targetStaffName) || text(target.displayName || target.name)}」`);
  }

  async function approveNewDm(applicationId, app) {
    const db = window.db;
    const duplicate = await db.collection("players").where("lineUserId", "==", text(app.lineUserId)).limit(2).get();
    if (!duplicate.empty) throw new Error("這個 LINE Identity 已經有正式 Person，不能再建立第二個 Person");
    const personRef = db.collection("players").doc();
    const carRef = db.collection("cars").doc(carId());

    await db.runTransaction(async function (transaction) {
      const snap = await transaction.get(carRef);
      if (!snap.exists) throw new Error("找不到這台車");
      const freshCar = snap.data() || {};
      const applications = list(freshCar.dmApplications).map(item => ({ ...item }));
      const appIndex = applications.findIndex(item => text(item.id) === text(applicationId));
      if (appIndex < 0 || applications[appIndex].status !== "pending") throw new Error("這筆 DM 申請已經被處理");
      const current = applications[appIndex];
      const payload = newPersonPayload(current, "dm");
      const staffSlots = list(freshCar.staffSlots).map(item => ({ ...item }));
      staffSlots.push({
        id: `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        order: staffSlots.length + 1,
        label: "DM",
        personId: personRef.id,
        memberId: personRef.id,
        profileId: personRef.id,
        lineUserId: text(current.lineUserId),
        lineDisplayName: claimantName(current),
        displayName: payload.displayName,
        source: "dm_application_approved_new_person"
      });
      applications[appIndex] = { ...current, status: "approved", approvedAt: nowIso(), updatedAt: nowIso(), resolvedPersonId: personRef.id };
      transaction.set(personRef, payload);
      transaction.update(carRef, { staffSlots, dmApplications: applications, updatedAt: nowIso() });
    });

    alert(`✅ 已核准並建立正式 Person／DM：${claimantName(app)}`);
  }

  async function refresh() {
    if (window.JLYCarDetailController && typeof window.JLYCarDetailController.refreshPage === "function") {
      await window.JLYCarDetailController.refreshPage();
    } else if (typeof window.renderCarDetail === "function") {
      await window.renderCarDetail();
    }
  }

  async function install() {
    const playerActions = window.JLYCarDetailApplicationActions;
    const dmActions = window.JLYDmApplicationActions;
    if (!playerActions || !dmActions || playerActions.__identityClaimWrapped || dmActions.__identityClaimWrapped) return;

    const originalPlayerApprove = playerActions.approveApplication.bind(playerActions);
    const originalDmApprove = dmActions.approve.bind(dmActions);

    playerActions.approveApplication = async function (index) {
      try {
        const db = window.db;
        const snap = await db.collection("cars").doc(carId()).get();
        if (!snap.exists) throw new Error("找不到這台車");
        const car = snap.data() || {};
        const app = list(car.applications)[Number(index)];
        if (!isIdentityClaim(app)) return originalPlayerApprove(index);
        if (app.claimType === "existing_person") await approveExistingPlayer(index, app, car);
        else await approveNewPlayer(index, app, car, playerActions);
        await refresh();
      } catch (error) {
        console.error("核准 LINE 玩家身份認領失敗：", error);
        alert(`核准失敗：${error && error.message ? error.message : "未知錯誤"}`);
      }
    };

    dmActions.approve = async function (applicationId) {
      try {
        const db = window.db;
        const snap = await db.collection("cars").doc(carId()).get();
        if (!snap.exists) throw new Error("找不到這台車");
        const car = snap.data() || {};
        const app = list(car.dmApplications).find(item => text(item.id) === text(applicationId));
        if (!isIdentityClaim(app)) return originalDmApprove(applicationId);
        if (app.claimType === "existing_person" || app.claimType === "existing_slot") await approveExistingDm(applicationId, app, car);
        else await approveNewDm(applicationId, app);
        await refresh();
      } catch (error) {
        console.error("核准 LINE DM 身份認領失敗：", error);
        alert(`核准失敗：${error && error.message ? error.message : "未知錯誤"}`);
      }
    };

    playerActions.__identityClaimWrapped = true;
    dmActions.__identityClaimWrapped = true;
    window.JLYIdentityClaimApproval = { resolveFormalPerson, isIdentityClaim };
  }

  install();
})();

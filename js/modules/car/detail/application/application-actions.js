/*
====================================================

JLY Host System

Module：
Car Detail Application Actions V2

用途：
1. 核准玩家報名申請
2. 拒絕玩家報名申請
3. 將申請資料轉為車團玩家
4. 核准後自動尋找符合的空位
5. 找到位置時直接入座
6. 沒有符合位置時留在待安排
7. 同步 players、applications、slots、history

目前規則：
- 不強制反串
- 不符合的位置不自動安排
- 固定位置優先
- 不限角色席位可依玩家本場選擇轉成男位或女位
- 玩家沒有明確男／女選擇時，先留在待安排

依賴：
- window.db
- window.JLYCarDetailApplicationActionsConfig

====================================================
*/

console.log(
  "application-actions.js V2 已成功載入！"
);

(function () {
  "use strict";

  let membershipViewSyncLoadPromise =
    null;

  let studioRecruitmentSyncLoadPromise = null;

  function buildActivePlayerIds(
    players
  ) {
    return Array.from(
      new Set(
        (
          Array.isArray(players)
            ? players
            : []
        )
          .filter(
            function (player) {
              const status =
                String(
                  player &&
                  player.status ||
                  ""
                ).trim();

              return ![
                "已取消",
                "取消",
                "cancelled",
                "canceled"
              ].includes(
                status
              );
            }
          )
          .map(
            function (player) {
              return String(
                player &&
                (
                  player.playerId ||
                  player.id ||
                  player.profileId
                ) ||
                ""
              ).trim();
            }
          )
          .filter(Boolean)
      )
    );
  }

  async function ensureMembershipViewSync() {
    if (
      window
        .JLYMembershipViewSync
    ) {
      return window
        .JLYMembershipViewSync;
    }

    if (
      membershipViewSyncLoadPromise
    ) {
      return membershipViewSyncLoadPromise;
    }

    membershipViewSyncLoadPromise =
      new Promise(
        function (
          resolve,
          reject
        ) {
          const script =
            document.createElement(
              "script"
            );

          script.src =
            "/js/data-view/membership-view-sync.js?v=2";

          script.async =
            true;

          script.onload =
            function () {
              if (
                window
                  .JLYMembershipViewSync
              ) {
                resolve(
                  window
                    .JLYMembershipViewSync
                );
                return;
              }

              reject(
                new Error(
                  "Membership View Sync 未初始化"
                )
              );
            };

          script.onerror =
            reject;

          document.head
            .appendChild(
              script
            );
        }
      );

    return membershipViewSyncLoadPromise;
  }

  async function syncKnownMembershipMutation(
    beforeCar,
    afterCar,
    playerIds,
    changedFields
  ) {
    try {
      const syncModule =
        await ensureMembershipViewSync();

      return await syncModule
        .sync({
          beforeCar,
          afterCar,
          playerIds:
            Array.isArray(
              playerIds
            )
              ? playerIds
              : [],
          changedFields:
            Array.isArray(
              changedFields
            )
              ? changedFields
              : []
        });
    } catch (error) {
      console.warn(
        "同步 Membership View 失敗：",
        error
      );

      return [];
    }
  }



  let carPreparedViewSyncLoadPromise = null;

  async function ensureCarPreparedViewSync() {
    if (window.JLYViewRuntimeLoader) {
      return window.JLYViewRuntimeLoader.ensure();
    }
    if (carPreparedViewSyncLoadPromise) return carPreparedViewSyncLoadPromise;
    carPreparedViewSyncLoadPromise = new Promise(function(resolve,reject){
      const script=document.createElement("script");
      script.src="/js/data-view/view-runtime-loader.js?v=2";
      script.async=true;
      script.onload=async function(){
        try {
          if (!window.JLYViewRuntimeLoader) throw new Error("View Runtime Loader 未初始化");
          resolve(await window.JLYViewRuntimeLoader.ensure());
        } catch(error){ reject(error); }
      };
      script.onerror=reject;
      document.head.appendChild(script);
    });
    return carPreparedViewSyncLoadPromise;
  }

  async function syncCarPreparedViewMutation(beforeCar, afterCar) {
    try {
      const runtime=await ensureCarPreparedViewSync();
      const coordinator=runtime&&runtime.coordinator;
      if (!coordinator || typeof coordinator.updateCarViews!=="function") return [];
      return await coordinator.updateCarViews({
        beforeCar,
        afterCar,
        changedFields:["players","playerIds","applications","slots","history","updatedAt"]
      });
    } catch(error) {
      console.warn("核准報名同步 Car Prepared View 失敗：", error);
      return [];
    }
  }

  async function syncStudioRecruitmentMutation(afterCar) {
    if (!afterCar || !(afterCar.studioId || afterCar.organizationId)) return null;
    try {
      if (!window.JLYStudioBookingDomain || !window.JLYStudioBookingViews) {
        if (!studioRecruitmentSyncLoadPromise) {
          studioRecruitmentSyncLoadPromise = Promise.all([
            loadRecruitmentScript("/js/modules/studio/studio-booking-activity.js?v=1", "JLYStudioBookingDomain"),
            loadRecruitmentScript("/js/data-view/studio-booking-views.js?v=1", "JLYStudioBookingViews")
          ]);
        }
        await studioRecruitmentSyncLoadPromise;
      }
      const studioId = String(afterCar.studioId || afterCar.organizationId || "").trim();
      const ref = window.db.collection("studioRecruitmentViews").doc(studioId);
      const snap = await ref.get();
      const view = snap.exists ? snap.data() : {schemaVersion:1,viewType:"studio_recruitment",studioId,activities:[],count:0};
      const next = window.JLYStudioBookingViews.applyRecruitmentMutation(view, afterCar, window.JLYStudioBookingDomain);
      await ref.set(next, {merge:false});
      return next;
    } catch (error) {
      console.warn("同步 Studio Recruitment View 失敗：", error);
      return null;
    }
  }

  function loadRecruitmentScript(src, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise(function(resolve,reject){const script=document.createElement("script");script.src=src;script.async=true;script.onload=function(){window[globalName]?resolve(window[globalName]):reject(new Error(globalName+" 未初始化"));};script.onerror=reject;document.head.appendChild(script);});
  }

  // ------------------------------------------------------------
  // 外部設定
  // ------------------------------------------------------------

  function getConfig() {
    const config =
      window
        .JLYCarDetailApplicationActionsConfig;

    if (!config) {
      throw new Error(
        "Application Actions Config 尚未設定"
      );
    }

    return config;
  }

  function getCarId() {
    const config =
      getConfig();

    if (
      typeof config.getCarId !==
        "function"
    ) {
      throw new Error(
        "缺少 getCarId"
      );
    }

    return config.getCarId();
  }

  function nowTime() {
    const config =
      getConfig();

    if (
      typeof config.nowTime ===
        "function"
    ) {
      return config.nowTime();
    }

    return new Date()
      .toISOString();
  }

  function addHistory(
    car,
    type,
    text
  ) {
    const config =
      getConfig();

    if (
      typeof config.addHistory !==
        "function"
    ) {
      throw new Error(
        "缺少 addHistory"
      );
    }

    return config.addHistory(
      car,
      type,
      text
    );
  }

  async function refreshCarDetail() {
    const config =
      getConfig();

    if (
      typeof config.renderCarDetail ===
        "function"
    ) {
      await config
        .renderCarDetail();
    }
  }

  // ------------------------------------------------------------
  // 通用工具
  // ------------------------------------------------------------

  function cloneValue(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function cloneArray(value) {
    return cloneValue(
      Array.isArray(value)
        ? value
        : []
    );
  }

  function normalizeId(value) {
    return String(
      value || ""
    ).trim();
  }

  function normalizePosition(value) {
    const text =
      String(
        value || ""
      )
        .trim()
        .toLowerCase();

    if (
      text === "male" ||
      text === "男" ||
      text === "男位" ||
      text === "男角"
    ) {
      return "male";
    }

    if (
      text === "female" ||
      text === "女" ||
      text === "女位" ||
      text === "女角"
    ) {
      return "female";
    }

    return "flexible";
  }

  function getPositionLabel(value) {
    const position =
      normalizePosition(value);

    if (position === "male") {
      return "男位";
    }

    if (position === "female") {
      return "女位";
    }

    return "不限";
  }

  function getSlotId(slot) {
    const source =
      slot &&
      typeof slot ===
        "object"
        ? slot
        : {};

    return normalizeId(
      source.slotId ||
      source.seatId ||
      source.id
    );
  }

  function getSlotType(slot) {
    const source =
      slot &&
      typeof slot ===
        "object"
        ? slot
        : {};

    return normalizePosition(
      source.type ||
      source.position ||
      source.originalType
    );
  }

  function getSlotOriginalType(slot) {
    const source =
      slot &&
      typeof slot ===
        "object"
        ? slot
        : {};

    return normalizePosition(
      source.originalType ||
      source.type ||
      source.position
    );
  }

  function getSlotPlayerId(slot) {
    const source =
      slot &&
      typeof slot ===
        "object"
        ? slot
        : {};

    return normalizeId(
      source.playerId ||
      (
        source.player &&
        (
          source.player.playerId ||
          source.player.id
        )
      )
    );
  }

  function isSlotEmpty(slot) {
    return !getSlotPlayerId(slot);
  }

  // ------------------------------------------------------------
  // 申請／玩家資料
  // ------------------------------------------------------------

  function createStablePlayerId(
    application
  ) {
    const app =
      application &&
      typeof application ===
        "object"
        ? application
        : {};

    return String(
      app.playerId ||
      app.id ||
      app.applicationId ||
      (
        "car-player-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 10)
      )
    );
  }

  function getApplicationPlayerName(
    application
  ) {
    const app =
      application &&
      typeof application ===
        "object"
        ? application
        : {};

    return String(
      app.name ||
      app.playerName ||
      app.displayName ||
      "未命名玩家"
    );
  }

  function getApplicationPosition(
    application
  ) {
    const app =
      application &&
      typeof application ===
        "object"
        ? application
        : {};

    return normalizePosition(
      app.playPosition ||
      app.requestedPosition ||
      app.role ||
      app.position
    );
  }

  function buildPlayerFromApplication(
    application,
    playerIndex
  ) {
    const app =
      application &&
      typeof application ===
        "object"
        ? application
        : {};

    const defaultName =
      getApplicationPlayerName(
        app
      );

    const stablePlayerId =
      createStablePlayerId(
        app
      );

    const normalizedPosition =
      getApplicationPosition(
        app
      );

    return {
      playerId:
        stablePlayerId,

      playerName:
        defaultName,

      name:
        defaultName,

      displayName:
        app.displayName ||
        defaultName,

      hostAlias:
        app.hostAlias ||
        defaultName,

      hostNote:
        app.hostNote ||
        "",

      gender:
        app.gender ||
        app.playerGender ||
        "",

      position:
        getPositionLabel(
          normalizedPosition
        ),

      requestedPosition:
        app.requestedPosition ||
        app.role ||
        app.position ||
        "",

      playPosition:
        normalizedPosition ===
          "flexible"
          ? ""
          : normalizedPosition,

      requestedCrossPlay:
        app.requestedCrossPlay ===
          true,

      allowCrossPlay:
        app.allowCrossPlay ===
          true,

      isCrossPlay:
        app.isCrossPlay ===
          true,

      roleChoice:
        app.roleChoice ||
        "",

      seatLabel:
        String(
          Number(playerIndex || 0) +
          1
        ),

      source:
        app.source ||
        "join_page",

      status:
        "已加入",

      applicationId:
        app.applicationId ||
        app.id ||
        "",

      joinedAt:
        nowTime(),

      updatedAt:
        nowTime()
    };
  }

  function createPlayerSnapshot(
    player
  ) {
    const source =
      player &&
      typeof player ===
        "object"
        ? player
        : {};

    return {
      playerId:
        source.playerId,

      id:
        source.playerId,

      playerName:
        source.playerName,

      name:
        source.hostAlias ||
        source.playerName ||
        source.name,

      displayName:
        source.hostAlias ||
        source.displayName ||
        source.playerName ||
        source.name,

      hostAlias:
        source.hostAlias ||
        "",

      gender:
        source.gender ||
        "",

      position:
        source.position ||
        "不限",

      playPosition:
        source.playPosition ||
        "",

      isCrossPlay:
        source.isCrossPlay ===
        true
    };
  }

  // ------------------------------------------------------------
  // 自動入座規則
  // ------------------------------------------------------------

  function findFixedPositionSlot(
    slots,
    playerPosition
  ) {
    return (
      slots.find(
        function (slot) {
          return (
            isSlotEmpty(slot) &&
            getSlotOriginalType(
              slot
            ) === playerPosition
          );
        }
      ) ||
      null
    );
  }

  function findFlexibleSlot(slots) {
    return (
      slots.find(
        function (slot) {
          return (
            isSlotEmpty(slot) &&
            getSlotOriginalType(
              slot
            ) === "flexible"
          );
        }
      ) ||
      null
    );
  }

  function findAutoSeat(
    slots,
    player
  ) {
    const playerPosition =
      normalizePosition(
        player.playPosition ||
        player.position
      );

    /*
     * 玩家沒有明確選擇男位或女位時，
     * 不由系統猜測，直接留在待安排。
     */
    if (
      playerPosition !== "male" &&
      playerPosition !== "female"
    ) {
      return {
        slot:
          null,

        position:
          "flexible",

        reason:
          "玩家尚未選擇實際男位或女位"
      };
    }

    /*
     * 第一順位：
     * 固定男位／固定女位。
     */
    const fixedSlot =
      findFixedPositionSlot(
        slots,
        playerPosition
      );

    if (fixedSlot) {
      return {
        slot:
          fixedSlot,

        position:
          playerPosition,

        reason:
          ""
      };
    }

    /*
     * 第二順位：
     * 可男可女的不限角色席位。
     */
    const flexibleSlot =
      findFlexibleSlot(
        slots
      );

    if (flexibleSlot) {
      return {
        slot:
          flexibleSlot,

        position:
          playerPosition,

        reason:
          ""
      };
    }

    return {
      slot:
        null,

      position:
        playerPosition,

      reason:
        getPositionLabel(
          playerPosition
        ) + "目前沒有空位"
    };
  }

  function assignPlayerToSlot(
    slots,
    player,
    seatResult
  ) {
    const nextSlots =
      cloneArray(slots);

    const targetSlotId =
      getSlotId(
        seatResult.slot
      );

    const targetIndex =
      nextSlots.findIndex(
        function (slot) {
          return (
            getSlotId(slot) ===
            targetSlotId
          );
        }
      );

    if (targetIndex < 0) {
      return {
        success:
          false,

        reason:
          "找不到自動安排的席位",

        slots:
          nextSlots,

        slotId:
          ""
      };
    }

    const targetSlot = {
      ...nextSlots[
        targetIndex
      ]
    };

    targetSlot.playerId =
      player.playerId;

    targetSlot.player =
      createPlayerSnapshot(
        player
      );

    targetSlot.updatedAt =
      nowTime();

    /*
     * 不限角色席位會依玩家本場選擇，
     * 顯示為實際男位或女位。
     *
     * originalType 仍保留 flexible，
     * 以免失去這個角色原本可男可女的性質。
     */
    if (
      getSlotOriginalType(
        targetSlot
      ) === "flexible"
    ) {
      targetSlot.originalType =
        "flexible";

      targetSlot.type =
        seatResult.position;
    }

    nextSlots[
      targetIndex
    ] = targetSlot;

    return {
      success:
        true,

      reason:
        "",

      slots:
        nextSlots,

      slotId:
        targetSlotId,

      slot:
        targetSlot
    };
  }

  function autoAssignApprovedPlayer(
    car,
    player
  ) {
    const slots =
      cloneArray(
        car.slots
      );

    if (slots.length === 0) {
      return {
        success:
          false,

        assigned:
          false,

        reason:
          "車團尚未建立席位",

        slots
      };
    }

    const seatResult =
      findAutoSeat(
        slots,
        player
      );

    if (!seatResult.slot) {
      return {
        success:
          true,

        assigned:
          false,

        reason:
          seatResult.reason,

        slots
      };
    }

    const assignmentResult =
      assignPlayerToSlot(
        slots,
        player,
        seatResult
      );

    if (
      !assignmentResult.success
    ) {
      return {
        success:
          false,

        assigned:
          false,

        reason:
          assignmentResult.reason,

        slots
      };
    }

    return {
      success:
        true,

      assigned:
        true,

      reason:
        "",

      slots:
        assignmentResult.slots,

      slotId:
        assignmentResult.slotId,

      assignedPosition:
        seatResult.position
    };
  }

  // ------------------------------------------------------------
  // 核准申請
  // ------------------------------------------------------------

  async function approveApplications(indices) {
    const db=window.db, carId=getCarId();
    if(!db){alert("Firebase 尚未載入");return;}
    if(!carId){alert("找不到車團 ID");return;}
    try {
      const carRef=db.collection("cars").doc(carId);
      const doc=await carRef.get();
      if(!doc.exists){alert("找不到這台車");return;}
      const car=doc.data()||{};
      const applications=cloneArray(car.applications);
      const players=cloneArray(car.players);
      const requested=(Array.isArray(indices)?indices:[])
        .map(Number).filter(Number.isInteger)
        .filter(i=>i>=0&&i<applications.length);
      const unique=Array.from(new Set(requested)).sort((a,b)=>a-b);
      if(!unique.length){alert("請先選擇要核准的申請");return;}

      let nextSlots=cloneArray(car.slots);
      let history=cloneArray(car.history);
      const approvedPlayers=[];
      unique.forEach(function(applicationIndex){
        const app=applications[applicationIndex];
        const player=buildPlayerFromApplication(app,players.length);
        const workingCar={...car,players:[...players],slots:nextSlots,history};
        players.push(player);
        const seatResult=autoAssignApprovedPlayer(workingCar,player);
        nextSlots=Array.isArray(seatResult.slots)?seatResult.slots:nextSlots;
        const name=getApplicationPlayerName(app);
        history=addHistory({...workingCar,history},"玩家加入",
          seatResult.assigned
            ? name+" 已核准加入車團，並自動安排至"+getPositionLabel(seatResult.assignedPosition)
            : name+" 已核准加入車團，等待主揪安排席位"+(seatResult.reason?"（"+seatResult.reason+"）":"")
        );
        approvedPlayers.push(player);
      });
      const approvedSet=new Set(unique);
      const remainingApplications=applications.filter((_,i)=>!approvedSet.has(i));
      const updateData={
        players,
        playerIds:buildActivePlayerIds(players),
        applications:remainingApplications,
        slots:nextSlots,
        history,
        updatedAt:nowTime()
      };
      await carRef.update(updateData);
      const beforeCar={id:carId,...car};
      const afterCar={id:carId,...car,...updateData};
      const preparedViewResults =
        await syncCarPreparedViewMutation(
          beforeCar,
          afterCar
        );

      const carDetailSync =
        preparedViewResults.find(
          function (result) {
            return result &&
              result.type === "car_detail";
          }
        );

      if (
        !carDetailSync ||
        carDetailSync.ok !== true
      ) {
        throw new Error(
          "玩家已核准，但 Recruit / 車團 Prepared View 同步尚未完成。請先不要重複操作。"
        );
      }

      await syncKnownMembershipMutation(
        beforeCar,afterCar,
        approvedPlayers.map(p=>p&&(p.playerId||p.id||p.profileId)).filter(Boolean),
        ["players","playerIds","applications","slots","history"]
      );
      await syncStudioRecruitmentMutation(afterCar);
      alert(unique.length===1?"已核准加入！":("已一次核准 "+unique.length+" 筆申請！"));
      await refreshCarDetail();
      scrollToApplicationReview();
    } catch(error) {
      console.error("核准申請失敗：",error);
      alert("核准失敗："+(error&&error.message?error.message:"未知錯誤"));
    }
  }

  async function approveApplication(index) {
    return approveApplications([index]);
  }

  async function approveAllApplications() {
    const car=window.currentCarData&&typeof window.currentCarData==="object"?window.currentCarData:{};
    const apps=Array.isArray(car.applications)?car.applications:[];
    return approveApplications(apps.map((_,index)=>index));
  }

  async function approveSelectedApplications() {
    const boxes=Array.from(document.querySelectorAll("[data-application-review-checkbox]:checked"));
    return approveApplications(boxes.map(box=>Number(box.value)));
  }

  function scrollToApplicationReview() {
    const target=document.getElementById("applicationReviewSection");
    if(target) target.scrollIntoView({behavior:"smooth",block:"start"});
  }

  // ------------------------------------------------------------
  // 拒絕申請
  // ------------------------------------------------------------

  async function rejectApplication(
    index
  ) {
    if (
      !confirm(
        "確定要拒絕這筆申請嗎？"
      )
    ) {
      return;
    }

    const db =
      window.db;

    const carId =
      getCarId();

    if (!db) {
      alert(
        "Firebase 尚未載入"
      );

      return;
    }

    if (!carId) {
      alert(
        "找不到車團 ID"
      );

      return;
    }

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      const doc =
        await carRef.get();

      if (!doc.exists) {
        alert(
          "找不到這台車"
        );

        return;
      }

      const car =
        doc.data();

      const applications =
        cloneArray(
          car.applications
        );

      const applicationIndex =
        Number(index);

      const app =
        applications[
          applicationIndex
        ];

      if (!app) {
        alert(
          "找不到這筆申請"
        );

        return;
      }

      applications.splice(
        applicationIndex,
        1
      );

      const playerName =
        getApplicationPlayerName(
          app
        );

      const history =
        addHistory(
          car,
          "拒絕申請",
          playerName +
            " 的報名申請已被拒絕"
        );

      const updateData = {
        applications,
        history,
        updatedAt: nowTime()
      };

      await carRef.update(updateData);

      const preparedViewResults =
        await syncCarPreparedViewMutation(
          { id: carId, ...car },
          { id: carId, ...car, ...updateData }
        );

      const carDetailSync =
        preparedViewResults.find(
          function (result) {
            return result &&
              result.type === "car_detail";
          }
        );

      if (
        !carDetailSync ||
        carDetailSync.ok !== true
      ) {
        throw new Error(
          "申請已拒絕，但 Recruit / 車團 Prepared View 同步尚未完成。請先不要重複操作。"
        );
      }

      alert(
        "已拒絕申請"
      );

      await refreshCarDetail();
    } catch (error) {
      console.error(
        "拒絕申請失敗：",
        error
      );

      alert(
        "拒絕失敗：" +
        (
          error &&
          error.message
            ? error.message
            : "未知錯誤"
        )
      );
    }
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window
    .JLYCarDetailApplicationActions = {
      normalizePosition,

      getPositionLabel,

      getSlotId,

      getSlotOriginalType,

      createStablePlayerId,

      getApplicationPlayerName,

      getApplicationPosition,

      buildPlayerFromApplication,

      createPlayerSnapshot,

      findFixedPositionSlot,

      findFlexibleSlot,

      findAutoSeat,

      assignPlayerToSlot,

      autoAssignApprovedPlayer,

      approveApplication,

      approveApplications,

      approveAllApplications,

      approveSelectedApplications,

      scrollToApplicationReview,

      rejectApplication
    };

  console.log(
    "✅ Car Detail Application Actions V2 已載入"
  );
})();

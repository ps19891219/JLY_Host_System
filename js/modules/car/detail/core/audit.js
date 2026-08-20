console.log(
  "audit.js 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // 基本工具
  // ============================================================

  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase 尚未初始化"
      );
    }

    return window.db;
  }

  function getIdentity() {
    return window.JLYIdentity || null;
  }

  function getPermissions() {
    return window.JLYPermissions || null;
  }

  function getActorInfo() {
    const identity =
      getIdentity();

    const permissions =
      getPermissions();

    const actorId =
      identity &&
      typeof identity
        .getCurrentPlayerId ===
        "function"
        ? String(
            identity
              .getCurrentPlayerId() ||
            ""
          ).trim()
        : "";

    const actorProfileId =
      identity &&
      typeof identity
        .getCurrentPlayerProfileId ===
        "function"
        ? String(
            identity
              .getCurrentPlayerProfileId() ||
            ""
          ).trim()
        : "";

    const actorName =
      identity &&
      typeof identity
        .getCurrentPlayerName ===
        "function"
        ? String(
            identity
              .getCurrentPlayerName() ||
            ""
          ).trim()
        : "";

    const isSystemAdmin =
      Boolean(
        permissions &&
        typeof permissions
          .isSystemAdminMode ===
          "function" &&
        permissions
          .isSystemAdminMode()
      );

    return {
      actorId,
      actorProfileId,
      actorName,

      actorMode:
        isSystemAdmin
          ? "system_admin"
          : "normal",

      authorityReason:
        isSystemAdmin
          ? "system_admin_override"
          : "car_owner"
    };
  }

  // ============================================================
  // Audit Snapshot
  //
  // 不把 history 再複製進 Audit。
  // slots 只保存摘要，避免 Audit 文件過大。
  // ============================================================

  function createValueSnapshot(
    key,
    value
  ) {
    if (key === "history") {
      return undefined;
    }

    if (key === "slots") {
      const slots =
        Array.isArray(value)
          ? value
          : [];

      return {
        count:
          slots.length,

        occupiedCount:
          slots.filter(
            function (slot) {
              return Boolean(
                slot &&
                (
                  slot.playerId ||
                  slot.player
                )
              );
            }
          ).length
      };
    }

    return value;
  }

  function buildChangeSnapshot(
    beforeCar,
    updatedData
  ) {
    const before = {};
    const after = {};
    const changedFields = [];

    Object.keys(
      updatedData || {}
    ).forEach(
      function (key) {
        if (
          key === "history" ||
          key === "updatedAt"
        ) {
          return;
        }

        const beforeValue =
          createValueSnapshot(
            key,
            beforeCar
              ? beforeCar[key]
              : undefined
          );

        const afterValue =
          createValueSnapshot(
            key,
            updatedData[key]
          );

        const beforeText =
          JSON.stringify(
            beforeValue
          );

        const afterText =
          JSON.stringify(
            afterValue
          );

        if (
          beforeText === afterText
        ) {
          return;
        }

        changedFields.push(
          key
        );

        before[key] =
          beforeValue === undefined
            ? null
            : beforeValue;

        after[key] =
          afterValue === undefined
            ? null
            : afterValue;
      }
    );

    return {
      changedFields,
      before,
      after
    };
  }


  // ============================================================
  // Cloud View Store V1A
  // ============================================================

  let cloudCarViewLoadPromise =
    null;

  function ensureCloudCarView() {
    if (
      window.JLYCloudCarView
    ) {
      return Promise.resolve(
        window.JLYCloudCarView
      );
    }

    if (
      cloudCarViewLoadPromise
    ) {
      return cloudCarViewLoadPromise;
    }

    cloudCarViewLoadPromise =
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
            "/js/data-view/cloud-car-view.js?v=1";

          script.async =
            true;

          script.onload =
            function () {
              if (
                window.JLYCloudCarView
              ) {
                resolve(
                  window.JLYCloudCarView
                );

                return;
              }

              reject(
                new Error(
                  "Cloud Car View 模組未初始化"
                )
              );
            };

          script.onerror =
            function () {
              reject(
                new Error(
                  "Cloud Car View 模組載入失敗"
                )
              );
            };

          document.head
            .appendChild(
              script
            );
        }
      );

    return cloudCarViewLoadPromise;
  }


  // ============================================================
  // Car Mutation + Audit
  //
  // 車團修改與 Audit 使用同一個 Firestore Transaction。
  // 不能發生「車改成功但 Audit 沒留下」。
  // ============================================================

  async function updateCarWithAudit(
    config
  ) {
    const settings =
      config &&
      typeof config === "object"
        ? config
        : {};

    const carId =
      String(
        settings.carId || ""
      ).trim();

    if (!carId) {
      throw new Error(
        "audit_missing_car_id"
      );
    }

    const updateData =
      settings.updateData &&
      typeof settings
        .updateData === "object"
        ? settings.updateData
        : {};

    const actionType =
      String(
        settings.actionType ||
        "car_updated"
      ).trim();

    const source =
      String(
        settings.source ||
        "unknown"
      ).trim();

    const db =
      getDb();

    const carRef =
      db
        .collection("cars")
        .doc(carId);

    const auditRef =
      carRef
        .collection("auditLogs")
        .doc();

    const now =
      new Date()
        .toISOString();

    const actor =
      getActorInfo();

    let auditRecord =
      null;

    let nextCarForView =
      null;

    await db.runTransaction(
      async function (
        transaction
      ) {
        const snapshot =
          await transaction.get(
            carRef
          );

        if (!snapshot.exists) {
          throw new Error(
            "car_not_found"
          );
        }

        const beforeCar = {
          id:
            snapshot.id,

          ...snapshot.data()
        };

        const changes =
          buildChangeSnapshot(
            beforeCar,
            updateData
          );

        nextCarForView = {
          ...beforeCar,
          ...updateData,
          id: carId
        };

        auditRecord = {
          auditId:
            auditRef.id,

          entityType:
            "car",

          entityId:
            carId,

          actionType,

          source,

          actorId:
            actor.actorId,

          actorProfileId:
            actor.actorProfileId,

          actorName:
            actor.actorName,

          actorMode:
            actor.actorMode,

          authorityReason:
            actor.authorityReason,

          changedFields:
            changes.changedFields,

          before:
            changes.before,

          after:
            changes.after,

          createdAt:
            now
        };

        transaction.update(
          carRef,
          updateData
        );

        transaction.set(
          auditRef,
          auditRecord
        );
      }
    );

    /*
      Shadow Write：
      正式 Car + Audit 成功後才更新 View。
      View 失敗只記錄 warning，不回滾正式修改。
      等所有 mutation path 都接入後，
      下一階段才會讓 UI 改讀 Cloud View。
    */
    if (nextCarForView) {
      try {
        const cloudView =
          await ensureCloudCarView();

        if (
          cloudView &&
          typeof cloudView
            .writeFromCar ===
              "function"
        ) {
          await cloudView
            .writeFromCar(
              nextCarForView
            );
        }
      } catch (viewError) {
        console.warn(
          "Audit 完成，但 Cloud Car View Shadow Write 失敗：",
          viewError
        );
      }
    }

    return auditRecord;
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYAudit = {
    getActorInfo,
    buildChangeSnapshot,
    updateCarWithAudit
  };
})();
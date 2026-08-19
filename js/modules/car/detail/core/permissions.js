console.log(
  "permissions.js 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // Identity
  // ============================================================

  function getIdentity() {
    return window.JLYIdentity || null;
  }

  function getCurrentPlayerId() {
    const identity =
      getIdentity();

    if (
      identity &&
      typeof identity
        .getCurrentPlayerId ===
        "function"
    ) {
      return String(
        identity
          .getCurrentPlayerId() ||
        ""
      ).trim();
    }

    return String(
      localStorage.getItem(
        "currentPlayerId"
      ) || ""
    ).trim();
  }

  // ============================================================
  // System Admin
  // ============================================================

  function isSystemAdminMode() {
    const identity =
      getIdentity();

    return Boolean(
      identity &&
      typeof identity
        .isSystemAdminMode ===
        "function" &&
      identity
        .isSystemAdminMode()
    );
  }

  function canOverride() {
    return isSystemAdminMode();
  }

  // ============================================================
  // Car Ownership
  // ============================================================

  function getCarOwnerId(car) {
    if (!car) {
      return "";
    }

    return String(
      car.ownerId || ""
    ).trim();
  }

  function isCarOwner(car) {
    if (!car) {
      return false;
    }

    const currentPlayerId =
      getCurrentPlayerId();

    const ownerId =
      getCarOwnerId(car);

    if (
      !currentPlayerId ||
      !ownerId
    ) {
      return false;
    }

    return (
      currentPlayerId ===
      ownerId
    );
  }

  // ============================================================
  // Car Permission
  // ============================================================

  function canEditCar(car) {
    if (!car) {
      return false;
    }

    // System Admin Override
    if (canOverride()) {
      return true;
    }

    // 正式 owner
    if (isCarOwner(car)) {
      return true;
    }

    return false;
  }

  function canManageCar(car) {
    return canEditCar(car);
  }

  // ============================================================
  // Debug / 說明用途
  // ============================================================

  function explainCarPermission(
    car
  ) {
    if (!car) {
      return {
        allowed: false,
        reason: "missing_car"
      };
    }

    if (canOverride()) {
      return {
        allowed: true,
        reason:
          "system_admin_override"
      };
    }

    if (isCarOwner(car)) {
      return {
        allowed: true,
        reason: "car_owner"
      };
    }

    return {
      allowed: false,
      reason: "no_permission"
    };
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYPermissions = {
    getCurrentPlayerId,
    isSystemAdminMode,
    canOverride,
    getCarOwnerId,
    isCarOwner,
    canEditCar,
    canManageCar,
    explainCarPermission
  };
})();
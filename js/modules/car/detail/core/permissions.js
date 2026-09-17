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

  function normalizeId(value) {
    return String(value == null ? "" : value).trim();
  }

  function getCurrentPlayerId() {
    const identity = getIdentity();

    if (
      identity &&
      typeof identity.getCurrentPlayerId === "function"
    ) {
      return normalizeId(identity.getCurrentPlayerId());
    }

    return normalizeId(
      localStorage.getItem("currentPlayerId")
    );
  }

  function getCurrentIdentityIds() {
    const identity = getIdentity();

    if (
      identity &&
      typeof identity.getAllPlayerIdentityIds === "function"
    ) {
      return Array.from(
        new Set(
          identity
            .getAllPlayerIdentityIds()
            .map(normalizeId)
            .filter(Boolean)
        )
      );
    }

    const currentPlayerId = getCurrentPlayerId();
    return currentPlayerId ? [currentPlayerId] : [];
  }

  // ============================================================
  // System Admin
  // ============================================================

  function isSystemAdminMode() {
    const identity = getIdentity();

    return Boolean(
      identity &&
      typeof identity.isSystemAdminMode === "function" &&
      identity.isSystemAdminMode()
    );
  }

  function canOverride() {
    return isSystemAdminMode();
  }

  // ============================================================
  // Car Ownership
  //
  // ownerId is ownership / management authority, not participant role.
  // A creator can therefore edit a car even when their car role is player.
  // Historical confirmed identity aliases are the same owner for permission
  // purposes. Names are never used to infer ownership.
  // ============================================================

  function getCarOwnerId(car) {
    if (!car) return "";
    return normalizeId(car.ownerId);
  }

  function isCarOwner(car) {
    if (!car) return false;

    const ownerId = getCarOwnerId(car);
    if (!ownerId) return false;

    return getCurrentIdentityIds().includes(ownerId);
  }

  // ============================================================
  // Car Permission
  // ============================================================

  function canEditCar(car) {
    if (!car) return false;

    if (canOverride()) return true;

    // Ownership is independent from host/player role.
    if (isCarOwner(car)) return true;

    return false;
  }

  function canManageCar(car) {
    return canEditCar(car);
  }

  // ============================================================
  // Debug / 說明用途
  // ============================================================

  function explainCarPermission(car) {
    if (!car) {
      return {
        allowed: false,
        reason: "missing_car"
      };
    }

    if (canOverride()) {
      return {
        allowed: true,
        reason: "system_admin_override"
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
    getCurrentIdentityIds,
    isSystemAdminMode,
    canOverride,
    getCarOwnerId,
    isCarOwner,
    canEditCar,
    canManageCar,
    explainCarPermission
  };
})();
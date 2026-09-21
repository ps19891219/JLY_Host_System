"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JLYStaffAssignmentConfirmation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STATUS = Object.freeze({
    TENTATIVE: "tentative",
    CONFIRMED: "confirmed",
    DECLINED: "declined",
    INVALIDATED: "invalidated"
  });

  const text = value => String(value == null ? "" : value).trim();

  function fingerprint(shift) {
    const row = shift && typeof shift === "object" ? shift : {};
    return [
      text(row.workId),
      text(row.date),
      text(row.startTime),
      text(row.endDate || row.date),
      text(row.endTime),
      text(row.rolePoolId || row.roleId),
      text(row.roleName)
    ].join("|");
  }

  function createTentative(input) {
    const source = input && typeof input === "object" ? input : {};
    if (!text(source.shiftId)) throw new Error("shift_id_required");
    if (!text(source.personId)) throw new Error("person_id_required");
    return {
      shiftId: text(source.shiftId),
      personId: text(source.personId),
      studioId: text(source.studioId),
      status: STATUS.TENTATIVE,
      shiftFingerprint: fingerprint(source.shift),
      sourceMatchingId: text(source.sourceMatchingId),
      sourceSlotId: text(source.sourceSlotId)
    };
  }

  function reopen(record, shift) {
    const current = record && typeof record === "object" ? record : {};
    if (![STATUS.INVALIDATED, STATUS.DECLINED].includes(text(current.status))) throw new Error("assignment_not_reopenable");
    return { ...current, status: STATUS.TENTATIVE, shiftFingerprint: fingerprint(shift), invalidatedReason: "" };
  }

  function confirm(record, shift) {
    const current = record && typeof record === "object" ? record : {};
    if (text(current.status) === STATUS.INVALIDATED) return confirm(reopen(current, shift), shift);
    if (text(current.status) !== STATUS.TENTATIVE) throw new Error("assignment_not_tentative");
    if (text(current.shiftFingerprint) !== fingerprint(shift)) throw new Error("shift_changed");
    return { ...current, status: STATUS.CONFIRMED };
  }

  function decline(record) {
    const current = record && typeof record === "object" ? record : {};
    if (text(current.status) !== STATUS.TENTATIVE) throw new Error("assignment_not_tentative");
    return { ...current, status: STATUS.DECLINED };
  }

  function invalidateIfChanged(record, shift) {
    const current = record && typeof record === "object" ? record : {};
    if (![STATUS.TENTATIVE, STATUS.CONFIRMED].includes(text(current.status))) return current;
    if (text(current.shiftFingerprint) === fingerprint(shift)) return current;
    return { ...current, status: STATUS.INVALIDATED, invalidatedReason: "shift_changed" };
  }

  function canPromoteToFormal(record, shift) {
    const current = record && typeof record === "object" ? record : {};
    return text(current.status) === STATUS.CONFIRMED &&
      !!text(current.shiftId) &&
      !!text(current.personId) &&
      text(current.shiftFingerprint) === fingerprint(shift);
  }

  function projectFormalAssignment(record, shift) {
    if (!canPromoteToFormal(record, shift)) throw new Error("assignment_not_confirmed");
    return {
      shiftId: text(record.shiftId),
      personId: text(record.personId),
      studioId: text(record.studioId),
      sourceMatchingId: text(record.sourceMatchingId),
      sourceSlotId: text(record.sourceSlotId),
      confirmationStatus: STATUS.CONFIRMED,
      shiftFingerprint: text(record.shiftFingerprint)
    };
  }

  function buildPendingAction(record) {
    const current = record && typeof record === "object" ? record : {};
    return {
      type: "staff_assignment_confirmation",
      responsiblePersonId: text(current.personId),
      studioId: text(current.studioId),
      source: "work_schedule",
      targetType: "work_shift",
      targetId: text(current.shiftId),
      status: text(current.status) === STATUS.TENTATIVE ? "pending" : "resolved"
    };
  }

  return { STATUS, fingerprint, createTentative, reopen, confirm, decline, invalidateIfChanged, canPromoteToFormal, projectFormalAssignment, buildPendingAction };
});

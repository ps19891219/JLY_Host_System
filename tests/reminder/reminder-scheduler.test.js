const test = require("node:test");
const assert = require("node:assert/strict");

const schedule = require("../../shared/notification/reminder-schedule");
const repository = require("../../services/firebase/reminder-repository");
const dispatcher = require("../../services/line/reminder-dispatch-service");
const reminderService = require("../../services/line/reminder-service");

test("tomorrow reminder still honors an explicit 15:00 Asia/Taipei setting", () => {
  assert.equal(
    schedule.calculateScheduledAt(
      { gameDate: "2026-08-24" },
      { sendTime: "15:00", offsetDays: 1, timezone: "Asia/Taipei" }
    ),
    "2026-08-23T07:00:00.000Z"
  );
});

test("default reminder time is 09:00 Asia/Taipei", () => {
  assert.equal(schedule.DEFAULT_SEND_TIME, "09:00");
  assert.equal(
    schedule.calculateScheduledAt(
      { gameDate: "2026-08-24" },
      { offsetDays: 1, timezone: "Asia/Taipei" }
    ),
    "2026-08-23T01:00:00.000Z"
  );
});

test("activity date mutation reschedules the existing reminder without duplicating it", () => {
  const result = schedule.buildRescheduleUpdate(
    { gameDate: "2026-08-24", gameTime: "19:00", status: "招募中" },
    { gameDate: "2026-08-26", gameTime: "19:00", status: "招募中" },
    {
      enabled: true,
      status: "scheduled",
      sendTime: "15:00",
      offsetDays: 1,
      scheduledAt: "2026-08-23T07:00:00.000Z"
    },
    "2026-08-23T00:00:00.000Z"
  );

  assert.equal(result.rescheduled, true);
  assert.equal(result.updateData.status, "scheduled");
  assert.equal(result.updateData.scheduledAt, "2026-08-25T07:00:00.000Z");
  assert.equal(result.updateData.previousScheduledAt, "2026-08-23T07:00:00.000Z");
});

test("enabling the activity reminder creates one formal schedule at the 09:00 default", async () => {
  const writes = [];
  const result = await reminderService.enableGroupPreTripReminder(
    "car-1",
    { gameDate: "2027-08-24" },
    {
      getPreTripReminder: async () => null,
      enablePreTripReminder: async (carId, data) => {
        writes.push({ carId, data });
        return { enabled: true, alreadyEnabled: false, reminder: data };
      }
    }
  );

  assert.equal(result.enabled, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.status, "scheduled");
  assert.equal(writes[0].data.sendTime, "09:00");
  assert.equal(writes[0].data.scheduledAt, "2027-08-23T01:00:00.000Z");
});

test("cancelled or ended activity invalidates its due reminder", () => {
  const result = schedule.buildRescheduleUpdate(
    { gameDate: "2026-08-24", status: "招募中" },
    { gameDate: "2026-08-24", status: "已取消" },
    { enabled: true, status: "scheduled", scheduledAt: "2026-08-23T07:00:00.000Z" },
    "2026-08-23T01:00:00.000Z"
  );

  assert.equal(result.rescheduled, true);
  assert.equal(result.updateData.status, "cancelled");
  assert.equal(result.updateData.scheduledAt, "");
});

test("due reminder query filters by lifecycle and triggerAt before applying limit", () => {
  const calls = [];
  const query = {
    where(field, operator, value) {
      calls.push(["where", field, operator, value]);
      return this;
    },
    orderBy(field, direction) {
      calls.push(["orderBy", field, direction]);
      return this;
    },
    limit(value) {
      calls.push(["limit", value]);
      return this;
    }
  };
  const db = {
    collectionGroup(name) {
      calls.push(["collectionGroup", name]);
      return query;
    }
  };

  assert.equal(
    repository.buildDueReminderQuery(db, "2026-08-23T07:00:00.000Z", 30),
    query
  );
  assert.deepEqual(calls, [
    ["collectionGroup", "reminders"],
    ["where", "status", "==", "scheduled"],
    ["where", "scheduledAt", "<=", "2026-08-23T07:00:00.000Z"],
    ["orderBy", "scheduledAt", "asc"],
    ["limit", 30]
  ]);
});

test("atomic claim prevents duplicate reminder delivery when scheduler reruns", async () => {
  let claimed = false;
  let pushes = 0;
  const options = {
    claimReminder: async () => {
      if (claimed) return { claimed: false, reason: "not_scheduled" };
      claimed = true;
      return {
        claimed: true,
        reminder: { id: "preTrip", carId: "car-1", status: "sending" }
      };
    },
    getCarById: async () => ({ scriptName: "測試車", gameDate: "2026-08-24" }),
    getActiveBindingByCarId: async () => ({ status: "active", groupId: "group-1" }),
    sendTextPush: async () => { pushes += 1; },
    markReminderSent: async () => ({ sent: true })
  };

  const candidate = { id: "preTrip", carId: "car-1" };
  const first = await dispatcher.dispatchOne(candidate, options);
  const second = await dispatcher.dispatchOne(candidate, options);

  assert.equal(first.sent, true);
  assert.equal(second.skipped, true);
  assert.equal(pushes, 1);
});

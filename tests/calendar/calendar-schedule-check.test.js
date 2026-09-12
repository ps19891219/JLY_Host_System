"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadModule() {
  const source = fs.readFileSync(
    path.join(__dirname, "../../js/modules/calendar/calendar-schedule-check.js"),
    "utf8"
  );
  const context = {
    window: {},
    document: { getElementById() { return null; } },
    confirm() { return true; },
    console,
    Date,
    Intl,
    String,
    Number,
    Array
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.JLYCalendarScheduleCheck;
}

function event(start, end, summary = "event") {
  return {
    summary,
    start: { dateTime: start },
    end: { dateTime: end }
  };
}

test("5/18 event that ends early on 5/19 does not conflict with a 5/19 evening car", () => {
  const api = loadModule();
  const events = [event("2026-05-18T19:00:00+08:00", "2026-05-19T01:00:00+08:00", "壞孩子")];
  const result = api.filterGoogleEventsByInterval(events, {
    gameDate: "2026-05-19",
    gameTime: "19:00",
    durationMinutes: 60
  });
  assert.equal(result.length, 0);
});

test("a real overlap on the same evening is still reported", () => {
  const api = loadModule();
  const events = [event("2026-05-19T19:30:00+08:00", "2026-05-19T21:00:00+08:00")];
  const result = api.filterGoogleEventsByInterval(events, {
    gameDate: "2026-05-19",
    gameTime: "19:00",
    durationMinutes: 120
  });
  assert.equal(result.length, 1);
});

test("long 10-hour activities overlap correctly across midnight", () => {
  const api = loadModule();
  const events = [event("2026-05-20T02:00:00+08:00", "2026-05-20T03:00:00+08:00")];
  const result = api.filterGoogleEventsByInterval(events, {
    gameDate: "2026-05-19",
    gameTime: "19:00",
    durationMinutes: 600
  });
  assert.equal(result.length, 1);
});

test("missing explicit duration defaults to one hour", () => {
  const api = loadModule();
  const interval = api.targetInterval({
    gameDate: "2026-05-19",
    gameTime: "19:00"
  });
  assert.equal(interval.end.getTime() - interval.start.getTime(), 60 * 60 * 1000);
});

test("touching interval boundaries are not treated as overlap", () => {
  const api = loadModule();
  assert.equal(api.overlaps(
    { start: new Date("2026-05-19T19:00:00+08:00"), end: new Date("2026-05-19T20:00:00+08:00") },
    { start: new Date("2026-05-19T20:00:00+08:00"), end: new Date("2026-05-19T21:00:00+08:00") }
  ), false);
});

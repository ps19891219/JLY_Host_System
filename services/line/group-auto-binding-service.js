"use strict";

const {
  getGroupSummary
} = require("./group-membership-client");
const {
  findCarDetailViewsByScriptName,
  findCarDetailViewsByDate
} = require("../firebase/line-auto-binding-repository");

function text(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeDigits(value) {
  return text(value)
    .replace(/[０-９]/g, function (digit) {
      return String.fromCharCode(digit.charCodeAt(0) - 0xfee0);
    });
}

function pad2(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number).padStart(2, "0") : "";
}

function validDate(month, day, year) {
  const m = Number(month);
  const d = Number(day);
  const y = Number(year || 2024);
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function extractDateHint(groupName) {
  const value = normalizeDigits(groupName);
  let match = value.match(/(20\d{2})\s*[\/\.\-年]\s*(\d{1,2})\s*[\/\.\-月]\s*(\d{1,2})(?:\s*日)?/);
  if (match) {
    if (!validDate(match[2], match[3], match[1])) return null;
    return { year: match[1], month: pad2(match[2]), day: pad2(match[3]) };
  }
  match = value.match(/(?:^|[^\d])(\d{1,2})\s*[\/\.\-]\s*(\d{1,2})(?:[^\d]|$)/);
  if (match) {
    if (!validDate(match[1], match[2])) return null;
    return { year: "", month: pad2(match[1]), day: pad2(match[2]) };
  }
  match = value.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (match) {
    if (!validDate(match[1], match[2])) return null;
    return { year: "", month: pad2(match[1]), day: pad2(match[2]) };
  }
  return null;
}

function stripDateTokens(value) {
  return normalizeDigits(value)
    .replace(/20\d{2}\s*[\/\.\-年]\s*\d{1,2}\s*[\/\.\-月]\s*\d{1,2}\s*日?/g, " ")
    .replace(/\d{1,2}\s*[\/\.\-]\s*\d{1,2}/g, " ")
    .replace(/\d{1,2}\s*月\s*\d{1,2}\s*日?/g, " ");
}

function extractCompactTimeHint(value) {
  if (!extractDateHint(value)) return "";
  const withoutDate = stripDateTokens(value);
  const match = withoutDate.match(/(?:^|[\s|｜(（\-])((?:[01]\d|2[0-3]))([0-5]\d)(?=$|[^\d])/);
  return match ? match[1] + ":" + match[2] : "";
}

function extractTimeHint(groupName) {
  const value = normalizeDigits(groupName);
  const match = value.match(/(?:^|[^\d])(\d{1,2})\s*[:：]\s*(\d{2})(?:[^\d]|$)/);
  if (!match) return extractCompactTimeHint(value);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return pad2(hour) + ":" + pad2(minute);
}

function normalizeScriptHint(value) {
  const normalized = normalizeDigits(value);
  const withoutDate = stripDateTokens(normalized);
  const withoutCompactTime = extractDateHint(normalized)
    ? withoutDate.replace(/(^|[\s|｜(（\-])(?:[01]\d|2[0-3])[0-5]\d(?=$|[^\d])/g, "$1 ")
    : withoutDate;

  return withoutCompactTime
    .replace(/\d{1,2}\s*[:：]\s*\d{2}/g, " ")
    .replace(/\bJLY\b/gi, " ")
    .replace(/(?:車團|車群|群組|開團|開車|小助手|提醒群)/g, " ")
    .replace(/[｜|＿_\-–—:：,，。!！?？#＃\[\]{}()（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractScriptHint(groupName) {
  const value = normalizeDigits(groupName);
  const bracket = value.match(/[《【「『](.{1,80}?)[》】」』]/);
  if (bracket) return text(bracket[1]);
  return normalizeScriptHint(value);
}

function carDate(car) {
  return text(car && (car.gameDate || car.date || car.startDate));
}

function carTime(car) {
  const value = text(car && (car.gameTime || car.time || car.startTime));
  const match = normalizeDigits(value).match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  return match ? pad2(match[1]) + ":" + pad2(match[2]) : "";
}

function matchesDateHint(car, hint) {
  if (!hint) return true;
  const value = carDate(car);
  const match = normalizeDigits(value).match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (!match) return false;
  if (hint.year && match[1] !== hint.year) return false;
  return match[2] === hint.month && match[3] === hint.day;
}

function isActiveCandidate(car) {
  const status = text(car && (car.status || car.carStatus)).toLowerCase();
  return ![
    "cancelled",
    "canceled",
    "ended",
    "completed",
    "closed",
    "deleted",
    "已取消",
    "已結束",
    "已完成"
  ].includes(status);
}

function candidateSummary(car) {
  return {
    carId: text(car && (car.id || car.carId)),
    scriptName: text(car && (car.scriptName || car.title || car.name)),
    gameDate: carDate(car),
    gameTime: carTime(car),
    ownerId: text(car && car.ownerId)
  };
}

function matchStrength(car, scriptHint) {
  const hint = normalizeScriptHint(scriptHint).replace(/\s/g, "").toLowerCase();
  const name = text(car && (car.scriptName || car.title || car.name)).replace(/\s/g, "").toLowerCase();
  if (!hint || !name) return 0;
  if (hint === name) return 3;
  if (hint.includes(name)) return 2;
  if (name.includes(hint)) return 1;
  return 0;
}

function rankCandidates(cars, dateHint, timeHint, scriptHint = "") {
  let pool = (Array.isArray(cars) ? cars : [])
    .filter(isActiveCandidate)
    .filter(car => text(car && (car.id || car.carId)));
  if (dateHint) pool = pool.filter(car => matchesDateHint(car, dateHint));
  if (timeHint) pool = pool.filter(car => carTime(car) === timeHint);
  return pool.sort((a, b) =>
    matchStrength(b, scriptHint) - matchStrength(a, scriptHint) ||
    (carDate(a) + " " + carTime(a)).localeCompare(carDate(b) + " " + carTime(b)) ||
    text(a.scriptName).localeCompare(text(b.scriptName))
  ).map(candidateSummary);
}

function taipeiDateParts(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
}

function dateForLookup(hint, now = new Date()) {
  if (!hint) return "";
  const current = taipeiDateParts(now);
  const year = hint.year ? Number(hint.year)
    : Number(hint.month) * 100 + Number(hint.day) < current.month * 100 + current.day
      ? current.year + 1 : current.year;
  if (!validDate(hint.month, hint.day, year)) return "";
  return [year, hint.month, hint.day].join("-");
}

async function detectGroupCar(groupId, dependencies = {}) {
  const readSummary = dependencies.getGroupSummary || getGroupSummary;
  const findByScript = dependencies.findCarDetailViewsByScriptName || findCarDetailViewsByScriptName;
  const findByDate = dependencies.findCarDetailViewsByDate || findCarDetailViewsByDate;
  const summary = await readSummary(groupId, dependencies);
  const groupName = text(summary && summary.groupName);
  const scriptHint = extractScriptHint(groupName);
  const dateHint = extractDateHint(groupName);
  const timeHint = extractTimeHint(groupName);
  const normalizedName = normalizeDigits(groupName);

  const hasClockToken = /(?:^|[^\d])\d{1,2}\s*[:：]\s*\d{2}(?:[^\d]|$)/.test(normalizedName);
  if (hasClockToken && !timeHint) {
    return { detected: false, reason: "invalid_time_hint", group: summary,
      scriptHint, dateHint, timeHint, candidates: [] };
  }
  const hasDateToken = /(?:20\d{2}\s*[\/\.\-年]\s*)?\d{1,2}\s*[\/\.\-月]\s*\d{1,2}/.test(normalizedName);
  if (hasDateToken && !dateHint) {
    return { detected: false, reason: "invalid_date_hint", group: summary,
      scriptHint, dateHint, timeHint, candidates: [] };
  }
  const lookupDate = dateForLookup(dateHint, dependencies.now || new Date());
  if (dateHint && !lookupDate) {
    return { detected: false, reason: "invalid_inferred_date", group: summary,
      scriptHint, dateHint, timeHint, candidates: [] };
  }
  if (!lookupDate && !scriptHint) {
    return { detected: false, reason: "candidate_hint_missing", group: summary,
      scriptHint, dateHint, timeHint, candidates: [] };
  }

  // Exactly one bounded Prepared View query; never scan Cars or People.
  const views = lookupDate
    ? await findByDate(lookupDate, { limit: 12, db: dependencies.db })
    : await findByScript(scriptHint, { limit: 12, db: dependencies.db });
  const effectiveDateHint = lookupDate
    ? { year: lookupDate.slice(0, 4), month: lookupDate.slice(5, 7), day: lookupDate.slice(8, 10) }
    : null;
  const candidates = rankCandidates(views, effectiveDateHint, timeHint, scriptHint).slice(0, 5);
  return {
    detected: candidates.length > 0,
    reason: candidates.length
      ? (candidates.length === 1 ? "single_candidate" : "multiple_candidates")
      : "candidate_not_found",
    group: summary,
    scriptHint, dateHint, timeHint, candidates
  };
}

module.exports = {
  extractDateHint,
  extractTimeHint,
  extractScriptHint,
  matchesDateHint,
  rankCandidates,
  dateForLookup,
  detectGroupCar
};

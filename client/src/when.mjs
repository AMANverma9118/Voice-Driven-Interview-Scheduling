const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const DAY_ALIASES = [
  ["monday", "monday"],
  ["mon day", "monday"],
  ["tuesday", "tuesday"],
  ["tues day", "tuesday"],
  ["wednesday", "wednesday"],
  ["wensday", "wednesday"],
  ["wednes day", "wednesday"],
  ["thursday", "thursday"],
  ["thurs day", "thursday"],
  ["friday", "friday"],
  ["fri day", "friday"],
];

const HOUR_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function clean(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.]/g, " ")
    .replace(/(\d)\s*(am|pm)\b/g, "$1 $2")
    .replace(/\b(a|p)\s+m\b/g, "$1m")
    .replace(/\bo'?clock\b/g, "o clock")
    .replace(/\bmon day\b/g, "monday")
    .replace(/\b(tues|choose|chews) day\b/g, "tuesday")
    .replace(/\b(wens|wednes) day\b/g, "wednesday")
    .replace(/\bwensday\b/g, "wednesday")
    .replace(/\b(thurs|thirst) day\b/g, "thursday")
    .replace(/\b(fri|fry) day\b/g, "friday")
    .replace(/\s+/g, " ")
    .trim();
}

export function heardDay(text) {
  const lower = clean(text);
  const hit = DAY_ALIASES.find(([alias]) => lower.includes(alias));
  return hit ? hit[1] : "";
}

function wordHour(token) {
  if (/^\d{1,2}$/.test(token)) return Number(token);
  return HOUR_WORDS[token] ?? null;
}

function officeHour(hour, marker) {
  if (hour == null || hour < 0 || hour > 23) return null;
  const pm = /p\.?\s*m|afternoon|evening/.test(marker);
  const am = /a\.?\s*m|morning/.test(marker);
  let next = hour;
  if (pm && next < 12) next += 12;
  if (am && next === 12) next = 0;
  if (!pm && !am && next >= 1 && next <= 7) next += 12;
  if (next < 8 || next > 19) return null;
  return next;
}

export function heardClock(text) {
  const lower = clean(text);
  const oclock = lower.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+o clock\b/);
  if (oclock) {
    const hour = officeHour(wordHour(oclock[1]), lower);
    return hour == null ? null : { hour, minute: 0 };
  }

  const half = lower.match(/half past (\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)/);
  if (half) {
    const hour = officeHour(wordHour(half[1]), lower);
    return hour == null ? null : { hour, minute: 30 };
  }

  const clock = lower.match(/\b(\d{1,2})\s*(?::| )\s*(\d{2})\b/);
  if (clock) {
    const hour = officeHour(Number(clock[1]), lower);
    const minute = Number(clock[2]);
    if (hour != null && minute >= 0 && minute < 60) return { hour, minute };
  }

  const spoken = lower.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+(thirty|fifteen|forty five|15|30|45))?(?:\s+(am|pm|a m|p m))?\b/);
  if (!spoken) return null;
  const minute = spoken[2] === "thirty" || spoken[2] === "30" ? 30 : spoken[2] === "fifteen" || spoken[2] === "15" ? 15 : spoken[2] === "forty five" || spoken[2] === "45" ? 45 : 0;
  const hour = officeHour(wordHour(spoken[1]), spoken[3] || lower);
  return hour == null ? null : { hour, minute };
}

export function nextWeekday(name, hour = 10, minute = 0) {
  const target = DAYS.indexOf(name);
  if (target < 0) return null;
  const date = new Date();
  const delta = (target - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + delta);
  date.setHours(hour, minute, 0, 0);
  return date;
}

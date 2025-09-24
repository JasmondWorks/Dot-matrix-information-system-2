import type { Schedule, ScheduleInput } from "@/lib/types";

export const WEEKDAYS: Array<"Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"> = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

export const formatTimeOfDay = (time: string) => {
  if (!time) return "";
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour ?? 0, minute ?? 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export const formatDate = (input?: string) => {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (input?: string) => {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatDuration = (seconds?: number) => {
  if (seconds === undefined || seconds === null) return "";
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
};

export const formatScrolls = (scrolls?: number) => {
  if (!scrolls) return "";
  return `${scrolls} scroll${scrolls === 1 ? "" : "s"}`;
};

const toCandidateDate = (dateStr: string, time: string) => {
  const constructed = new Date(`${dateStr}T${time}:00`);
  if (Number.isNaN(constructed.getTime())) return undefined;
  return constructed;
};

const normalizeSchedule = (schedule: ScheduleInput | Schedule) => {
  const asSchedule = schedule as Schedule;
  const asInput = schedule as ScheduleInput;
  const enabled =
    typeof asSchedule.enabled === "boolean"
      ? asSchedule.enabled
      : asInput.enabled ?? true;

  return {
    messageId: schedule.messageId,
    days: schedule.days,
    specificDates: schedule.specificDates,
    time: schedule.time,
    timezone: schedule.timezone,
    enabled,
  };
};

export const computeNextRunAt = (
  schedule: ScheduleInput | Schedule,
  referenceDate: Date = new Date()
): string | undefined => {
  const normalized = normalizeSchedule(schedule);
  if (!normalized.enabled || !normalized.time) return undefined;

  const [hours, minutes] = normalized.time.split(":").map(Number);
  const candidates: Date[] = [];

  normalized.specificDates?.forEach((dateStr) => {
    const candidate = toCandidateDate(dateStr, normalized.time!);
    if (candidate && candidate >= referenceDate) {
      candidates.push(candidate);
    }
  });

  if (normalized.days?.length) {
    normalized.days.forEach((weekday) => {
      const targetIndex = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
      if (targetIndex < 0) return;
      const candidate = new Date(referenceDate);
      candidate.setSeconds(0, 0);
      candidate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
      const currentIndex = candidate.getDay();
      let diff = targetIndex - currentIndex;
      if (diff < 0 || (diff === 0 && candidate <= referenceDate)) {
        diff += 7;
      }
      candidate.setDate(candidate.getDate() + diff);
      candidates.push(candidate);
    });
  }

  if (!candidates.length) {
    const candidate = new Date(referenceDate);
    candidate.setSeconds(0, 0);
    candidate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    if (candidate <= referenceDate) {
      candidate.setDate(candidate.getDate() + 1);
    }
    candidates.push(candidate);
  }

  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0]?.toISOString();
};

export const formatRecurrenceSummary = (schedule: ScheduleInput | Schedule) => {
  const normalized = normalizeSchedule(schedule);
  if (!normalized.time) return "";
  if (normalized.specificDates?.length) {
    const dates = normalized.specificDates
      .map((date) => formatDate(date))
      .filter(Boolean)
      .join(", ");
    return dates ? `${dates} at ${formatTimeOfDay(normalized.time)}` : formatTimeOfDay(normalized.time);
  }
  if (normalized.days?.length) {
    const days = normalized.days.join(", ");
    return `${days} at ${formatTimeOfDay(normalized.time)}`;
  }
  return `Daily at ${formatTimeOfDay(normalized.time)}`;
};

export const formatRelativeToNow = (input?: string) => {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - Date.now();
  const tense = diffMs >= 0 ? "in" : "";
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60000);
  if (minutes < 1) return diffMs >= 0 ? "moments away" : "just now";
  if (minutes < 60) return tense ? `${tense} ${minutes} min` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return tense ? `${tense} ${hours} hr` : `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return tense ? `${tense} ${days} day${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"} ago`;
};


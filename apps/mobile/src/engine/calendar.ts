/**
 * 달력 날짜 연산. 실행 환경의 시간대를 읽지 않도록 UTC 연산만 쓰고, 시간대는 오프셋 인자로 받는다.
 *
 * 계절 경계는 Asia/Seoul 날짜로(toSeoulDate), 물주기 날짜와 알림은 기기 로컬 날짜로 다룬다 (SPEC 12.2, 15).
 */
import type { CalendarDate } from './types';

/** Asia/Seoul 은 UTC+9 고정이고 서머타임이 없다 */
export const SEOUL_UTC_OFFSET_MINUTES = 9 * 60;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/**
 * 시각(epoch ms)을 UTC 오프셋(분)이 가리키는 시간대의 달력 날짜로 바꾼다.
 * 기기 로컬 날짜는 `-new Date(epochMs).getTimezoneOffset()` 을 넘겨서 구한다.
 */
export function toCalendarDate(epochMs: number, utcOffsetMinutes: number): CalendarDate {
  const shifted = new Date(epochMs + utcOffsetMinutes * MS_PER_MINUTE);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function toSeoulDate(epochMs: number): CalendarDate {
  return toCalendarDate(epochMs, SEOUL_UTC_OFFSET_MINUTES);
}

/** 그 날짜 0시의 시각(epoch ms). 서머타임이 있는 시간대는 그 날짜 0시의 오프셋을 넘겨야 한다 */
export function startOfDay(date: CalendarDate, utcOffsetMinutes: number): number {
  return Date.UTC(date.year, date.month - 1, date.day) - utcOffsetMinutes * MS_PER_MINUTE;
}

/** 1970-01-01 부터의 일수 */
function toEpochDay(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;
}

/** 정수 일수를 더한다. 음수면 과거 */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  return toCalendarDate((toEpochDay(date) + days) * MS_PER_DAY, 0);
}

/** from 에서 to 까지의 일수. to 가 미래면 양수(D-day), 과거면 음수(밀린 일수) */
export function diffDays(from: CalendarDate, to: CalendarDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

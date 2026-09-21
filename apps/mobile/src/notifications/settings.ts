/**
 * 알림 시각과 방해금지 (SPEC.md 3.6, 12.2). settings 에는 "HH:MM" 문자열로 들어 있다.
 */
import { addDays } from '../engine';
import type { CalendarDate } from '../engine';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** 알림 시각 기본값 08:00 (SPEC 3.6) */
export const DEFAULT_NOTIFY_MINUTE = 8 * MINUTES_PER_HOUR;

/** 방해금지 구간. 하루 중 몇 분째인지로 적고, 시작이 끝보다 늦으면 자정을 넘는 구간이다 */
export interface QuietHours {
  start: number;
  end: number;
}

export interface NotificationSettings {
  /** 알림 시각. 하루 중 몇 분째 */
  notifyMinute: number;
  quietHours: QuietHours | null;
}

/** "HH:MM" 을 하루 중 몇 분째인지로. 시각이 아니면 null */
export function parseTimeOfDay(value: string | null): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour >= 24 || minute >= MINUTES_PER_HOUR) return null;
  return hour * MINUTES_PER_HOUR + minute;
}

/** settings 에서 읽은 값을 알림 설정으로. 없거나 깨진 값은 기본값으로 둔다 */
export function parseNotificationSettings(raw: {
  notifyTime: string | null;
  dndStart: string | null;
  dndEnd: string | null;
}): NotificationSettings {
  const start = parseTimeOfDay(raw.dndStart);
  const end = parseTimeOfDay(raw.dndEnd);

  return {
    notifyMinute: parseTimeOfDay(raw.notifyTime) ?? DEFAULT_NOTIFY_MINUTE,
    quietHours: start === null || end === null || start === end ? null : { start, end },
  };
}

/** 방해금지 구간 안이면 종료 시각으로 옮긴다 (12.2). 시작 시각은 구간 안, 종료 시각은 밖이다 */
export function shiftOutOfQuietHours(
  date: CalendarDate,
  minuteOfDay: number,
  quietHours: QuietHours | null,
): { date: CalendarDate; minuteOfDay: number } {
  if (!quietHours) return { date, minuteOfDay };

  const { start, end } = quietHours;
  // 구간을 시작 시각부터 잰 길이로 바꾸면 자정을 넘는 구간도 같은 식으로 본다
  const length = (end - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const sinceStart = (minuteOfDay - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (sinceStart >= length) return { date, minuteOfDay };

  // 종료 시각이 알림 시각보다 앞이면 자정을 넘긴 다음 날이다
  return { date: end > minuteOfDay ? date : addDays(date, 1), minuteOfDay: end };
}

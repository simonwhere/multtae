/**
 * 날짜와 주기를 글로 (SPEC.md 3.2, 3.4). 계산식과 계수는 보여 주지 않고 결과만 말한다.
 */
import type { CalendarDate, IntervalResult } from '../engine';
import { ko } from '../i18n/ko';

export function formatMonthDay(date: CalendarDate): string {
  return ko.format.monthDay(date.month, date.day);
}

/** 남은 일수. 물 줄 날은 "오늘", 지났으면 지난 일수 */
export function formatDaysLeft(daysLeft: number): string {
  return daysLeft >= 0 ? ko.format.dDay(daysLeft) : ko.format.overdue(-daysLeft);
}

/** 주기를 한 줄로: "7일마다 물을 줘요". 수경은 물을 갈아 준다 */
export function formatInterval(result: IntervalResult): string {
  return result.mode === 'hydro' ? ko.format.hydroEvery(result.days) : ko.format.every(result.days);
}

/** 오늘 탭의 큰 날짜: "9.21" */
export function formatDottedDate(date: CalendarDate): string {
  return ko.today.date(date.month, date.day);
}

/** 그 날짜의 요일 이름. 날짜만으로 정해지므로 시간대와 무관하다 */
export function formatWeekday(date: CalendarDate): string {
  return ko.today.weekday[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()];
}

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

/** 주기를 한 줄로: "7일마다 물을 줘요". 수경은 물을 갈아 주고, 분재는 날을 정해 주지 않고 흙을 확인한다 (6.1) */
export function formatInterval(result: IntervalResult, options: { bonsai?: boolean } = {}): string {
  if (result.mode === 'hydro') return ko.format.hydroEvery(result.days);
  return options.bonsai ? ko.format.everyCheck(result.days) : ko.format.every(result.days);
}

/** 오늘 탭의 큰 날짜: "9.21" */
export function formatDottedDate(date: CalendarDate): string {
  return ko.today.date(date.month, date.day);
}

/** 그 날짜의 요일 이름. 날짜만으로 정해지므로 시간대와 무관하다 */
export function formatWeekday(date: CalendarDate): string {
  return ko.today.weekday[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()];
}

/** 남은 날을 소리로 읽을 말: "오늘", "3일 뒤", "1일 지남" (SPEC 15 스크린리더) */
export function speakDaysLeft(daysLeft: number): string {
  return daysLeft >= 0 ? ko.format.inDays(daysLeft) : ko.format.overdue(-daysLeft);
}

/**
 * 식물 카드를 한 번에 읽을 말: "곰솔, 남향 실내 창가, 1일 지남".
 * 카드를 누를 수 있으면 스크린리더가 카드 안의 글자 대신 이 말만 읽는다.
 */
export function plantCardLabel(input: {
  name: string;
  /** 이름 아래 한 줄. 공간 이름이거나 다음 물주기 날짜다 */
  note: string;
  daysLeft: number;
  /** 오늘 물을 줬다 */
  done?: boolean;
}): string {
  const due = input.done ? ko.today.doneBadge : speakDaysLeft(input.daysLeft);
  return [input.name, input.note, due].join(', ');
}

/** 오늘 탭 날짜 아래 한 줄 (SPEC 3.2, 10-4): "밀린 식물 1개, 오늘 2개, 3일 안에 3개 더".
 *  밀림·오늘이 없으면 null 이다. 그때는 목록이 "오늘은 물 줄 식물이 없어요"를 말한다 */
export function todaySummary(counts: { overdue: number; due: number; upcoming: number }): string | null {
  const t = ko.today.summary;
  const parts: string[] = [];
  if (counts.overdue > 0) parts.push(t.overdue(counts.overdue));
  if (counts.due > 0) parts.push(counts.overdue > 0 ? t.dueAfterOverdue(counts.due) : t.due(counts.due));
  if (parts.length === 0) return null;
  if (counts.upcoming > 0) parts.push(t.upcoming(counts.upcoming));
  return parts.join(', ');
}

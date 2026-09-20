/**
 * 흙 게이지의 상태 (SPEC.md 14.1): 마지막 물 준 날부터 다음 물주기까지 젖은 영역이 줄어든다.
 * 오늘 탭의 밀림·오늘·다가옴 구분에도 쓴다 (3.2).
 */
import { diffDays } from './calendar';
import type { CalendarDate } from './types';

export type SoilStatus = 'moist' | 'due' | 'overdue';

export interface SoilGaugeState {
  status: SoilStatus;
  /** 젖은 흙의 비율. 1 은 방금 물 줌, 0 은 물 줄 날과 그 이후 */
  moisture: number;
  /** 다음 물주기까지 남은 일수. 0 은 오늘, 음수는 밀린 일수 */
  daysLeft: number;
}

export function getSoilGaugeState(
  lastWatered: CalendarDate,
  nextWater: CalendarDate,
  today: CalendarDate,
): SoilGaugeState {
  const daysLeft = diffDays(today, nextWater);

  if (daysLeft < 0) {
    return { status: 'overdue', moisture: 0, daysLeft };
  }
  if (daysLeft === 0) {
    return { status: 'due', moisture: 0, daysLeft };
  }

  const totalDays = Math.max(1, diffDays(lastWatered, nextWater));
  return { status: 'moist', moisture: Math.min(1, daysLeft / totalDays), daysLeft };
}

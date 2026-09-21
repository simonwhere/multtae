/**
 * 물주기 게이지의 상태 (SPEC.md 14.1): 하루가 한 칸이고, 다음 물주기까지 남은 날만큼 차 있다.
 * 오늘 탭의 밀림·오늘·다가옴 구분에도 쓴다 (3.2).
 */
import { diffDays } from './calendar';
import type { CalendarDate } from './types';

export type SoilStatus = 'moist' | 'due' | 'overdue';

export interface SoilGaugeState {
  status: SoilStatus;
  /** 남은 비율. 1 은 방금 물 줌, 0 은 물 줄 날과 그 이후 */
  moisture: number;
  /** 다음 물주기까지 남은 일수. 0 은 오늘, 음수는 밀린 일수 */
  daysLeft: number;
  /** 마지막 물 준 날부터 다음 물주기까지의 일수. 게이지의 칸 수다. 1 이상 */
  totalDays: number;
}

export function getSoilGaugeState(
  lastWatered: CalendarDate,
  nextWater: CalendarDate,
  today: CalendarDate,
): SoilGaugeState {
  const daysLeft = diffDays(today, nextWater);
  const totalDays = Math.max(1, diffDays(lastWatered, nextWater));

  if (daysLeft < 0) {
    return { status: 'overdue', moisture: 0, daysLeft, totalDays };
  }
  if (daysLeft === 0) {
    return { status: 'due', moisture: 0, daysLeft, totalDays };
  }

  return { status: 'moist', moisture: Math.min(1, daysLeft / totalDays), daysLeft, totalDays };
}

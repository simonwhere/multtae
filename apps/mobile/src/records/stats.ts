/**
 * 식물별 통계 (SPEC.md 3.5): 실제로 물을 준 평균 간격, 지금 알림 간격, 최근 30일 밀림 횟수.
 * 화면·DB 와 떼어 낸 순수 함수다.
 */
import type { Plant, WateringLog } from '../db/schema';
import { addDays, computeInterval, diffDays, toCalendarDate } from '../engine';
import type { Coefficients, EngineSpace, Season } from '../engine';
import { toEnginePlant } from '../plants/today';

/** 평균은 최근 간격 10개로 낸다. 오래전 버릇보다 요즘 버릇을 보여 준다 */
export const RECENT_GAPS = 10;
export const OVERDUE_WINDOW_DAYS = 30;

export interface StatsContext {
  now: number;
  utcOffsetMinutes: number;
  season: Season;
  coefficients: Coefficients;
}

export interface PlantStats {
  /** 실제로 물을 준 평균 간격(일, 반올림). 물 준 날이 둘 이상이어야 있다 */
  averageDays: number | null;
  /** 지금 알림 간격(일) */
  currentDays: number;
  /** 최근 30일 동안 예정일을 넘겨 준 횟수. 지금 밀려 있으면 그것도 센다 */
  overdueCount: number;
  /** 물 준 기록 수 (비가 대신 준 날 포함) */
  waterings: number;
}

export function plantStats(
  plant: Plant,
  space: EngineSpace,
  logs: readonly WateringLog[],
  context: StatsContext,
): PlantStats {
  const { now, utcOffsetMinutes } = context;
  const today = toCalendarDate(now, utcOffsetMinutes);
  const since = addDays(today, -OVERDUE_WINDOW_DAYS);
  const dateOf = (epochMs: number) => toCalendarDate(epochMs, utcOffsetMinutes);

  const watered = [...logs].sort((a, b) => a.wateredAt - b.wateredAt);

  // 같은 날 두 번 누른 것은 한 번으로 본다
  const gaps: number[] = [];
  for (let index = 1; index < watered.length; index += 1) {
    const gap = diffDays(dateOf(watered[index - 1]!.wateredAt), dateOf(watered[index]!.wateredAt));
    if (gap >= 1) gaps.push(gap);
  }
  const recent = gaps.slice(-RECENT_GAPS);
  const averageDays =
    recent.length > 0 ? Math.round(recent.reduce((sum, gap) => sum + gap, 0) / recent.length) : null;

  // 예정일보다 늦게 준 물. 미룬 날짜가 예정일에 들어 있어 "내일로"는 밀림으로 세지 않는다
  const lateWaterings = watered.filter((log) => {
    if (log.dueAt === null) return false;
    const wateredOn = dateOf(log.wateredAt);
    return diffDays(since, wateredOn) >= 0 && diffDays(dateOf(log.dueAt), wateredOn) >= 1;
  }).length;
  const overdueNow =
    plant.nextWaterAt !== null &&
    diffDays(dateOf(plant.nextWaterAt), today) >= 1 &&
    diffDays(since, dateOf(plant.nextWaterAt)) >= 0
      ? 1
      : 0;

  return {
    averageDays,
    currentDays: computeInterval(toEnginePlant(plant), space, context.season, context.coefficients)
      .days,
    overdueCount: lateWaterings + overdueNow,
    waterings: watered.length,
  };
}

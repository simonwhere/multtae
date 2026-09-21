/**
 * 다음 물주기를 다시 세는 규칙 (SPEC.md 시나리오 C, 5.5). DB 와 화면에서 떼어 낸 순수 함수다.
 *
 * next_water_at 은 "마지막 물 준 날 + 주기(모름이면 I/2) + 미룬 횟수"를 저장해 둔 값이다.
 * 계절·계수·공간의 빛이 바뀌면 주기가 달라지므로 같은 식으로 다시 센다. 마지막 물 준 날과 U 는 그대로다.
 */
import type { Plant } from '../db/schema';
import {
  computeInterval,
  diffDays,
  halfIntervalDays,
  nextWaterDate,
  startOfDay,
  toCalendarDate,
} from '../engine';
import type { CalendarDate, Coefficients, EngineSpace, Season } from '../engine';
import { toEnginePlant } from './today';

export interface ScheduleContext {
  /** 기준 날짜 (기기 로컬). 예정일이 이보다 앞이면 밀린 것이다 */
  today: CalendarDate;
  /** 기준 날짜의 계절 */
  season: Season;
  coefficients: Coefficients;
  /** 기기 시간대의 UTC 오프셋(분) */
  utcOffsetMinutes: number;
}

/**
 * 그날 그 계절이라면 이 식물의 다음 물주기는 언제인가. 오늘을 넣으면 지금의 값이고,
 * 다가올 전환일과 새 계절을 넣으면 전환 뒤의 값이다(알림을 미리 짤 때 쓴다).
 * - 이미 밀린 식물은 그대로 둔다. 지난 계절에 마른 흙을 새 주기만큼 더 기다리게 하지 않는다
 * - "내일로"로 미룬 식물도 그대로 둔다. 사용자가 정한 날이다
 * - 다시 센 날짜가 이미 지났으면 기준 날짜로 둔다. 계절이 바뀌자마자 밀림이 되지는 않는다
 */
export function waterDateAsOf(
  plant: Plant,
  space: EngineSpace,
  context: ScheduleContext,
): CalendarDate {
  const { today, season, coefficients, utcOffsetMinutes } = context;
  const stored =
    plant.nextWaterAt === null ? null : toCalendarDate(plant.nextWaterAt, utcOffsetMinutes);

  if (stored && (diffDays(today, stored) < 0 || plant.postponeCount > 0)) return stored;

  const result = computeInterval(toEnginePlant(plant), space, season, coefficients);
  const days = plant.lastWateredUnknown ? halfIntervalDays(result) : result.days;
  const counted = nextWaterDate(
    toCalendarDate(plant.lastWateredAt, utcOffsetMinutes),
    days,
    plant.postponeCount,
  );

  return diffDays(today, counted) < 0 ? today : counted;
}

/** 저장된 다음 물주기를 고쳐야 하면 고칠 값, 아니면 null */
export function planReschedule(
  plant: Plant,
  space: EngineSpace,
  context: ScheduleContext,
): Pick<Plant, 'nextWaterAt'> | null {
  const next = waterDateAsOf(plant, space, context);
  const stored =
    plant.nextWaterAt === null ? null : toCalendarDate(plant.nextWaterAt, context.utcOffsetMinutes);

  // 날짜만 의미가 있다. 같은 날이면 저장된 시각이 자정이 아니어도 둔다
  if (stored && diffDays(stored, next) === 0) return null;
  return { nextWaterAt: startOfDay(next, context.utcOffsetMinutes) };
}

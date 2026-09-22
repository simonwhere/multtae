/**
 * 식물 상세에서 하는 일의 규칙 (SPEC.md 3.4, 5.4, 5.5): 주기 직접 정하기, 분갈이, 공간 이동, 별명.
 * DB 와 화면에서 떼어 낸 순수 함수다. 무엇을 저장할지만 정하고 저장은 호출한 쪽이 한다.
 * 사용자가 직접 바꾼 것이므로 밀렸거나 미룬 식물도 바로 다시 센다.
 */
import type { NewPlantEvent, Plant, Space, WateringLog } from '../db/schema';
import { applyFeedback, applyRepot, startOfDay, toCalendarDate } from '../engine';
import type { Coefficients, EngineSpace, PotSize, Season, SoilType } from '../engine';
import { MAX_NICKNAME_LENGTH } from './registration';
import { countWaterDate } from './schedule';
import { toEnginePlant } from './today';

/** 직접 정할 수 있는 주기. 엔진의 주기 범위와 같다 */
export const MIN_MANUAL_DAYS = 1;
export const MAX_MANUAL_DAYS = 60;

export interface CareContext {
  now: number;
  /** 기기 시간대의 UTC 오프셋(분) */
  utcOffsetMinutes: number;
  /** Asia/Seoul 날짜로 판정한 지금의 계절 */
  season: Season;
  coefficients: Coefficients;
}

function recount(plant: Plant, space: EngineSpace, context: CareContext): number {
  const { now, utcOffsetMinutes, season, coefficients } = context;
  const next = countWaterDate(plant, space, {
    today: toCalendarDate(now, utcOffsetMinutes),
    season,
    coefficients,
    utcOffsetMinutes,
  });
  return startOfDay(next, utcOffsetMinutes);
}

/** 주기를 직접 정한다. days 가 null 이면 자동으로 되돌린다. 배운 보정(U)은 그대로 둔다 */
export function planManualInterval(
  plant: Plant,
  space: EngineSpace,
  days: number | null,
  context: CareContext,
): Pick<Plant, 'manualInterval' | 'manualSeason' | 'nextWaterAt'> {
  const manualInterval =
    days === null
      ? null
      : Math.min(Math.max(Math.round(days), MIN_MANUAL_DAYS), MAX_MANUAL_DAYS);
  const manualSeason = manualInterval === null ? null : context.season;

  return {
    manualInterval,
    manualSeason,
    nextWaterAt: recount({ ...plant, manualInterval }, space, context),
  };
}

/** 직접 정한 주기가 있는데 그 뒤로 계절이 바뀌었으면 "자동으로 돌릴까요?"를 한 번 묻는다 (5.5) */
export function needsSeasonQuestion(plant: Plant, season: Season): boolean {
  return plant.manualInterval !== null && plant.manualSeason !== season;
}

/** "그대로 둘게요": 이번 계절에는 다시 묻지 않는다 */
export function planKeepManual(context: Pick<CareContext, 'season'>): Pick<Plant, 'manualSeason'> {
  return { manualSeason: context.season };
}

export interface CarePlan<Patch> {
  patch: Patch;
  /** 기록 탭에 남길 이벤트 */
  event: NewPlantEvent;
}

/** 분갈이: 화분이나 흙이 바뀌면 다시 세고, 흙이 바뀌었으므로 U 를 처음 값으로 돌린다 (5.5) */
export function planRepot(
  plant: Plant,
  space: EngineSpace,
  change: { potSize: PotSize; soilType: SoilType },
  context: CareContext & { eventId: string },
): CarePlan<Pick<Plant, 'potSize' | 'soilType' | 'learnFactor' | 'lastRepotAt' | 'nextWaterAt'>> {
  const repotted = applyRepot(toEnginePlant(plant), change, context.coefficients);
  const patch = {
    potSize: repotted.potSize,
    soilType: repotted.soilType,
    learnFactor: repotted.learnFactor,
    lastRepotAt: context.now,
  };

  return {
    patch: { ...patch, nextWaterAt: recount({ ...plant, ...patch }, space, context) },
    event: {
      id: context.eventId,
      plantId: plant.id,
      type: 'repot',
      occurredAt: context.now,
      payload: change,
    },
  };
}

/** 공간 이동: 옮긴 공간의 빛으로 바로 다시 센다. U 는 그대로다 (5.5). 같은 공간이면 null */
export function planMove(
  plant: Plant,
  destination: Space,
  context: CareContext & { eventId: string },
): CarePlan<Pick<Plant, 'spaceId' | 'nextWaterAt'>> | null {
  if (destination.id === plant.spaceId) return null;

  return {
    patch: {
      spaceId: destination.id,
      nextWaterAt: recount({ ...plant, spaceId: destination.id }, destination, context),
    },
    event: {
      id: context.eventId,
      plantId: plant.id,
      type: 'move',
      occurredAt: context.now,
      payload: { fromSpaceId: plant.spaceId, toSpaceId: destination.id },
    },
  };
}

/** 저장할 별명. 비었거나 너무 길면 null */
export function planRename(nickname: string): string | null {
  const trimmed = nickname.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NICKNAME_LENGTH ? trimmed : null;
}

/**
 * 같은 흙 상태가 이어서 몇 번(기본 3) 나오면 이 식물은 계산보다 물을 덜(wet) 또는 더(dry) 원한다 (5.4).
 * logs 는 최근 기록부터다. 흙 상태를 고르지 않은 기록은 건너뛰고, 분갈이 전의 기록은 세지 않는다.
 * 주기를 직접 정했거나 수경이면 계산을 쓰지 않으므로 알리지 않는다.
 */
export function feedbackStreak(
  plant: Plant,
  logs: readonly Pick<WateringLog, 'soilState' | 'wateredAt'>[],
  coefficients: Coefficients,
): 'wet' | 'dry' | null {
  if (plant.manualInterval !== null || plant.soilType === 'hydro') return null;

  const needed = coefficients.learning.streakNotice;
  const answers = logs
    .filter((log) => log.soilState !== 'skipped' && log.wateredAt > (plant.lastRepotAt ?? 0))
    .slice(0, needed)
    .map((log) => log.soilState);
  const [first] = answers;

  if (answers.length < needed || (first !== 'wet' && first !== 'dry')) return null;
  return answers.every((answer) => answer === first) ? first : null;
}

/** 진단이 물주기에 대해 말한 것 (9.3 watering_hint) */
export type WateringHint = 'over' | 'under' | 'none';

/** 진단의 물주기 판단을 물어볼 수 있는가. 자동으로 세는 식물만 배우므로 직접 정했거나 수경이면 묻지 않는다 */
export function canApplyWateringHint(plant: Pick<Plant, 'manualInterval' | 'soilType'>, hint: WateringHint): boolean {
  return hint !== 'none' && plant.manualInterval === null && plant.soilType !== 'hydro';
}

/**
 * 진단의 물주기 판단을 반영한다 (8.1 엔진 연동). 너무 자주 줬으면 U ×1.15, 드물게 줬으면 ×0.85 로
 * 물 줄 때 흙 상태에 답한 것과 같게 배우고, 바로 다시 센다. 물어볼 수 없는 식물이면 null
 */
export function planWateringHint(
  plant: Plant,
  space: EngineSpace,
  hint: WateringHint,
  context: CareContext,
): Pick<Plant, 'learnFactor' | 'nextWaterAt'> | null {
  if (!canApplyWateringHint(plant, hint)) return null;

  const learnFactor = applyFeedback(
    plant.learnFactor,
    hint === 'over' ? 'wet' : 'dry',
    false,
    context.coefficients,
  );
  return { learnFactor, nextWaterAt: recount({ ...plant, learnFactor }, space, context) };
}

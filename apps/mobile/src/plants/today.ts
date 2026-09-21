/**
 * 오늘 탭의 규칙 (SPEC.md 3.2, 5.4, 5.5): 구역 나누기, "물 줬어요", "내일로".
 * DB 와 화면에서 떼어 낸 순수 함수다. 무엇을 저장할지만 정하고 저장은 호출한 쪽이 한다.
 */
import type { PlantWithSpace } from '../db/plants';
import type { NewWateringLog, Plant } from '../db/schema';
import {
  addDays,
  applyFeedback,
  canPostpone,
  computeInterval,
  getSoilGaugeState,
  nextWaterDate,
  startOfDay,
  toCalendarDate,
} from '../engine';
import type {
  CalendarDate,
  Coefficients,
  EnginePlant,
  EngineSpace,
  IntervalResult,
  LoggedSoilState,
  Season,
  SoilGaugeState,
} from '../engine';

/** "다가옴"에 보여 줄 범위: 3일 내 예정 (3.2) */
export const UPCOMING_DAYS = 3;

const MS_PER_HOUR = 3_600_000;

export interface TodayItem extends PlantWithSpace {
  soil: SoilGaugeState;
}

export interface TodaySections {
  /** 예정일이 지난 식물. 많이 밀린 것부터 */
  overdue: TodayItem[];
  /** 오늘 물 줄 식물 */
  due: TodayItem[];
  /** 3일 안에 예정된 식물. 가까운 것부터 */
  upcoming: TodayItem[];
  /** 오늘 물을 준 식물 */
  done: TodayItem[];
}

const sameDate = (a: CalendarDate, b: CalendarDate) =>
  a.year === b.year && a.month === b.month && a.day === b.day;

/** 식물 하나의 흙 게이지 상태. 물주기 날짜는 기기 로컬 날짜로 센다 (12.2) */
export function classifyPlant(plant: Plant, now: number, utcOffsetMinutes: number): SoilGaugeState {
  return getSoilGaugeState(
    toCalendarDate(plant.lastWateredAt, utcOffsetMinutes),
    toCalendarDate(plant.nextWaterAt ?? plant.lastWateredAt, utcOffsetMinutes),
    toCalendarDate(now, utcOffsetMinutes),
  );
}

/** 물주기 날짜는 기기 로컬 날짜로 센다 (12.2). utcOffsetMinutes 는 기기 시간대의 오프셋 */
export function classifyToday(
  items: readonly PlantWithSpace[],
  now: number,
  utcOffsetMinutes: number,
): TodaySections {
  const today = toCalendarDate(now, utcOffsetMinutes);
  const sections: TodaySections = { overdue: [], due: [], upcoming: [], done: [] };

  for (const { plant, space } of items) {
    const lastWatered = toCalendarDate(plant.lastWateredAt, utcOffsetMinutes);
    const soil = classifyPlant(plant, now, utcOffsetMinutes);
    const entry = { plant, space, soil };

    if (sameDate(lastWatered, today) && !plant.lastWateredUnknown) {
      sections.done.push(entry);
    } else if (soil.status === 'overdue') {
      sections.overdue.push(entry);
    } else if (soil.status === 'due') {
      sections.due.push(entry);
    } else if (soil.daysLeft <= UPCOMING_DAYS) {
      sections.upcoming.push(entry);
    }
  }

  const byDaysLeft = (a: TodayItem, b: TodayItem) => a.soil.daysLeft - b.soil.daysLeft;
  sections.overdue.sort(byDaysLeft);
  sections.upcoming.sort(byDaysLeft);
  return sections;
}

/** 저장된 식물을 엔진 입력으로 */
export function toEnginePlant(plant: Plant): EnginePlant {
  return {
    groupCode: plant.groupCode,
    potSize: plant.potSize,
    soilType: plant.soilType,
    learnFactor: plant.learnFactor,
    baseInterval: plant.baseInterval,
    manualInterval: plant.manualInterval,
  };
}

export interface WateringInput {
  soilState: LoggedSoilState;
  leafDroop: boolean;
}

export interface WateringContext {
  now: number;
  /** 기기 시간대의 UTC 오프셋(분) */
  utcOffsetMinutes: number;
  /** Asia/Seoul 날짜로 판정한 지금의 계절 */
  season: Season;
  coefficients: Coefficients;
  logId: string;
}

export interface WateringPlan {
  plantPatch: Pick<
    Plant,
    'learnFactor' | 'lastWateredAt' | 'lastWateredUnknown' | 'nextWaterAt' | 'postponeCount'
  >;
  log: NewWateringLog;
  /** 새 U 로 다시 계산한 주기 */
  result: IntervalResult;
}

/**
 * "물 줬어요": 흙 상태로 U 를 갱신하고 오늘부터 다음 물주기를 다시 센다.
 * 분재는 "말랐음 / 아직 촉촉" 두 가지로 답한다 (6.1).
 * 밀린 식물이어도 밀린 일수는 학습에 넣지 않는다 (5.5). 수경과 수동 고정은 배우지 않는다.
 * 기록의 interval_calc·factor_snapshot 은 이때 새로 계산한 값이다. 다음 기록과의 간격과 견주어 통계를 낸다 (3.5).
 */
export function planWatering(
  plant: Plant,
  space: EngineSpace,
  input: WateringInput,
  context: WateringContext,
): WateringPlan {
  const { coefficients, season, now, utcOffsetMinutes } = context;
  const enginePlant = toEnginePlant(plant);
  const learns = computeInterval(enginePlant, space, season, coefficients).mode === 'computed';
  // 분재는 흙 3택 대신 "말랐음 / 아직 촉촉" 두 가지로 답한다 (6.1).
  // 촉촉 응답 자체가 주기를 늘리고, 말랐음은 배운 값을 그대로 둔다
  const forLearning =
    plant.isBonsai && input.soilState === 'dry' ? 'ok' : input.soilState;
  const learnFactor = learns
    ? applyFeedback(plant.learnFactor, forLearning, input.leafDroop, coefficients)
    : plant.learnFactor;

  const result = computeInterval({ ...enginePlant, learnFactor }, space, season, coefficients);
  const today = toCalendarDate(now, utcOffsetMinutes);

  return {
    plantPatch: {
      learnFactor,
      // 날짜만 의미가 있으므로 시간대가 조금 어긋나도 날짜가 바뀌지 않게 정오로 둔다
      lastWateredAt: startOfDay(today, utcOffsetMinutes) + 12 * MS_PER_HOUR,
      lastWateredUnknown: false,
      nextWaterAt: startOfDay(nextWaterDate(today, result.days), utcOffsetMinutes),
      postponeCount: 0,
    },
    log: {
      id: context.logId,
      plantId: plant.id,
      wateredAt: now,
      // 수경은 흙이 없다
      soilState: plant.soilType === 'hydro' ? 'skipped' : input.soilState,
      leafDroop: plant.soilType === 'hydro' ? false : input.leafDroop,
      source: 'user',
      intervalCalc: result.interval,
      factorSnapshot: result.mode === 'computed' ? result.factors : null,
    },
    result,
  };
}

/** "내일로": 다음 물주기를 하루 미룬다. 최대 횟수를 채웠으면 null 이고 그대로 두어 밀림이 된다 */
export function planPostpone(
  plant: Plant,
  context: Pick<WateringContext, 'now' | 'utcOffsetMinutes' | 'coefficients'>,
): Pick<Plant, 'nextWaterAt' | 'postponeCount'> | null {
  if (!canPostpone(plant.postponeCount, context.coefficients)) return null;

  const today = toCalendarDate(context.now, context.utcOffsetMinutes);
  return {
    nextWaterAt: startOfDay(addDays(today, 1), context.utcOffsetMinutes),
    postponeCount: plant.postponeCount + 1,
  };
}

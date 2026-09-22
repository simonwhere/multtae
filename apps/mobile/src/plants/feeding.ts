/**
 * 비료와 분갈이 (SPEC.md 8.2, 8.3). 서버를 부르지 않고 종 DB 규칙과 기록만으로 정한다.
 * 화면·DB 와 떼어 낸 순수 함수다.
 */
import type { Plant, SpeciesCacheRow, WateringLog } from '../db/schema';
import { diffDays } from '../engine';
import type { CalendarDate, GroupCode, Season } from '../engine';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** 8.2 식물군별 기본값. 종 DB 에 비료 규칙이 있으면 그것을 쓴다 */
const GROUP_FERTILIZER: Record<GroupCode, { months: readonly number[]; weeks: number }> = {
  tropical: { months: range(4, 10), weeks: 4 },
  temperate: { months: range(4, 10), weeks: 4 },
  succulent: { months: [4, 5, 6, 9, 10], weeks: 8 },
  herb: { months: range(3, 10), weeks: 2 },
  bonsai_conifer: { months: [4, 5, 6, 9, 10], weeks: 4 },
  bonsai_deciduous: { months: [4, 5, 6, 9, 10], weeks: 4 },
};

/** 장마·폭염·겨울에는 비료를 쉰다 (8.2) */
export const FERTILIZER_PAUSED_SEASONS: readonly Season[] = ['monsoon', 'heat', 'winter'];
/** 분갈이 뒤 4주는 비료를 쉰다 (8.2, 8.3) */
export const REPOT_FERTILIZER_PAUSE_DAYS = 28;

export interface FertilizerRule {
  months: readonly number[];
  intervalDays: number;
}

function speciesFertilizer(value: unknown): FertilizerRule | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as { months?: unknown; interval_weeks?: unknown };
  const months = Array.isArray(raw.months)
    ? raw.months.filter((month): month is number => Number.isInteger(month) && month >= 1 && month <= 12)
    : [];
  const weeks = raw.interval_weeks;
  if (months.length === 0 || typeof weeks !== 'number' || !(weeks > 0)) return null;
  return { months, intervalDays: Math.round(weeks * 7) };
}

/** 이 식물의 비료 규칙. 종 DB 가 먼저고, 없거나 모양이 틀리면 식물군 기본값 */
export function fertilizerRule(
  plant: Pick<Plant, 'groupCode'>,
  species: Pick<SpeciesCacheRow, 'fertilizer'> | null,
): FertilizerRule {
  const group = GROUP_FERTILIZER[plant.groupCode];
  return speciesFertilizer(species?.fertilizer) ?? { months: group.months, intervalDays: group.weeks * 7 };
}

/**
 * 그날 물을 줄 때 비료도 함께 줄 때인가 (8.2).
 * 쉬는 계절이 아니고, 비료 주는 달이고, 분갈이한 지 4주가 지났고, 마지막 비료에서 간격이 찼다.
 */
export function isFertilizerDue(
  rule: FertilizerRule,
  history: { lastFertilized: CalendarDate | null; lastRepot: CalendarDate | null },
  date: CalendarDate,
  season: Season,
): boolean {
  if (FERTILIZER_PAUSED_SEASONS.includes(season)) return false;
  if (!rule.months.includes(date.month)) return false;
  if (history.lastRepot && diffDays(history.lastRepot, date) < REPOT_FERTILIZER_PAUSE_DAYS) return false;
  return history.lastFertilized === null || diffDays(history.lastFertilized, date) >= rule.intervalDays;
}

/** 8.3 식물군별 권장 분갈이 주기(개월). 분재는 수종별 작업 캘린더(6.2)가 맡는다 */
const GROUP_REPOT_MONTHS: Record<GroupCode, number | null> = {
  succulent: 24,
  tropical: 18,
  temperate: 18,
  herb: 12,
  bonsai_conifer: null,
  bonsai_deciduous: null,
};
/** 대부분의 식물은 3~4월이 적기다 (8.3) */
const DEFAULT_REPOT_SEASON: readonly number[] = [3, 4];
/** "바싹 말랐음"이 최근 5번 가운데 4번 이상이면 뿌리가 찼을 수 있다 (8.3) */
export const ROOTS_WINDOW = 5;
export const ROOTS_DRY = 4;

export type RepotHint =
  /** 권장 주기가 지났고 적기다. known 이 false 면 마지막 분갈이를 몰라 등록일부터 셌다 */
  | { reason: 'interval'; months: number; known: boolean; season: readonly number[] }
  /** 흙이 자꾸 바싹 마른다. 주기와 무관하다 */
  | { reason: 'roots' };

/** 두 날짜 사이의 온전한 달 수 */
export function monthsBetween(from: CalendarDate, to: CalendarDate): number {
  return (to.year - from.year) * 12 + (to.month - from.month) - (to.day < from.day ? 1 : 0);
}

/** 분갈이를 생각해 볼 때인가 (8.3). 분재와 수경은 이 규칙을 쓰지 않는다 */
export function repotHint(
  plant: Pick<Plant, 'groupCode' | 'isBonsai' | 'soilType'>,
  species: Pick<SpeciesCacheRow, 'repotMonths' | 'repotSeason'> | null,
  history: {
    /** 마지막 분갈이. 모르면 등록일 */
    since: CalendarDate;
    known: boolean;
    /** 최근 물주기 기록, 최근 것부터 */
    recent: readonly Pick<WateringLog, 'soilState' | 'source'>[];
  },
  date: CalendarDate,
): RepotHint | null {
  if (plant.isBonsai || plant.soilType === 'hydro') return null;

  const recommended = species?.repotMonths ?? GROUP_REPOT_MONTHS[plant.groupCode];
  const season =
    species?.repotSeason && species.repotSeason.length > 0 ? species.repotSeason : DEFAULT_REPOT_SEASON;
  const months = monthsBetween(history.since, date);
  if (recommended !== null && months >= recommended && season.includes(date.month)) {
    return { reason: 'interval', months, known: history.known, season };
  }

  // 흙 상태를 답한 물주기만 본다
  const answered = history.recent
    .filter((log) => log.source === 'user' && log.soilState !== 'skipped')
    .slice(0, ROOTS_WINDOW);
  const dry = answered.filter((log) => log.soilState === 'dry').length;
  if (answered.length >= ROOTS_WINDOW && dry >= ROOTS_DRY) return { reason: 'roots' };

  return null;
}

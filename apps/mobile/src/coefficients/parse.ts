/**
 * 서버 coefficients 테이블의 행(key, value jsonb)과 엔진 계수 사이의 변환 (SPEC.md 5장, 11.2).
 * 서버는 snake_case, 엔진은 camelCase 다. 서버 값은 믿지 않고 전부 검사해서, 하나라도 이상하면 통째로 버린다.
 * 화면·DB 와 무관한 순수 함수라 Node 에서 테스트한다.
 */
import {
  COEFFICIENTS_SCHEMA_VERSION,
  GROUP_CODES,
  LIGHT_GRADES,
  POT_SIZES,
  SEASONS,
  SOIL_STATES,
  SPACE_TYPES,
} from '../engine';
import type { Coefficients, MonthDay } from '../engine';

export interface CoefficientRow {
  key: string;
  value: unknown;
}

const MULTIPLIER_SOILS = ['potting', 'gritty', 'akadama'] as const;
/** 계절 경계의 날짜 검사에 쓰는 윤년. 2월 29일까지 받는다 */
const LEAP_YEAR = 2024;

export function toServerRows(c: Coefficients): CoefficientRow[] {
  return [
    { key: 'version', value: c.version },
    { key: 'base_interval', value: c.baseInterval },
    { key: 'season', value: c.season },
    { key: 'pot', value: c.pot },
    { key: 'light', value: c.light },
    { key: 'space_type', value: c.spaceType },
    { key: 'soil', value: c.soil },
    { key: 'hydro_fixed_days', value: c.hydroFixedDays },
    { key: 'interval_clamp', value: c.intervalClamp },
    {
      key: 'learning',
      value: {
        initial: c.learning.initial,
        min: c.learning.min,
        max: c.learning.max,
        soil_state: c.learning.soilState,
        leaf_droop: c.learning.leafDroop,
        streak_notice: c.learning.streakNotice,
      },
    },
    { key: 'max_postpones', value: c.maxPostpones },
    { key: 'season_bounds', value: c.seasonBounds },
  ];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/** 정해진 키가 모두 있고 값이 모두 양수인 표 */
function table<K extends string>(value: unknown, keys: readonly K[]): Record<K, number> | null {
  if (!isObject(value)) return null;
  const result = {} as Record<K, number>;
  for (const key of keys) {
    const cell = value[key];
    if (!isPositive(cell)) return null;
    result[key] = cell;
  }
  return result;
}

function monthDay(value: unknown): MonthDay | null {
  if (!isObject(value) || !Number.isInteger(value.month) || !Number.isInteger(value.day)) return null;
  const { month, day } = value as { month: number; day: number };
  const date = new Date(Date.UTC(LEAP_YEAR, month - 1, day));
  // 없는 날짜는 Date 가 다음 달로 넘긴다
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { month, day } : null;
}

/** 서버에서 받은 행을 엔진 계수로. 빠지거나 이상한 값이 하나라도 있으면 null */
export function parseServerRows(rows: unknown): Coefficients | null {
  if (!Array.isArray(rows)) return null;
  const byKey = new Map<string, unknown>();
  for (const row of rows) {
    if (!isObject(row) || typeof row.key !== 'string') return null;
    byKey.set(row.key, row.value);
  }

  const version = byKey.get('version');
  // 앱이 모르는 새 스키마는 잘못 읽을 수 있으니 번들 기본값으로 돈다
  if (!isPositive(version) || version > COEFFICIENTS_SCHEMA_VERSION) return null;

  const baseInterval = table(byKey.get('base_interval'), GROUP_CODES);
  const pot = table(byKey.get('pot'), POT_SIZES);
  const light = table(byKey.get('light'), LIGHT_GRADES);
  const spaceType = table(byKey.get('space_type'), SPACE_TYPES);
  const soil = table(byKey.get('soil'), MULTIPLIER_SOILS);
  const intervalClamp = table(byKey.get('interval_clamp'), ['min', 'max']);
  const hydroFixedDays = byKey.get('hydro_fixed_days');
  const maxPostpones = byKey.get('max_postpones');

  const rawSeason = byKey.get('season');
  const season = {} as Coefficients['season'];
  for (const group of GROUP_CODES) {
    const cells = table(isObject(rawSeason) ? rawSeason[group] : null, SEASONS);
    if (!cells) return null;
    season[group] = cells;
  }

  const rawBounds = byKey.get('season_bounds');
  const seasonBounds = {} as Coefficients['seasonBounds'];
  for (const name of SEASONS) {
    const start = monthDay(isObject(rawBounds) ? rawBounds[name] : null);
    if (!start) return null;
    seasonBounds[name] = start;
  }

  const rawLearning = byKey.get('learning');
  const learningRange = table(rawLearning, ['initial', 'min', 'max']);
  const soilState = table(isObject(rawLearning) ? rawLearning.soil_state : null, SOIL_STATES);
  const leafDroop = isObject(rawLearning) ? rawLearning.leaf_droop : null;
  const streakNotice = isObject(rawLearning) ? rawLearning.streak_notice : null;

  if (
    !baseInterval ||
    !pot ||
    !light ||
    !spaceType ||
    !soil ||
    !intervalClamp ||
    intervalClamp.min > intervalClamp.max ||
    !isPositive(hydroFixedDays) ||
    !isCount(maxPostpones) ||
    !learningRange ||
    learningRange.min > learningRange.max ||
    !soilState ||
    !isPositive(leafDroop) ||
    !isCount(streakNotice) ||
    streakNotice < 1
  ) {
    return null;
  }

  return {
    version,
    baseInterval,
    season,
    pot,
    light,
    spaceType,
    soil,
    hydroFixedDays,
    intervalClamp: { min: intervalClamp.min, max: intervalClamp.max },
    learning: {
      initial: learningRange.initial,
      min: learningRange.min,
      max: learningRange.max,
      soilState,
      leafDroop,
      streakNotice,
    },
    maxPostpones,
    seasonBounds,
  };
}

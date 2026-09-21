import { describe, expect, it } from 'vitest';

import { COEFFICIENTS_SCHEMA_VERSION, DEFAULT_COEFFICIENTS } from '../engine';
import { parseServerRows, toServerRows } from './parse';
import type { CoefficientRow } from './parse';

const rows = () => toServerRows(DEFAULT_COEFFICIENTS);
const replace = (key: string, value: unknown): CoefficientRow[] =>
  rows().map((row) => (row.key === key ? { key, value } : row));

describe('toServerRows: 서버 coefficients 테이블의 행 (SPEC.md 11.2)', () => {
  it('키와 안쪽 이름은 snake_case 다', () => {
    const byKey = Object.fromEntries(rows().map((row) => [row.key, row.value]));

    expect(Object.keys(byKey).sort()).toEqual([
      'base_interval',
      'hydro_fixed_days',
      'interval_clamp',
      'learning',
      'light',
      'max_postpones',
      'pot',
      'season',
      'season_bounds',
      'soil',
      'space_type',
      'version',
    ]);
    expect(byKey.max_postpones).toBe(3);
    expect(byKey.learning).toEqual({
      initial: 1,
      min: 0.5,
      max: 2,
      soil_state: { wet: 1.15, ok: 1, dry: 0.85 },
      leaf_droop: 0.9,
      streak_notice: 3,
    });
    expect(byKey.season_bounds).toMatchObject({ winter: { month: 11, day: 16 } });
  });
});

describe('parseServerRows: 서버 값을 엔진 계수로', () => {
  it('번들 기본값을 행으로 바꿨다가 되읽으면 그대로다', () => {
    expect(parseServerRows(rows())).toEqual(DEFAULT_COEFFICIENTS);
  });

  it('서버에서 값을 고치면 앱 업데이트 없이 반영된다 (5장)', () => {
    const tuned = parseServerRows(replace('max_postpones', 2));

    expect(tuned?.maxPostpones).toBe(2);
    expect(tuned?.baseInterval).toEqual(DEFAULT_COEFFICIENTS.baseInterval);
  });

  it('앱이 모르는 키(서버 한도값 등)는 무시한다', () => {
    const withLimits = [...rows(), { key: 'diagnose_daily_limit', value: 3 }];

    expect(parseServerRows(withLimits)).toEqual(DEFAULT_COEFFICIENTS);
  });

  it('빠진 키가 있으면 받지 않는다', () => {
    expect(parseServerRows(rows().filter((row) => row.key !== 'pot'))).toBeNull();
    expect(parseServerRows([])).toBeNull();
  });

  it('숫자가 아니거나 0 이하인 값은 받지 않는다', () => {
    expect(parseServerRows(replace('hydro_fixed_days', '7'))).toBeNull();
    expect(parseServerRows(replace('hydro_fixed_days', 0))).toBeNull();
    expect(parseServerRows(replace('pot', { s: 0.7, m: 1, l: 1.3, xl: Number.NaN }))).toBeNull();
    expect(parseServerRows(replace('light', { high: 0.8, medium: -1, low: 1.3, very_low: 1.6 }))).toBeNull();
  });

  it('표에 빠진 칸이 있으면 받지 않는다', () => {
    const season = { ...(rows().find((row) => row.key === 'season')?.value as object), herb: { spring: 1 } };

    expect(parseServerRows(replace('season', season))).toBeNull();
    expect(parseServerRows(replace('pot', { s: 0.7, m: 1, l: 1.3 }))).toBeNull();
  });

  it('범위가 뒤집힌 값은 받지 않는다', () => {
    expect(parseServerRows(replace('interval_clamp', { min: 60, max: 1 }))).toBeNull();
    expect(
      parseServerRows(
        replace('learning', {
          initial: 1,
          min: 2,
          max: 0.5,
          soil_state: { wet: 1.15, ok: 1, dry: 0.85 },
          leaf_droop: 0.9,
          streak_notice: 3,
        }),
      ),
    ).toBeNull();
  });

  it('없는 날짜의 계절 경계는 받지 않는다', () => {
    const bounds = { ...DEFAULT_COEFFICIENTS.seasonBounds, spring: { month: 2, day: 30 } };

    expect(parseServerRows(replace('season_bounds', bounds))).toBeNull();
  });

  it('앱이 아는 것보다 높은 스키마 버전은 받지 않는다. 번들 기본값으로 돈다', () => {
    expect(parseServerRows(replace('version', COEFFICIENTS_SCHEMA_VERSION + 1))).toBeNull();
  });

  it('행이 배열이 아니거나 모양이 다르면 받지 않는다', () => {
    expect(parseServerRows(null)).toBeNull();
    expect(parseServerRows({ key: 'pot' })).toBeNull();
    expect(parseServerRows([{ key: 1, value: 2 }])).toBeNull();
  });
});

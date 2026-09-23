import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_COEFFICIENTS } from '../engine';
import { renderCoefficientsSeed } from './seed';

const ROOT = resolve(__dirname, '../../../..');
const SEED_PATH = resolve(ROOT, 'supabase/seed/coefficients.sql');
const MIGRATION_PATH = resolve(ROOT, 'supabase/migrations/20260921000000_init.sql');

describe('supabase/seed/coefficients.sql', () => {
  it('번들 기본값과 같다. 다르면 pnpm seed:coefficients 로 다시 만든다', () => {
    const expected = renderCoefficientsSeed(DEFAULT_COEFFICIENTS);
    if (process.env.UPDATE_SEED === '1') writeFileSync(SEED_PATH, expected);

    expect(existsSync(SEED_PATH)).toBe(true);
    expect(readFileSync(SEED_PATH, 'utf8')).toBe(expected);
  });

  it('행마다 (키, jsonb 값) 모양이고 앱이 읽는 계수와 서버 한도값이 모두 들어 있다', () => {
    const lines = renderCoefficientsSeed(DEFAULT_COEFFICIENTS)
      .split('\n')
      .filter((line) => line.startsWith('  ('));

    expect(lines).toHaveLength(18);
    for (const line of lines) {
      expect(line).toMatch(/^ {2}\('[a-z_]+', '[^']+'::jsonb\),?$/);
    }
  });
});

describe('supabase/migrations: 모든 테이블에 RLS 를 켠다 (SPEC.md 11.2)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);

  it('SPEC 의 여섯 테이블이 있다', () => {
    expect(tables.sort()).toEqual([
      'coefficients',
      'season_bounds',
      'species',
      'species_reports',
      'usage_counters',
      'weather_cache',
    ]);
  });

  it.each(tables)('%s', (table) => {
    expect(sql).toContain(`alter table public.${table} enable row level security;`);
  });

  it('앱(anon)은 종·계수·계절 경계를 읽기만 하고, 신고는 넣기만 한다', () => {
    const policies = [...sql.matchAll(/on public\.(\w+) for (\w+) to anon/g)].map(
      (match) => `${match[1]}:${match[2]}`,
    );

    expect(policies.sort()).toEqual([
      'coefficients:select',
      'season_bounds:select',
      'species:select',
      'species_reports:insert',
    ]);
  });

  it('사용자 사진·식물·공간을 담는 테이블은 없다', () => {
    expect(sql).not.toMatch(/create table public\.(plants|spaces|photos|watering_logs|users)/);
  });
});

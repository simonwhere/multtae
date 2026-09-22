import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSetting, setSetting } from '../db/settings';
import { createTestDb } from '../db/testing/test-db';
import type { TestDb } from '../db/testing/test-db';
import type { Weather } from './forecast';
import { loadCachedWeather, refreshWeather } from './refresh';

const HOUR = 3_600_000;
const now = Date.UTC(2026, 8, 22, 3);

const weather = (patch: Partial<Weather> = {}): Weather => ({
  region: '서울 강남구',
  fetchedAt: now,
  days: [{ date: '2026-09-22', tmin: 14, tmax: 25, pop: 30, pcp: 0, windMax: 3, condition: 'clear' }],
  dust: 'good',
  ...patch,
});

let db: TestDb;

beforeEach(() => {
  ({ db } = createTestDb());
});

describe('refreshWeather (SPEC.md 7.1)', () => {
  it('지역을 고르지 않았으면 부르지 않는다', async () => {
    const fetcher = vi.fn();

    expect(await refreshWeather(db, fetcher, { now })).toEqual({ status: 'no_region' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('새 예보를 받아 저장한다', async () => {
    await setSetting(db, 'region_code', '서울 강남구');
    const fetcher = vi.fn().mockResolvedValue({ kind: 'weather', weather: weather() });

    expect(await refreshWeather(db, fetcher, { now })).toEqual({ status: 'updated', weather: weather() });
    expect(fetcher).toHaveBeenCalledWith('서울 강남구');
    expect(await loadCachedWeather(db)).toEqual(weather());
  });

  it('받은 지 3시간이 안 됐으면 다시 묻지 않는다. force 면 묻는다', async () => {
    await setSetting(db, 'region_code', '서울 강남구');
    await setSetting(db, 'weather_cache', JSON.stringify(weather({ fetchedAt: now - HOUR })));
    const fetcher = vi.fn().mockResolvedValue({ kind: 'weather', weather: weather() });

    expect((await refreshWeather(db, fetcher, { now })).status).toBe('fresh');
    expect(fetcher).not.toHaveBeenCalled();

    expect((await refreshWeather(db, fetcher, { now, force: true })).status).toBe('updated');
  });

  it('못 받으면 같은 지역의 지난 값을 그대로 둔다', async () => {
    const old = weather({ fetchedAt: now - 5 * HOUR });
    await setSetting(db, 'region_code', '서울 강남구');
    await setSetting(db, 'weather_cache', JSON.stringify(old));

    expect(
      await refreshWeather(db, vi.fn().mockResolvedValue({ kind: 'unavailable' }), { now }),
    ).toEqual({ status: 'failed', weather: old });
    expect(await loadCachedWeather(db)).toEqual(old);
  });

  it('지역을 바꿨으면 전 지역의 날씨는 쓰지 않는다', async () => {
    await setSetting(db, 'region_code', '부산 중구');
    await setSetting(db, 'weather_cache', JSON.stringify(weather()));

    expect(
      await refreshWeather(db, vi.fn().mockResolvedValue({ kind: 'not_configured' }), { now }),
    ).toEqual({ status: 'not_configured', weather: null });
  });

  it('저장한 값이 깨졌으면 없는 것으로 본다', async () => {
    await setSetting(db, 'weather_cache', '{broken');

    expect(await loadCachedWeather(db)).toBeNull();
    expect(await getSetting(db, 'weather_cache')).toBe('{broken');
  });
});

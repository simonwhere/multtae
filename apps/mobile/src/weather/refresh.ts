/**
 * 날씨를 받아 저장한다 (SPEC.md 7.1). 앱이 앞으로 올 때와 백그라운드 작업이 부른다.
 * 서버 캐시가 3시간이라 그보다 자주 묻지 않는다. 못 받으면 지난 값을 그대로 둔다.
 */
import type { WeatherOutcome } from '../api/weather';
import { getSetting, setSetting } from '../db/settings';
import type { Database } from '../db/types';
import { parseJsonObject } from '../lib/validate';
import { isWeatherUsable, needsRefresh, parseWeather } from './forecast';
import type { Weather } from './forecast';
import { findRegion } from './regions';

export type WeatherRefresh =
  /** 새 예보를 받아 저장했다 */
  | { status: 'updated'; weather: Weather }
  /** 받은 지 얼마 안 돼 그대로 쓴다 */
  | { status: 'fresh'; weather: Weather }
  /** 지역을 고르지 않았다 */
  | { status: 'no_region' }
  /** 서버에 날씨 키가 없다 */
  | { status: 'not_configured'; weather: Weather | null }
  /** 받지 못했다. 같은 지역의 지난 값이 있으면 함께 준다 */
  | { status: 'failed'; weather: Weather | null };

export async function loadCachedWeather(db: Database): Promise<Weather | null> {
  return parseWeather(parseJsonObject(await getSetting(db, 'weather_cache')));
}

/**
 * 날씨 규칙(7.2)에 쓸 날씨. 지금 고른 지역의 것이고, 48시간 안에 받았고, 기기가 한국 시간일 때만.
 * 아니면 null 이고 날씨 규칙은 쉬고 계절 카드만 돈다.
 */
export async function loadUsableWeather(
  db: Database,
  now: number,
  utcOffsetMinutes: number,
): Promise<Weather | null> {
  const [weather, regionId] = await Promise.all([
    loadCachedWeather(db),
    getSetting(db, 'region_code'),
  ]);
  return weather && weather.region === regionId && isWeatherUsable(weather, now, utcOffsetMinutes)
    ? weather
    : null;
}

export async function refreshWeather(
  db: Database,
  fetcher: (regionId: string) => Promise<WeatherOutcome>,
  { now = Date.now(), force = false }: { now?: number; force?: boolean } = {},
): Promise<WeatherRefresh> {
  const region = findRegion(await getSetting(db, 'region_code'));
  if (!region) return { status: 'no_region' };

  const cached = await loadCachedWeather(db);
  // 지역을 바꿨으면 전 지역의 날씨는 쓰지 않는다
  const sameRegion = cached?.region === region.id ? cached : null;
  if (!force && sameRegion && !needsRefresh(sameRegion, region.id, now)) {
    return { status: 'fresh', weather: sameRegion };
  }

  const outcome = await fetcher(region.id);
  if (outcome.kind === 'weather') {
    await setSetting(db, 'weather_cache', JSON.stringify(outcome.weather));
    return { status: 'updated', weather: outcome.weather };
  }
  return outcome.kind === 'not_configured'
    ? { status: 'not_configured', weather: sameRegion }
    : { status: 'failed', weather: sameRegion };
}

/**
 * 앱이 받은 날씨 (SPEC.md 7.1). 서버 응답과 settings.weather_cache 에 저장한 값을 같은 함수로 읽는다.
 * 저장된 값은 앱을 고치는 사이에 모양이 어긋날 수 있어 늘 확인하고 쓴다.
 */
import type { CalendarDate } from '../engine';
import { isOneOf } from '../lib/validate';

export const CONDITIONS = ['clear', 'cloudy', 'overcast', 'rain', 'snow'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const DUST_GRADES = ['good', 'moderate', 'bad', 'very_bad'] as const;
export type DustGrade = (typeof DUST_GRADES)[number];

export interface DayForecast {
  /** YYYY-MM-DD (한국 날짜) */
  date: string;
  tmin: number | null;
  tmax: number | null;
  /** 가장 높은 강수확률(%) */
  pop: number;
  /** 강수량 합(mm) */
  pcp: number;
  /** 가장 센 바람(m/s) */
  windMax: number | null;
  condition: Condition | null;
}

export interface Weather {
  /** 지역 id ("서울 강남구") */
  region: string;
  /** 서버가 예보를 받은 시각 */
  fetchedAt: number;
  days: DayForecast[];
  /** 오늘 미세먼지 예보 */
  dust: DustGrade | null;
}

/** 이보다 오래 새 예보를 못 받으면 날씨 기능을 끈다 (7.1) */
export const WEATHER_OFF_HOURS = 48;
/** 서버 캐시와 같은 간격. 이보다 자주 물어봐야 같은 값이 온다 */
export const WEATHER_REFRESH_HOURS = 3;
/** 날씨 기능은 한국 시간에서만 켠다 (12.2 시간대) */
export const KST_OFFSET_MINUTES = 540;

const MS_PER_HOUR = 3_600_000;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const numberOrNull = (value: unknown): number | null => (isNumber(value) ? value : null);

function parseDay(value: unknown): DayForecast | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;

  return {
    date: raw.date,
    tmin: numberOrNull(raw.tmin),
    tmax: numberOrNull(raw.tmax),
    pop: isNumber(raw.pop) ? raw.pop : 0,
    pcp: isNumber(raw.pcp) ? raw.pcp : 0,
    windMax: numberOrNull(raw.windMax),
    condition: isOneOf(CONDITIONS, raw.condition) ? raw.condition : null,
  };
}

/** 모양이 맞으면 날씨, 아니면 null. 날짜 하나가 깨졌으면 그날만 버린다 */
export function parseWeather(value: unknown): Weather | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.region !== 'string' || !isNumber(raw.fetchedAt) || !Array.isArray(raw.days)) {
    return null;
  }

  return {
    region: raw.region,
    fetchedAt: raw.fetchedAt,
    days: raw.days.map(parseDay).filter((day): day is DayForecast => day !== null),
    dust: isOneOf(DUST_GRADES, raw.dust) ? raw.dust : null,
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

export function dateKey(date: CalendarDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** 그날의 예보. 없으면 null */
export function dayOf(weather: Weather | null, date: CalendarDate): DayForecast | null {
  return weather?.days.find((day) => day.date === dateKey(date)) ?? null;
}

/** 날씨를 쓸 수 있는가: 한국 시간이고, 48시간 안에 받은 예보가 있다 */
export function isWeatherUsable(
  weather: Weather | null,
  now: number,
  utcOffsetMinutes: number,
): weather is Weather {
  return (
    weather !== null &&
    utcOffsetMinutes === KST_OFFSET_MINUTES &&
    now - weather.fetchedAt < WEATHER_OFF_HOURS * MS_PER_HOUR
  );
}

/** 서버에 다시 물어볼 때인가. 지역을 바꿨거나 받은 지 3시간이 지났다 */
export function needsRefresh(weather: Weather | null, regionId: string, now: number): boolean {
  return (
    weather === null ||
    weather.region !== regionId ||
    now - weather.fetchedAt >= WEATHER_REFRESH_HOURS * MS_PER_HOUR ||
    weather.fetchedAt > now
  );
}

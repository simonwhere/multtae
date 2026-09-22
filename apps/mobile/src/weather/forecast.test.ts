import { describe, expect, it } from 'vitest';

import {
  dateKey,
  dayOf,
  temperatureSummary,
  isWeatherUsable,
  needsRefresh,
  parseWeather,
  WEATHER_OFF_HOURS,
} from './forecast';
import type { Weather } from './forecast';

const HOUR = 3_600_000;
const now = Date.UTC(2026, 8, 22, 3); // 9/22 12:00 KST

const weather: Weather = {
  region: '서울 강남구',
  fetchedAt: now - HOUR,
  days: [
    { date: '2026-09-22', tmin: 14, tmax: 25, pop: 30, pcp: 0, windMax: 3.1, condition: 'clear' },
    { date: '2026-09-23', tmin: 12, tmax: 22, pop: 80, pcp: 12, windMax: 8, condition: 'rain' },
  ],
  dust: 'moderate',
};

describe('parseWeather (SPEC.md 7.1)', () => {
  it('서버 응답과 저장한 값을 그대로 읽는다', () => {
    expect(parseWeather(weather)).toEqual(weather);
    expect(parseWeather(JSON.parse(JSON.stringify(weather)))).toEqual(weather);
  });

  it('모양이 틀리면 null', () => {
    expect(parseWeather(null)).toBeNull();
    expect(parseWeather([])).toBeNull();
    expect(parseWeather({ ...weather, fetchedAt: 'now' })).toBeNull();
    expect(parseWeather({ ...weather, days: 'many' })).toBeNull();
  });

  it('깨진 날은 버리고, 모르는 값은 비운다', () => {
    const parsed = parseWeather({
      ...weather,
      dust: 'terrible',
      days: [
        { date: '9/22' },
        { date: '2026-09-22', tmin: 'cold', pop: null, condition: 'fog' },
      ],
    });

    expect(parsed).toEqual({
      ...weather,
      dust: null,
      days: [
        { date: '2026-09-22', tmin: null, tmax: null, pop: 0, pcp: 0, windMax: null, condition: null },
      ],
    });
  });
});

describe('날짜로 찾기', () => {
  it('그날의 예보. 없으면 null', () => {
    expect(dateKey({ year: 2026, month: 9, day: 3 })).toBe('2026-09-03');
    expect(dayOf(weather, { year: 2026, month: 9, day: 23 })?.pop).toBe(80);
    expect(dayOf(weather, { year: 2026, month: 9, day: 30 })).toBeNull();
    expect(dayOf(null, { year: 2026, month: 9, day: 22 })).toBeNull();
  });
});

describe('isWeatherUsable: 한국 시간이고 48시간 안에 받은 예보가 있을 때만 (SPEC.md 7.1, 12.2)', () => {
  it('받은 지 48시간이 넘으면 끈다', () => {
    expect(isWeatherUsable(weather, now, 540)).toBe(true);
    expect(isWeatherUsable({ ...weather, fetchedAt: now - WEATHER_OFF_HOURS * HOUR }, now, 540)).toBe(
      false,
    );
    expect(isWeatherUsable(null, now, 540)).toBe(false);
  });

  it('기기가 한국 시간이 아니면 끈다', () => {
    expect(isWeatherUsable(weather, now, 0)).toBe(false);
    expect(isWeatherUsable(weather, now, -420)).toBe(false);
  });
});

describe('needsRefresh: 서버에 다시 물어볼 때', () => {
  it('받은 적 없거나, 지역이 바뀌었거나, 3시간이 지났다', () => {
    expect(needsRefresh(null, '서울 강남구', now)).toBe(true);
    expect(needsRefresh(weather, '서울 강남구', now)).toBe(false);
    expect(needsRefresh(weather, '부산 중구', now)).toBe(true);
    expect(needsRefresh({ ...weather, fetchedAt: now - 3 * HOUR }, '서울 강남구', now)).toBe(true);
  });

  it('받은 시각이 미래로 적혀 있으면 믿지 않는다', () => {
    expect(needsRefresh({ ...weather, fetchedAt: now + HOUR }, '서울 강남구', now)).toBe(true);
  });
});

describe('temperatureSummary: 설정 화면의 기온 한 줄', () => {
  it('오늘 예보가 있으면 오늘', () => {
    expect(temperatureSummary(weather, { year: 2026, month: 9, day: 22 })).toEqual({
      when: 'today',
      low: 14,
      high: 25,
      pop: 30,
    });
  });

  it('밤 11시가 넘어 오늘 칸이 없으면 내일', () => {
    const lateNight = { ...weather, days: weather.days.slice(1) };

    expect(temperatureSummary(lateNight, { year: 2026, month: 9, day: 22 })).toEqual({
      when: 'tomorrow',
      low: 12,
      high: 22,
      pop: 80,
    });
  });

  it('둘 다 없으면 null', () => {
    expect(temperatureSummary(weather, { year: 2026, month: 10, day: 1 })).toBeNull();
    expect(temperatureSummary(null, { year: 2026, month: 9, day: 22 })).toBeNull();
  });
});

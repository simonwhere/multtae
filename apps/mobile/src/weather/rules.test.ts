import { describe, expect, it } from 'vitest';

import type { PlantWithSpace } from '../db/plants';
import type { Plant, Space } from '../db/schema';
import { DEFAULT_COEFFICIENTS } from '../engine';
import type { CalendarDate } from '../engine';
import type { DayForecast, Weather } from './forecast';
import {
  heatDays,
  planRainWatering,
  rainWatered,
  weatherAlert,
  weatherCards,
} from './rules';

const KST = 540;
/** 한국 시간 2026-month-day hour 시 */
const at = (month: number, day: number, hour = 0) => Date.UTC(2026, month - 1, day, hour - 9);
const date = (month: number, day: number): CalendarDate => ({ year: 2026, month, day });

function space(id: string, spaceType: Space['spaceType']): Space {
  return {
    id,
    name: id,
    photoPath: null,
    direction: 'S',
    spaceType,
    lightGrade: 'high',
    lightSource: 'default',
    aiEvidence: null,
    createdAt: 1,
  };
}

const terrace = space('테라스', 'terrace');
const balcony = space('발코니', 'balcony_ext');
const window = space('창가', 'indoor_window');

function plant(nickname: string, patch: Partial<Plant> = {}): Plant {
  return {
    id: nickname,
    spaceId: terrace.id,
    scientificName: null,
    nickname,
    groupCode: 'temperate',
    potSize: 'm',
    soilType: 'potting',
    isBonsai: false,
    bonsaiGroup: null,
    learnFactor: 1,
    baseInterval: null,
    manualInterval: null,
    manualSeason: null,
    lastWateredAt: at(9, 16, 12),
    lastWateredUnknown: false,
    nextWaterAt: at(9, 22),
    lastRepotAt: null,
    postponeCount: 0,
    coverPhotoPath: null,
    createdAt: 1,
    ...patch,
  };
}

const item = (p: Plant, s: Space): PlantWithSpace => ({ plant: { ...p, spaceId: s.id }, space: s });

const day = (d: string, patch: Partial<DayForecast> = {}): DayForecast => ({
  date: d,
  tmin: 15,
  tmax: 25,
  pop: 10,
  pcp: 0,
  windMax: 3,
  condition: 'clear',
  ...patch,
});

const weather = (today: Partial<DayForecast>, tomorrow: Partial<DayForecast> = {}, dust: Weather['dust'] = 'good'): Weather => ({
  region: '서울 강남구',
  fetchedAt: at(9, 22, 5),
  days: [day('2026-09-22', today), day('2026-09-23', tomorrow)],
  dust,
});

describe('rainWatered: 비가 대신 준다 (SPEC.md 7.2)', () => {
  const morning = { now: at(9, 22, 6), utcOffsetMinutes: KST };
  const items = [
    item(plant('로즈마리'), terrace),
    item(plant('금귤', { nextWaterAt: at(9, 20) }), terrace), // 밀린 식물도 비를 맞는다
    item(plant('율마', { nextWaterAt: at(9, 25) }), terrace), // 아직 때가 아니다
    item(plant('몬스테라'), window), // 실내
    item(plant('라벤더'), balcony), // 발코니 확장은 비를 맞지 않는다
    item(plant('개운죽', { soilType: 'hydro' }), terrace), // 수경
  ];

  it('강수확률 70% 이상이고 5mm 이상 오면, 테라스에서 오늘까지 물 줄 식물', () => {
    const rainy = weather({ pop: 70, pcp: 5 });

    expect(rainWatered(items, rainy, morning).map(({ plant: p }) => p.nickname)).toEqual([
      '로즈마리',
      '금귤',
    ]);
  });

  it('둘 중 하나라도 못 미치면 건너뛰지 않는다', () => {
    expect(rainWatered(items, weather({ pop: 90, pcp: 4.9 }), morning)).toEqual([]);
    expect(rainWatered(items, weather({ pop: 60, pcp: 20 }), morning)).toEqual([]);
    expect(rainWatered(items, null, morning)).toEqual([]);
  });

  it('비로 준 물은 학습에 넣지 않고 오늘부터 다시 센다', () => {
    const rosemary = plant('로즈마리', { learnFactor: 1.15, postponeCount: 1 });
    const plan = planRainWatering(rosemary, terrace, {
      now: at(9, 22, 6),
      utcOffsetMinutes: KST,
      season: 'autumn',
      coefficients: DEFAULT_COEFFICIENTS,
      logId: 'log-1',
    });

    expect(plan.plantPatch).toMatchObject({
      learnFactor: 1.15,
      lastWateredAt: at(9, 22, 12),
      lastWateredUnknown: false,
      postponeCount: 0,
    });
    expect(plan.log).toMatchObject({ source: 'rain', soilState: 'skipped', leafDroop: false });
  });
});

describe('weatherCards: 오늘 탭 경고 카드 (SPEC.md 7.2, 6.3, 7.3, 7.4)', () => {
  const items = [
    item(plant('곰솔', { isBonsai: true, bonsaiGroup: 'conifer', groupCode: 'bonsai_conifer' }), terrace),
    item(plant('로즈마리', { potSize: 's' }), terrace),
    item(plant('라벤더'), balcony),
    item(plant('몬스테라', { groupCode: 'tropical' }), window),
  ];
  const context = { now: at(9, 22, 10), utcOffsetMinutes: KST, season: 'autumn' as const, coefficients: DEFAULT_COEFFICIENTS };

  it('맑고 평범한 날에는 없다', () => {
    expect(weatherCards(items, weather({}), context)).toEqual([]);
  });

  it('폭염: 최고 33도 이상이면 테라스와 발코니 확장 식물', () => {
    expect(weatherCards(items, weather({ tmax: 33 }), context)).toEqual([
      { kind: 'heat', names: ['곰솔', '로즈마리', '라벤더'] },
    ]);
  });

  it('한파: 내일 새벽 영하 5도 이하면 바깥 자리 식물과 분재·발코니 문구', () => {
    expect(weatherCards(items, weather({}, { tmin: -7 }), context)).toEqual([
      {
        kind: 'cold',
        when: 'tomorrow',
        low: -7,
        names: ['곰솔', '로즈마리', '라벤더'],
        bonsai: true,
        balcony: true,
      },
    ]);
  });

  it('오전 9시 전이면 오늘 새벽도 본다', () => {
    const early = { ...context, now: at(9, 22, 6) };

    expect(weatherCards(items, weather({ tmin: -6 }), early)[0]).toMatchObject({
      kind: 'cold',
      when: 'today',
      low: -6,
    });
    expect(weatherCards(items, weather({ tmin: -6 }), context)).toEqual([]);
  });

  it('서리: 10~11월과 3~4월에 3도 이하면 테라스 식물만', () => {
    const october = { ...context, now: at(10, 20, 10) };
    const frosty: Weather = {
      ...weather({}),
      days: [day('2026-10-20'), day('2026-10-21', { tmin: 2 })],
    };

    expect(weatherCards(items, frosty, october)).toEqual([
      { kind: 'frost', when: 'tomorrow', low: 2, names: ['곰솔', '로즈마리'] },
    ]);
    // 9월에는 서리 카드가 없다
    expect(weatherCards(items, weather({}, { tmin: 2 }), context)).toEqual([]);
  });

  it('한파면 서리는 따로 말하지 않는다', () => {
    const march = { ...context, now: at(3, 10, 10) };
    const freezing: Weather = { ...weather({}), days: [day('2026-03-10'), day('2026-03-11', { tmin: -8 })] };

    expect(weatherCards(items, freezing, march).map((card) => card.kind)).toEqual(['cold']);
  });

  it('강풍: 초속 10m 이상이면 테라스 식물, 작은 화분은 따로', () => {
    expect(weatherCards(items, weather({ windMax: 10 }), context)).toEqual([
      { kind: 'wind', names: ['곰솔', '로즈마리'], small: ['로즈마리'] },
    ]);
  });

  it('미세먼지 나쁨 이상이고 열대 관엽이 있으면 분무 안내', () => {
    expect(weatherCards(items, weather({}, {}, 'bad'), context)).toEqual([{ kind: 'dust' }]);
    expect(weatherCards(items, weather({}, {}, 'very_bad'), context)).toEqual([{ kind: 'dust' }]);
    expect(weatherCards(items.slice(0, 3), weather({}, {}, 'bad'), context)).toEqual([]);
    expect(weatherCards(items, weather({}, {}, 'moderate'), context)).toEqual([]);
  });

  it('바깥 자리 식물이 없으면 날씨 카드도 없다', () => {
    expect(weatherCards([items[3]], weather({ tmax: 35, windMax: 14 }, { tmin: -10 }), context)).toEqual([]);
  });

  it('날씨가 없어도 난방 습도(겨울 월요일)와 장마 시작일 카드는 뜬다 (7.3, 7.4)', () => {
    // 2026-11-23 은 월요일이다
    const monday = { ...context, now: at(11, 23, 10), season: 'winter' as const };
    expect(weatherCards(items, null, monday)).toEqual([{ kind: 'humidity' }]);
    // 실내 열대·온대 관엽이 없으면 뜨지 않는다
    expect(weatherCards(items.slice(0, 3), null, monday)).toEqual([]);
    // 월요일이 아니면 뜨지 않는다
    expect(weatherCards(items, null, { ...monday, now: at(11, 24, 10) })).toEqual([]);

    const monsoonStart = { ...context, now: at(6, 21, 10), season: 'monsoon' as const };
    expect(weatherCards(items, null, monsoonStart)).toEqual([{ kind: 'monsoon' }]);
    expect(weatherCards(items, null, { ...monsoonStart, now: at(6, 22, 10) })).toEqual([]);
  });
});

describe('heatDays: 폭염인 날은 아침 알림을 07시로 당긴다 (SPEC.md 7.2)', () => {
  it('최고 33도 이상인 날 가운데 바깥 자리 식물이 있는 날', () => {
    const items = [item(plant('로즈마리'), terrace)];

    expect(heatDays(items, weather({ tmax: 34 }, { tmax: 30 }))).toEqual(['2026-09-22']);
    expect(heatDays([item(plant('몬스테라'), window)], weather({ tmax: 34 }))).toEqual([]);
    expect(heatDays(items, null)).toEqual([]);
  });
});

describe('weatherAlert: 한파·서리 예보 알림 (SPEC.md 12.1)', () => {
  const items = [
    item(plant('곰솔', { isBonsai: true, bonsaiGroup: 'conifer' }), terrace),
    item(plant('라벤더'), balcony),
  ];
  const context = { now: at(9, 22, 10), utcOffsetMinutes: KST, season: 'autumn' as const, coefficients: DEFAULT_COEFFICIENTS };

  it('내일 새벽 한파면 알림 한 줄. 경고할 식물 수와 분재 수를 센다', () => {
    expect(weatherAlert(items, weather({}, { tmin: -7 }), context)).toEqual({
      kind: 'cold',
      targetDate: '2026-09-23',
      low: -7,
      count: 2,
      bonsai: 1,
    });
  });

  it('경고가 없으면 null', () => {
    expect(weatherAlert(items, weather({}), context)).toBeNull();
    expect(weatherAlert(items, null, context)).toBeNull();
  });
});

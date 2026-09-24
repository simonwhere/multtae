import { describe, expect, it } from 'vitest';

import type { PlantWithSpace } from '../db/plants';
import type { Plant, Space } from '../db/schema';
import { DEFAULT_COEFFICIENTS, getSeasonAt, toCalendarDate, toSeoulDate } from '../engine';
import { planNotifications } from '../notifications/plan';
import {
  DEFAULT_BONSAI_EVENING_MINUTE,
  DEFAULT_BONSAI_WINTER_MINUTE,
  DEFAULT_NOTIFY_MINUTE,
} from '../notifications/settings';
import { countWaterDate } from '../plants/schedule';
import { classifyToday } from '../plants/today';

/**
 * 경계에서의 동작 (SPEC.md 15 시간: 자정 전후 경계 테스트).
 * 물주기 날짜는 기기 로컬 날짜로, 계절은 Asia/Seoul 날짜로 센다 (SPEC 12.2, 15).
 * 앞의 테스트들이 함수 하나씩을 보는 데 견줘, 여기서는 기기 시간대를 바꿔 가며
 * 오늘 탭·다음 물주기·알림이 같은 순간을 어떻게 보는지 함께 본다.
 */

const C = DEFAULT_COEFFICIENTS;

/** 시간대마다 UTC 오프셋(분). 서머타임이 있는 곳은 그 계절의 값이다 */
const ZONES = [
  { name: '서울', offset: 540 },
  { name: '로스앤젤레스(겨울)', offset: -480 },
  { name: '런던(여름)', offset: 60 },
  { name: '오클랜드(여름)', offset: 780 },
] as const;

/** 그 시간대의 벽시계 시각을 epoch ms 로 */
function wall(
  offsetMinutes: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  year = 2026,
): number {
  return Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60_000;
}

const space: Space = {
  id: 'space-1',
  name: '남향 거실 창가',
  photoPath: null,
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'medium',
  lightSource: 'default',
  aiEvidence: null,
  createdAt: 1,
  updatedAt: 1,
};

function plant(patch: Partial<Plant>): Plant {
  return {
    id: 'plant-1',
    spaceId: 'space-1',
    scientificName: 'Monstera deliciosa',
    nickname: '몬스테라',
    groupCode: 'tropical',
    potSize: 'm',
    soilType: 'potting',
    isBonsai: false,
    bonsaiGroup: null,
    learnFactor: 1.0,
    baseInterval: 7,
    manualInterval: null,
    manualSeason: null,
    lastWateredAt: 0,
    lastWateredUnknown: false,
    nextWaterAt: null,
    lastRepotAt: null,
    postponeCount: 0,
    coverPhotoPath: null,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

const item = (patch: Partial<Plant>): PlantWithSpace => ({ plant: plant(patch), space });

describe.each(ZONES)('자정 경계 ($name)', ({ offset }) => {
  // 9월 23일에 물을 줄 식물. 마지막으로 준 날은 9월 16일 정오다
  const due = item({
    lastWateredAt: wall(offset, 9, 16, 12),
    nextWaterAt: wall(offset, 9, 23),
  });

  it('밤 11시 59분까지는 오늘 줄 식물이다', () => {
    const sections = classifyToday([due], wall(offset, 9, 23, 23, 59), offset);

    expect(sections.due.map(({ plant: p }) => p.id)).toEqual(['plant-1']);
    expect(sections.overdue).toEqual([]);
  });

  it('자정을 넘기면 밀린 식물이 된다', () => {
    const sections = classifyToday([due], wall(offset, 9, 24, 0, 0), offset);

    expect(sections.due).toEqual([]);
    expect(sections.overdue.map(({ soil }) => soil.daysLeft)).toEqual([-1]);
  });

  it('밤늦게 준 물은 그날의 완료로, 자정을 넘기면 다음 물주기로 넘어간다', () => {
    const watered = item({
      lastWateredAt: wall(offset, 9, 23, 23, 30),
      nextWaterAt: wall(offset, 9, 30),
    });

    expect(classifyToday([watered], wall(offset, 9, 23, 23, 59), offset).done).toHaveLength(1);

    const tomorrow = classifyToday([watered], wall(offset, 9, 24, 0, 1), offset);
    expect(tomorrow.done).toEqual([]);
    expect(tomorrow.upcoming).toHaveLength(0); // 9월 30일은 아직 3일 밖이다
  });

  it('알림은 기기 시간대의 아침 8시에 울린다', () => {
    const planned = planNotifications({
      plants: [
        { nickname: '몬스테라', waterDate: { year: 2026, month: 9, day: 24 }, hydro: false, bonsai: false },
      ],
      seasonChanges: [],
      season: 'autumn',
      now: wall(offset, 9, 23, 22),
      utcOffsetMinutes: offset,
      settings: {
        notifyMinute: DEFAULT_NOTIFY_MINUTE,
        bonsaiEveningMinute: DEFAULT_BONSAI_EVENING_MINUTE,
        bonsaiWinterMinute: DEFAULT_BONSAI_WINTER_MINUTE,
        quietHours: null,
      },
    });

    // 날짜와 하루 중 몇 분째로 짜고, 예약할 때 그 시간대의 시각이 된다
    expect(planned[0]?.id).toBe('water-20260924-0');
    expect(planned[0]?.date).toEqual({ year: 2026, month: 9, day: 24 });
    expect(planned[0]?.minuteOfDay).toBe(8 * 60);
  });
});

describe('계절 경계는 기기 시간대와 무관하게 Asia/Seoul 날짜로 본다 (SPEC 5.2, 15)', () => {
  // 겨울은 11월 16일에 시작한다
  const lastMomentOfAutumn = wall(540, 11, 15, 23, 59);
  const firstMomentOfWinter = wall(540, 11, 16, 0, 0);

  it('서울 자정을 넘기는 순간 계절이 바뀐다', () => {
    expect(getSeasonAt(lastMomentOfAutumn, C.seasonBounds)).toBe('autumn');
    expect(getSeasonAt(firstMomentOfWinter, C.seasonBounds)).toBe('winter');
  });

  it.each(ZONES)('$name 에서도 같은 순간이면 같은 계절이다', ({ offset }) => {
    expect(getSeasonAt(firstMomentOfWinter, C.seasonBounds)).toBe('winter');
    // 로스앤젤레스는 아직 11월 15일이지만 서울 날짜로 보므로 겨울이다
    expect(toSeoulDate(firstMomentOfWinter).day).toBe(16);
    expect(toCalendarDate(firstMomentOfWinter, offset).month).toBe(11);
  });

  it('로스앤젤레스에서는 그 순간 날짜가 하루 앞이다', () => {
    expect(toCalendarDate(firstMomentOfWinter, -480).day).toBe(15);
    expect(toCalendarDate(firstMomentOfWinter, 540).day).toBe(16);
  });
});

describe('계절이 바뀌면 다음 물주기를 다시 센다 (SPEC 5.2, 12.2)', () => {
  const KST = 540;
  const autumnPlant = plant({ lastWateredAt: wall(KST, 11, 15, 12) });

  const dateIn = (season: 'autumn' | 'winter') =>
    countWaterDate(autumnPlant, space, {
      today: { year: 2026, month: 11, day: 15 },
      season,
      coefficients: C,
      utcOffsetMinutes: KST,
    });

  it('겨울에는 가을보다 뒤로 밀린다', () => {
    const autumn = dateIn('autumn');
    const winter = dateIn('winter');

    expect(winter.day).toBeGreaterThan(autumn.day);
  });

  it('센 날짜가 오늘보다 앞이면 오늘로 둔다. 조건이 바뀌자마자 밀림이 되지는 않는다', () => {
    const thirsty = plant({ lastWateredAt: wall(KST, 10, 1, 12) });

    expect(
      countWaterDate(thirsty, space, {
        today: { year: 2026, month: 11, day: 16 },
        season: 'winter',
        coefficients: C,
        utcOffsetMinutes: KST,
      }),
    ).toEqual({ year: 2026, month: 11, day: 16 });
  });
});

describe('서머타임: 물 준 시각을 정오로 남기는 까닭 (SPEC 3.2 등록, 12.2)', () => {
  // 물 준 시각은 그날 정오로 남긴다. 나중에 읽을 때 오프셋이 한두 시간 달라져도 날짜가 흔들리지 않는다
  const noon = wall(60, 3, 28, 12); // 런던 서머타임이 시작하기 하루 전 정오

  it('오프셋이 한 시간 달라져도 같은 날짜로 읽는다', () => {
    expect(toCalendarDate(noon, 60).day).toBe(28);
    expect(toCalendarDate(noon, 0).day).toBe(28);
    expect(toCalendarDate(noon, 120).day).toBe(28);
  });

  it('자정 가까이 남겼다면 한 시간 차이로 날짜가 달라진다', () => {
    const midnight = wall(60, 3, 28, 23, 30);

    expect(toCalendarDate(midnight, 60).day).toBe(28);
    expect(toCalendarDate(midnight, 120).day).toBe(29);
  });
});

describe('여행 중: 기기 시간대가 바뀌어도 물 준 날은 그대로다 (SPEC 12.2)', () => {
  // 서울에서 9월 23일 정오에 물을 주고 로스앤젤레스로 갔다. 그곳에서는 같은 순간이 9월 22일 저녁이다
  const wateredAt = wall(540, 9, 23, 12);

  it('로스앤젤레스에서는 그 순간을 전날로 보고, 다음 물주기도 그 날짜로 센다', () => {
    expect(toCalendarDate(wateredAt, 540)).toEqual({ year: 2026, month: 9, day: 23 });
    expect(toCalendarDate(wateredAt, -420)).toEqual({ year: 2026, month: 9, day: 22 });

    const counted = countWaterDate(plant({ lastWateredAt: wateredAt }), space, {
      today: { year: 2026, month: 9, day: 22 },
      season: 'autumn',
      coefficients: C,
      utcOffsetMinutes: -420,
    });

    // 그곳 날짜로 9월 22일 + 7일
    expect(counted).toEqual({ year: 2026, month: 9, day: 29 });
  });
});

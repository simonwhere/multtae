import { describe, expect, it } from 'vitest';

import type { PlantWithSpace } from '../db/plants';
import type { Plant, Space } from '../db/schema';
import { colors } from '../ui/tokens';
import {
  buildWidgetSnapshot,
  parseWidgetSnapshot,
  pickWidgetDay,
  WIDGET_DAYS,
  WIDGET_LINES,
} from './snapshot';

const KST = 540;
/** 기기 시간대(KST)의 그 날짜 몇 시 */
const at = (month: number, day: number, hour = 0) => Date.UTC(2026, month - 1, day, hour - 9);
const NOW = at(9, 24, 9);

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
    scientificName: null,
    nickname: '몬스테라',
    groupCode: 'tropical',
    potSize: 'm',
    soilType: 'potting',
    isBonsai: false,
    bonsaiGroup: null,
    learnFactor: 1,
    baseInterval: 7,
    manualInterval: null,
    manualSeason: null,
    lastWateredAt: at(9, 17, 12),
    lastWateredUnknown: false,
    nextWaterAt: at(9, 24),
    lastRepotAt: null,
    postponeCount: 0,
    coverPhotoPath: null,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

const item = (patch: Partial<Plant>): PlantWithSpace => ({ plant: plant(patch), space });

describe('buildWidgetSnapshot: 홈 화면 위젯 (9-3)', () => {
  const snapshot = buildWidgetSnapshot(
    [
      item({ id: 'a', nickname: '곰솔', lastWateredAt: at(9, 19, 12), nextWaterAt: at(9, 22) }),
      item({ id: 'b', nickname: '금귤', nextWaterAt: at(9, 24) }),
      item({ id: 'c', nickname: '몬스테라', lastWateredAt: at(9, 23, 12), nextWaterAt: at(9, 30) }),
    ],
    NOW,
    KST,
  );

  it(`앱을 열지 않아도 넘어가게 오늘부터 ${WIDGET_DAYS}일치를 만든다`, () => {
    expect(snapshot.days.map((day) => day.date)).toEqual([
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
    ]);
  });

  it('오늘은 밀린 식물과 오늘 줄 식물을 함께 센다. 밀린 것이 먼저다', () => {
    expect(snapshot.days[0]).toMatchObject({
      dateLabel: '9.24',
      weekday: '목요일',
      count: 2,
      headline: '오늘 물 줄 식물',
      lines: [
        { name: '곰솔', tag: '2일 지남', overdue: true },
        { name: '금귤', tag: '오늘', overdue: false },
      ],
      more: null,
      next: null,
    });
  });

  it('날이 지날수록 밀린 날이 늘어난다', () => {
    expect(snapshot.days[1]?.lines[0]).toEqual({ name: '곰솔', tag: '3일 지남', overdue: true });
  });

  it('물 줄 식물이 없는 날에는 다음 예정을 알려 준다', () => {
    const quiet = buildWidgetSnapshot(
      [item({ nickname: '몬스테라', lastWateredAt: at(9, 23, 12), nextWaterAt: at(9, 30) })],
      NOW,
      KST,
    );

    expect(quiet.days[0]).toMatchObject({
      count: 0,
      headline: '오늘은 물 줄 식물이 없어요',
      lines: [],
      next: '다음은 몬스테라, 9월 30일',
    });
    expect(quiet.days[6]).toMatchObject({ count: 1, lines: [{ name: '몬스테라', tag: '오늘' }] });
  });

  it(`${WIDGET_LINES}개를 넘으면 나머지는 개수로 말한다`, () => {
    const many = buildWidgetSnapshot(
      ['가', '나', '다', '라', '마'].map((name, index) =>
        item({ id: `p${index}`, nickname: name, nextWaterAt: at(9, 24) }),
      ),
      NOW,
      KST,
    );

    expect(many.days[0]?.lines).toHaveLength(WIDGET_LINES);
    expect(many.days[0]?.more).toBe('외 2개');
  });

  it('식물이 없으면 등록하라고 안내한다', () => {
    expect(buildWidgetSnapshot([], NOW, KST).days[0]).toMatchObject({
      count: 0,
      headline: '식물을 등록하면 여기에 물 줄 날이 보여요',
      next: null,
    });
  });

  it('색은 앱 토큰을 그대로 넘긴다. 위젯에 색을 따로 적지 않는다', () => {
    expect(snapshot.colors.light.accent).toBe(colors.light.accent);
    expect(snapshot.colors.dark.paper).toBe(colors.dark.paper);
  });
});

describe('pickWidgetDay·parseWidgetSnapshot: 위젯이 오늘 것을 고른다', () => {
  const snapshot = buildWidgetSnapshot(
    [item({ nickname: '금귤', nextWaterAt: at(9, 24) })],
    NOW,
    KST,
  );

  it('자정이 지나면 앱을 열지 않아도 다음 날로 넘어간다', () => {
    expect(pickWidgetDay(snapshot, at(9, 24, 23), KST)?.date).toBe('2026-09-24');
    expect(pickWidgetDay(snapshot, at(9, 25, 0), KST)?.date).toBe('2026-09-25');
  });

  it('만들어 둔 날을 다 쓰면 고를 날이 없다', () => {
    expect(pickWidgetDay(snapshot, at(9, 30, 23), KST)?.date).toBe('2026-09-30');
    expect(pickWidgetDay(snapshot, at(10, 1, 0), KST)).toBeNull();
  });

  it('저장한 글을 그대로 되읽는다', () => {
    expect(parseWidgetSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('판이 다르거나 읽을 수 없으면 버린다', () => {
    expect(parseWidgetSnapshot(null)).toBeNull();
    expect(parseWidgetSnapshot('')).toBeNull();
    expect(parseWidgetSnapshot('{')).toBeNull();
    expect(parseWidgetSnapshot('null')).toBeNull();
    expect(parseWidgetSnapshot(JSON.stringify({ ...snapshot, version: 2 }))).toBeNull();
    expect(parseWidgetSnapshot(JSON.stringify({ ...snapshot, days: null }))).toBeNull();
  });
});

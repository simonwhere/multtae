import { describe, expect, it } from 'vitest';

import type { EventWithPlant } from '../db/events';
import type { WateringLog } from '../db/schema';
import type { WateringWithPlant } from '../db/watering';
import { buildTimeline, dayTitle, entryText } from './timeline';
import type { TimelineEntry } from './timeline';

const KST = 540;
const at = (month: number, day: number, hour = 12) => Date.UTC(2026, month - 1, day, hour - 9);

const water = (
  id: string,
  plantId: string,
  nickname: string,
  wateredAt: number,
  patch: Partial<WateringLog> = {},
): WateringWithPlant => ({
  nickname,
  log: {
    id,
    plantId,
    wateredAt,
    soilState: 'ok',
    leafDroop: false,
    source: 'user',
    intervalCalc: 7,
    factorSnapshot: null,
    dueAt: null,
    ...patch,
  },
});

const event = (
  id: string,
  plantId: string,
  nickname: string,
  occurredAt: number,
  type: EventWithPlant['event']['type'],
  payload: unknown = null,
): EventWithPlant => ({
  nickname,
  event: { id, plantId, type, occurredAt, payload, photoPath: null },
});

describe('buildTimeline: 날짜별 기록 (SPEC.md 3.5)', () => {
  const waterings = [
    water('w1', 'p1', '몬스테라', at(9, 20, 9)),
    water('w2', 'p2', '곰솔', at(9, 22, 8)),
    water('w3', 'p1', '몬스테라', at(9, 22, 19)),
  ];
  const events = [event('e1', 'p2', '곰솔', at(9, 22, 10), 'task', { labelKo: '순따기' })];

  it('최근 날짜부터, 같은 날은 늦은 것부터 묶는다', () => {
    const days = buildTimeline(waterings, events, KST);

    expect(days.map((day) => [day.date.day, day.entries.map((entry) => entry.id)])).toEqual([
      [22, ['w3', 'e1', 'w2']],
      [20, ['w1']],
    ]);
  });

  it('식물을 고르면 그 식물 기록만', () => {
    const days = buildTimeline(waterings, events, KST, 'p2');

    expect(days.flatMap((day) => day.entries.map((entry) => entry.id))).toEqual(['e1', 'w2']);
  });

  it('기록이 없으면 빈 배열', () => {
    expect(buildTimeline([], [], KST)).toEqual([]);
  });
});

describe('entryText: 한 줄 글 (SPEC.md 8.4)', () => {
  const spaces = new Map([
    ['s1', '베란다'],
    ['s2', '발코니 확장'],
  ]);
  const base = { id: 'x', plantId: 'p1', nickname: '몬스테라', at: 0 };
  const waterEntry = (patch: Partial<Extract<TimelineEntry, { kind: 'water' }>>): TimelineEntry => ({
    ...base,
    kind: 'water',
    soilState: 'skipped',
    leafDroop: false,
    rain: false,
    ...patch,
  });
  const eventEntry = (type: Extract<TimelineEntry, { kind: 'event' }>['type'], payload: unknown): TimelineEntry => ({
    ...base,
    kind: 'event',
    type,
    payload,
  });

  it('물주기: 흙 상태와 잎 처짐을 붙이고, 비가 준 날은 따로', () => {
    expect(entryText(waterEntry({}), spaces)).toBe('물 줌');
    expect(entryText(waterEntry({ soilState: 'dry', leafDroop: true }), spaces)).toBe(
      '물 줌, 바싹 말랐어요, 잎이 처졌어요',
    );
    expect(entryText(waterEntry({ rain: true }), spaces)).toBe('비가 대신 줬어요');
  });

  it('이벤트', () => {
    expect(entryText(eventEntry('fertilize', null), spaces)).toBe('비료 줌');
    expect(entryText(eventEntry('repot', { potSize: 'l', soilType: 'gritty' }), spaces)).toBe(
      '분갈이, 대 화분에 마사 섞음',
    );
    expect(entryText(eventEntry('repot', null), spaces)).toBe('분갈이했어요');
    expect(entryText(eventEntry('diagnose', null), spaces)).toBe('상태 진단');
    expect(
      entryText(eventEntry('diagnose', { findings: [{ name: '과습', confidence: 0.6 }] }), spaces),
    ).toBe('상태 진단, 과습');
    expect(entryText(eventEntry('task', { labelKo: '순따기' }), spaces)).toBe('순따기 마침');
    expect(entryText(eventEntry('task', {}), spaces)).toBe('분재 작업 마침');
    expect(entryText(eventEntry('note', { kind: 'water_cloudy' }), spaces)).toBe('물이 탁했어요');
    expect(entryText(eventEntry('note', {}), spaces)).toBe('메모');
  });

  it('공간 이동은 옮긴 공간 이름과 알맞은 조사로. 지운 공간이면 다른 공간', () => {
    expect(entryText(eventEntry('move', { toSpaceId: 's1' }), spaces)).toBe('베란다로 옮김');
    expect(entryText(eventEntry('move', { toSpaceId: 's2' }), spaces)).toBe('발코니 확장으로 옮김');
    expect(entryText(eventEntry('move', { toSpaceId: 'gone' }), spaces)).toBe('다른 공간으로 옮김');
  });
});

describe('dayTitle', () => {
  it('"9월 22일 화요일"', () => {
    expect(dayTitle({ year: 2026, month: 9, day: 22 })).toBe('9월 22일 화요일');
  });
});

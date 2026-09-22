import { beforeEach, describe, expect, it } from 'vitest';

import { getPlantWithSpace, insertPlant } from '../db/plants';
import type { NewPlant, NewSpace } from '../db/schema';
import { setSetting } from '../db/settings';
import { insertEvent } from '../db/events';
import { cacheSpecies } from '../db/species-cache';
import { listPlantWaterings } from '../db/watering';
import { insertSpace } from '../db/spaces';
import { createTestDb } from '../db/testing/test-db';
import type { TestDb } from '../db/testing/test-db';
import { DEFAULT_COEFFICIENTS } from '../engine';
import type { PlannedNotification } from './plan';
import { coalesce, rescheduleAll } from './scheduler';
import type { Notifier } from './scheduler';

const KST = 540;
const at = (month: number, day: number, hour = 0, minute = 0) =>
  Date.UTC(2026, month - 1, day, hour - 9, minute);
const clock = (now: number) => ({
  now,
  utcOffsetMinutes: KST,
  coefficients: DEFAULT_COEFFICIENTS,
});

const livingRoom: NewSpace = {
  id: 'space-1',
  name: '남향 거실 창가',
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'medium',
  lightSource: 'default',
  createdAt: 1,
};

const monstera = (patch: Partial<NewPlant>): NewPlant => ({
  id: 'plant-1',
  spaceId: 'space-1',
  scientificName: 'Monstera deliciosa',
  nickname: '몬스테라',
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  lastWateredAt: at(11, 10, 12),
  nextWaterAt: at(11, 17),
  // 비료 간격은 등록일부터 센다. 이 파일의 알림 테스트에 비료 줄이 끼지 않게 최근으로 둔다
  createdAt: at(9, 20),
  ...patch,
});

function fakeNotifier(granted = true, pendingIds: string[] = []) {
  const calls: string[] = [];
  const pending = new Map<string, PlannedNotification | null>(pendingIds.map((id) => [id, null]));
  const notifier: Notifier = {
    canNotify: async () => granted,
    scheduledIds: async () => [...pending.keys()],
    cancel: async (id) => {
      calls.push(`cancel ${id}`);
      pending.delete(id);
    },
    schedule: async (notification) => {
      calls.push(notification.id);
      pending.set(notification.id, notification);
    },
  };
  /** 지금 예약되어 있는 알림. 이른 것부터 */
  const scheduled = () =>
    [...pending.values()].filter((notification) => notification !== null);
  return { notifier, calls, scheduled, pending };
}

let db: TestDb;

beforeEach(async () => {
  ({ db } = createTestDb());
  await insertSpace(db, livingRoom);
});

describe('rescheduleAll (SPEC.md 12.3)', () => {
  it('14일치를 다시 예약한다', async () => {
    await insertPlant(
      db,
      monstera({ lastWateredAt: at(9, 20, 12), nextWaterAt: at(9, 27) }),
      [],
    );
    const { notifier, calls, scheduled } = fakeNotifier();

    const result = await rescheduleAll(db, notifier, clock(at(9, 25, 7)));

    expect(calls).toEqual([
      'water-20260927-0',
      'overdue-20260928-0',
      'overdue-20261001-0',
      'overdue-20261004-0',
      'overdue-20261007-0',
    ]);
    expect(scheduled()[0]).toMatchObject({ title: '물때예요', body: '몬스테라 물 줄 때' });
    expect(result).toEqual({ updatedPlants: 0, scheduled: scheduled() });
  });

  it('계획에 없는 예약만 지우고, 다시 넣을 예약은 같은 id 로 덮어쓴다', async () => {
    // iOS 의 전체 취소는 비동기라 바로 뒤에 넣은 예약까지 지울 수 있다. 그래서 전부 지우고 시작하지 않는다
    await insertPlant(
      db,
      monstera({ lastWateredAt: at(9, 20, 12), nextWaterAt: at(9, 27) }),
      [],
    );
    const { notifier, calls, pending } = fakeNotifier(true, [
      'water-20260926-0',
      'water-20260927-0',
      'dev-test',
    ]);

    await rescheduleAll(db, notifier, clock(at(9, 25, 7)));

    expect(calls.filter((call) => call.startsWith('cancel'))).toEqual([
      'cancel water-20260926-0',
      'cancel dev-test',
    ]);
    // 지우기가 넣기보다 먼저다
    expect(calls.indexOf('cancel dev-test')).toBeLessThan(calls.indexOf('water-20260927-0'));
    expect([...pending.keys()].sort()).toEqual([
      'overdue-20260928-0',
      'overdue-20261001-0',
      'overdue-20261004-0',
      'overdue-20261007-0',
      'water-20260927-0',
    ]);
    expect(pending.get('water-20260927-0')).toMatchObject({ body: '몬스테라 물 줄 때' });
  });

  it('시나리오 C: 계절이 바뀐 뒤 처음 돌 때 모든 식물의 다음 물주기를 다시 센다', async () => {
    await insertPlant(db, monstera({}), []);
    const { notifier, calls } = fakeNotifier();

    const result = await rescheduleAll(db, notifier, clock(at(11, 16, 0, 5)));

    expect(result.updatedPlants).toBe(1);
    expect((await getPlantWithSpace(db, 'plant-1'))?.plant.nextWaterAt).toBe(at(11, 21));
    expect(calls).toEqual([
      'season-20261116-0',
      'water-20261121-0',
      'overdue-20261122-0',
      'overdue-20261125-0',
      'overdue-20261128-0',
    ]);
  });

  it('전환 전에는 저장된 날짜를 두고, 전환 뒤의 알림만 새 계절로 미리 짠다', async () => {
    await insertPlant(db, monstera({}), []);
    const { notifier, calls, scheduled } = fakeNotifier();

    const result = await rescheduleAll(db, notifier, clock(at(11, 10, 13)));

    expect(result.updatedPlants).toBe(0);
    expect((await getPlantWithSpace(db, 'plant-1'))?.plant.nextWaterAt).toBe(at(11, 17));
    expect(calls).toEqual(['season-20261116-0', 'water-20261121-0', 'overdue-20261122-0']);
    expect(scheduled()[0]).toMatchObject({
      title: '겨울·난방 모드',
      body: '물주기가 전체적으로 늘었어요',
    });
  });

  it('알림 권한이 없으면 예약은 건너뛰고 다음 물주기만 다시 센다 (12.2 권한 없음)', async () => {
    await insertPlant(db, monstera({}), []);
    const { notifier, calls } = fakeNotifier(false, ['water-20261117-0']);

    const result = await rescheduleAll(db, notifier, clock(at(11, 16, 7)));

    expect(calls).toEqual([]);
    expect(result).toEqual({ updatedPlants: 1, scheduled: [] });
    expect((await getPlantWithSpace(db, 'plant-1'))?.plant.nextWaterAt).toBe(at(11, 21));
  });

  it('설정의 알림 시각과 방해금지를 읽는다', async () => {
    await insertPlant(
      db,
      monstera({ lastWateredAt: at(9, 20, 12), nextWaterAt: at(9, 27) }),
      [],
    );
    const { notifier, scheduled } = fakeNotifier();

    await setSetting(db, 'notify_time', '06:30');
    await rescheduleAll(db, notifier, clock(at(9, 25, 7)));
    expect(scheduled()[0]).toMatchObject({ id: 'water-20260927-0', minuteOfDay: 390 });

    await setSetting(db, 'dnd_start', '22:00');
    await setSetting(db, 'dnd_end', '07:00');
    await rescheduleAll(db, notifier, clock(at(9, 25, 7)));
    expect(scheduled()[0]).toMatchObject({ id: 'water-20260927-0', minuteOfDay: 420 });
  });

  it('식물이 없으면 남은 예약을 지우기만 한다', async () => {
    const { notifier, calls } = fakeNotifier(true, ['water-20260927-0']);

    const result = await rescheduleAll(db, notifier, clock(at(9, 25, 7)));

    expect(calls).toEqual(['cancel water-20260927-0']);
    expect(result).toEqual({ updatedPlants: 0, scheduled: [] });
  });
});

describe('coalesce: 겹친 요청을 하나로', () => {
  /** 밀린 마이크로태스크가 모두 돌 때까지 기다린다 */
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  function deferredTask() {
    const releases: (() => void)[] = [];
    let started = 0;
    const task = () =>
      new Promise<void>((resolve) => {
        started += 1;
        releases.push(resolve);
      });
    return { task, releases, started: () => started };
  }

  it('도는 중에 들어온 요청은 끝난 뒤 한 번만 더 돈다. 동시에 돌지 않는다', async () => {
    const { task, releases, started } = deferredTask();
    const request = coalesce(task);

    const first = request();
    void request();
    void request();
    expect(started()).toBe(1);

    releases[0]();
    await flush();
    expect(started()).toBe(2);

    releases[1]();
    await first;
    expect(started()).toBe(2);
  });

  it('끝난 뒤의 요청은 새로 돈다', async () => {
    let runs = 0;
    const request = coalesce(async () => {
      runs += 1;
    });

    await request();
    await request();

    expect(runs).toBe(2);
  });

  it('실패해도 다음 요청은 돈다', async () => {
    let runs = 0;
    const request = coalesce(async () => {
      runs += 1;
      if (runs === 1) throw new Error('boom');
    });

    await expect(request()).rejects.toThrow('boom');
    await expect(request()).resolves.toBeUndefined();
    expect(runs).toBe(2);
  });
});

describe('날씨 규칙 (SPEC.md 7.2, 12.1)', () => {
  const terrace: NewSpace = { ...livingRoom, id: 'space-2', name: '테라스', spaceType: 'terrace' };
  const weatherFor = (today: object, tomorrow: object = {}) => ({
    region: '서울 강남구',
    fetchedAt: at(9, 27, 5),
    days: [
      { date: '2026-09-27', tmin: 15, tmax: 25, pop: 10, pcp: 0, windMax: 3, condition: 'clear', ...today },
      { date: '2026-09-28', tmin: 14, tmax: 24, pop: 10, pcp: 0, windMax: 3, condition: 'clear', ...tomorrow },
    ],
    dust: 'good',
  });

  beforeEach(async () => {
    await insertSpace(db, terrace);
    await setSetting(db, 'region_code', '서울 강남구');
  });

  it('비가 넉넉히 오는 날에는 테라스 식물 물주기를 비가 대신하고, 하루에 한 번만 남긴다', async () => {
    await setSetting(db, 'weather_cache', JSON.stringify(weatherFor({ pop: 80, pcp: 12 })));
    await insertPlant(
      db,
      monstera({ id: 'plant-2', spaceId: 'space-2', nickname: '로즈마리', groupCode: 'herb', lastWateredAt: at(9, 24, 12), nextWaterAt: at(9, 27) }),
      [],
    );

    const first = await rescheduleAll(db, fakeNotifier().notifier, clock(at(9, 27, 6)));
    await rescheduleAll(db, fakeNotifier().notifier, clock(at(9, 27, 9)));

    expect(first.updatedPlants).toBe(1);
    const { plant } = (await getPlantWithSpace(db, 'plant-2'))!;
    expect(plant.lastWateredAt).toBe(at(9, 27, 12));
    expect(plant.nextWaterAt).toBeGreaterThan(at(9, 27));

    const logs = await listPlantWaterings(db, 'plant-2', 10);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ id: 'rain-plant-2-2026-09-27', source: 'rain', soilState: 'skipped' });
  });

  it('고른 지역의 날씨가 아니면 규칙을 쓰지 않는다', async () => {
    await setSetting(db, 'region_code', '부산 중구');
    await setSetting(db, 'weather_cache', JSON.stringify(weatherFor({ pop: 80, pcp: 12 })));
    await insertPlant(db, monstera({ id: 'plant-2', spaceId: 'space-2', nextWaterAt: at(9, 27) }), []);

    await rescheduleAll(db, fakeNotifier().notifier, clock(at(9, 27, 6)));

    expect(await listPlantWaterings(db, 'plant-2', 10)).toEqual([]);
  });

  it('내일 새벽 한파면 경고 알림을 한 번 정해 두고, 다시 짜도 같은 시각이다', async () => {
    await setSetting(db, 'weather_cache', JSON.stringify(weatherFor({}, { tmin: -7 })));
    await insertPlant(db, monstera({ id: 'plant-2', spaceId: 'space-2', nextWaterAt: at(10, 5) }), []);

    const first = await rescheduleAll(db, fakeNotifier().notifier, clock(at(9, 27, 18, 30)));
    const again = await rescheduleAll(db, fakeNotifier().notifier, clock(at(9, 27, 20)));
    const after = await rescheduleAll(db, fakeNotifier().notifier, clock(at(9, 27, 21)));

    const alert = first.scheduled.find((item) => item.type === 'weather');
    expect(alert).toMatchObject({
      id: 'weather-20260928-0',
      minuteOfDay: 18 * 60 + 31,
      title: '한파 예보',
      body: '내일 새벽 -7도, 바깥에 둔 식물 1개를 챙겨 주세요',
    });
    // 이미 울린 경고는 다시 짜지 않는다
    expect(again.scheduled.some((item) => item.type === 'weather')).toBe(false);
    expect(after.scheduled.some((item) => item.type === 'weather')).toBe(false);
  });
});

describe('비료와 분갈이 알림 (SPEC.md 8.2, 8.3)', () => {
  it('비료 간격이 찬 식물은 물 줄 날 알림에 "비료도 함께"', async () => {
    await insertPlant(
      db,
      monstera({ createdAt: at(8, 1), lastWateredAt: at(9, 20, 12), nextWaterAt: at(9, 27) }),
      [],
    );

    const { scheduled } = await rescheduleAll(db, fakeNotifier().notifier, clock(at(9, 27, 7)));

    expect(scheduled[0]).toMatchObject({ id: 'water-20260927-0', body: '몬스테라 물 줄 때, 비료도 함께' });
  });

  it('비료를 준 기록이 있으면 그날부터 센다', async () => {
    await insertPlant(
      db,
      monstera({ createdAt: at(8, 1), lastWateredAt: at(9, 20, 12), nextWaterAt: at(9, 27) }),
      [],
    );
    await insertEvent(db, { id: 'f1', plantId: 'plant-1', type: 'fertilize', occurredAt: at(9, 10, 12) });

    const { scheduled } = await rescheduleAll(db, fakeNotifier().notifier, clock(at(9, 27, 7)));

    expect(scheduled[0]?.body).toBe('몬스테라 물 줄 때');
  });

  it('권장 주기가 지난 식물은 적기 월 1일에 분갈이 검토를 알린다', async () => {
    await insertPlant(
      db,
      monstera({
        createdAt: at(1, 1),
        lastRepotAt: Date.UTC(2024, 9, 5, 3),
        lastWateredAt: at(9, 20, 12),
        nextWaterAt: at(10, 20),
      }),
      [],
    );
    // 몬스테라 종 정보: 적기 10월
    await cacheSpecies(db, {
      scientificName: 'Monstera deliciosa',
      groupCode: 'tropical',
      repotMonths: 18,
      repotSeason: [10],
      source: 'seed',
      fetchedAt: 1,
    });

    const { scheduled } = await rescheduleAll(db, fakeNotifier().notifier, clock(at(9, 27, 7)));

    expect(scheduled.find((item) => item.id === 'task-20261001-0')).toMatchObject({
      title: '분갈이 검토',
      body: '몬스테라 마지막 분갈이 23개월 지났어요',
    });
  });
});

describe('진단 재확인 알림 (SPEC.md 8.1, 12.1)', () => {
  it('알림을 받기로 한 진단은 그날 아침에 알린다', async () => {
    await insertPlant(db, monstera({ nextWaterAt: at(10, 20) }), []);
    await insertEvent(db, {
      id: 'diag-1',
      plantId: 'plant-1',
      type: 'diagnose',
      occurredAt: at(9, 27, 9),
      payload: {
        findings: [],
        cause: '괜찮아요',
        actions: ['지켜봐 주세요'],
        wateringHint: 'none',
        recheckDays: 5,
        severity: 'low',
        recheckDate: '2026-10-02',
        hintAnswer: null,
      },
    });

    const { scheduled } = await rescheduleAll(db, fakeNotifier().notifier, clock(at(9, 27, 10)));

    expect(scheduled.find((item) => item.type === 'recheck')).toMatchObject({
      id: 'recheck-20261002-0',
      body: '몬스테라 진단한 지 5일 지났어요',
      eventId: 'diag-1',
    });
  });
});

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  events,
  photos,
  plants,
  plantTasks,
  settings,
  spaces,
  speciesCache,
  wateringLogs,
} from './schema';
import type { NewPlant, NewSpace } from './schema';
import { createTestDb } from './testing/test-db';
import type { TestDb } from './testing/test-db';

const livingRoom: NewSpace = {
  id: 'space-1',
  name: '남향 거실 창가',
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'medium',
  lightSource: 'default',
  createdAt: 1_000,
};

const monstera: NewPlant = {
  id: 'plant-1',
  spaceId: 'space-1',
  nickname: '몬스테라',
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  lastWateredAt: 2_000,
  createdAt: 1_000,
};

/** 실패 사유. drizzle 이 감싼 오류는 원인이 cause 에 있다 */
async function failureOf(query: PromiseLike<unknown>): Promise<string> {
  try {
    await query;
  } catch (error) {
    const { message, cause } = error as Error;
    return `${message} ${cause instanceof Error ? cause.message : ''}`;
  }
  throw new Error('실패해야 하는데 성공했다');
}

let db: TestDb;

beforeEach(async () => {
  ({ db } = createTestDb());
  await db.insert(spaces).values(livingRoom);
});

describe('plants 기본값 (SPEC 11.1)', () => {
  it('U 1.0, 미룸 0회, 분재 아님, 마지막 물 준 날은 아는 것으로 시작한다', async () => {
    await db.insert(plants).values(monstera);

    const [plant] = await db.select().from(plants);

    expect(plant).toMatchObject({
      learnFactor: 1.0,
      postponeCount: 0,
      isBonsai: false,
      lastWateredUnknown: false,
      scientificName: null,
      bonsaiGroup: null,
      manualInterval: null,
      nextWaterAt: null,
      lastRepotAt: null,
      coverPhotoPath: null,
    });
  });

  it('"마지막 물 준 날 모름"으로 등록한 식물을 표시해 둔다 (SPEC 5.5)', async () => {
    await db.insert(plants).values({ ...monstera, lastWateredUnknown: true });

    const [plant] = await db.select().from(plants);
    expect(plant.lastWateredUnknown).toBe(true);

    await db.update(plants).set({ lastWateredUnknown: false }).where(eq(plants.id, monstera.id));
    const [watered] = await db.select().from(plants);
    expect(watered.lastWateredUnknown).toBe(false);
  });
});

describe('외래 키', () => {
  it('없는 공간에는 식물을 둘 수 없다', async () => {
    const failure = await failureOf(db.insert(plants).values({ ...monstera, spaceId: 'nowhere' }));

    expect(failure).toMatch(/FOREIGN KEY/i);
  });

  it('식물이 있는 공간은 지울 수 없다', async () => {
    await db.insert(plants).values(monstera);

    const failure = await failureOf(db.delete(spaces).where(eq(spaces.id, livingRoom.id)));

    expect(failure).toMatch(/FOREIGN KEY/i);
    expect(await db.select().from(spaces)).toHaveLength(1);
  });

  it('식물을 지우면 물주기 기록·이벤트·작업·사진이 함께 지워진다', async () => {
    await db.insert(plants).values([monstera, { ...monstera, id: 'plant-2', nickname: '벤자민' }]);
    for (const plantId of ['plant-1', 'plant-2']) {
      await db.insert(wateringLogs).values({
        id: `log-${plantId}`,
        plantId,
        wateredAt: 2_000,
        soilState: 'ok',
        source: 'user',
      });
      await db
        .insert(events)
        .values({ id: `event-${plantId}`, plantId, type: 'fertilize', occurredAt: 3_000 });
      await db.insert(plantTasks).values({
        id: `task-${plantId}`,
        plantId,
        taskCode: 'repot',
        monthStart: 3,
        monthEnd: 4,
        labelKo: '분갈이',
      });
      await db
        .insert(photos)
        .values({ id: `photo-${plantId}`, plantId, path: 'photos/1.jpg', takenAt: 4_000 });
    }

    await db.delete(plants).where(eq(plants.id, 'plant-1'));

    for (const table of [wateringLogs, events, plantTasks, photos]) {
      const rows = await db.select({ plantId: table.plantId }).from(table);
      expect(rows).toEqual([{ plantId: 'plant-2' }]);
    }
  });

  it('없는 식물에는 기록을 남길 수 없다', async () => {
    const failure = await failureOf(
      db.insert(wateringLogs).values({
        id: 'log-x',
        plantId: 'ghost',
        wateredAt: 2_000,
        soilState: 'ok',
        source: 'user',
      }),
    );

    expect(failure).toMatch(/FOREIGN KEY/i);
  });
});

describe('JSON·boolean 컬럼 왕복', () => {
  it('공간의 AI 근거(9.2 응답)를 JSON 으로 저장하고 그대로 읽는다', async () => {
    const aiEvidence = { grade: 'medium', confidence: 0.78, evidence: ['창이 크게 보임'] };
    await db.insert(spaces).values({ ...livingRoom, id: 'space-2', lightSource: 'ai', aiEvidence });

    const [space] = await db.select().from(spaces).where(eq(spaces.id, 'space-2'));

    expect(space.aiEvidence).toEqual(aiEvidence);
  });

  it('물주기 기록의 계수 스냅샷, 잎 처짐, 건너뛴 흙 상태', async () => {
    await db.insert(plants).values(monstera);
    const factorSnapshot = {
      base: 7,
      season: 1.0,
      pot: 1.0,
      light: 1.3,
      spaceType: 1.0,
      soil: 1.0,
      learn: 1.0,
    };
    await db.insert(wateringLogs).values([
      {
        id: 'log-1',
        plantId: monstera.id,
        wateredAt: 2_000,
        soilState: 'dry',
        leafDroop: true,
        source: 'user',
        intervalCalc: 9.1,
        factorSnapshot,
      },
      { id: 'log-2', plantId: monstera.id, wateredAt: 3_000, soilState: 'skipped', source: 'rain' },
    ]);

    const logs = await db.select().from(wateringLogs).orderBy(wateringLogs.wateredAt);

    expect(logs[0]).toMatchObject({ leafDroop: true, intervalCalc: 9.1, factorSnapshot });
    expect(logs[1]).toMatchObject({
      soilState: 'skipped',
      source: 'rain',
      leafDroop: false,
      intervalCalc: null,
      factorSnapshot: null,
    });
  });

  it('종 캐시의 배열·객체·boolean 컬럼 (SPEC 10.1)', async () => {
    const care = { light: '밝은 간접광.', temp_min: 10, temp_max: 32 };
    await db.insert(speciesCache).values({
      scientificName: 'Monstera deliciosa',
      nameKo: '몬스테라',
      aliasesKo: ['몬스테라 델리시오사'],
      groupCode: 'tropical',
      baseInterval: 7,
      care,
      repotSeason: [3, 4, 5],
      toxicPet: true,
      winterIndoorOk: true,
      source: 'seed',
      fetchedAt: 5_000,
    });

    const [species] = await db.select().from(speciesCache);

    expect(species).toMatchObject({
      aliasesKo: ['몬스테라 델리시오사'],
      care,
      repotSeason: [3, 4, 5],
      toxicPet: true,
      winterIndoorOk: true,
      reviewed: false,
      bonsaiGroup: null,
      bonsaiTasks: null,
    });
  });
});

describe('settings', () => {
  it('키마다 값이 하나다: 같은 키를 다시 쓰면 바뀐다', async () => {
    await db.insert(settings).values({ key: 'notify_time', value: '08:00' });
    await db
      .insert(settings)
      .values({ key: 'notify_time', value: '07:30' })
      .onConflictDoUpdate({ target: settings.key, set: { value: '07:30' } });

    expect(await db.select().from(settings)).toEqual([{ key: 'notify_time', value: '07:30' }]);
  });

  it('같은 키를 그냥 두 번 넣으면 거부된다', async () => {
    await db.insert(settings).values({ key: 'region_code', value: '11680' });

    const failure = await failureOf(
      db.insert(settings).values({ key: 'region_code', value: '11110' }),
    );

    expect(failure).toMatch(/UNIQUE|PRIMARY KEY/i);
  });
});

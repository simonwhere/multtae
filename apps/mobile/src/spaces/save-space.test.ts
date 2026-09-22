import { beforeEach, describe, expect, it } from 'vitest';

import { getPlantWithSpace, insertPlant } from '../db/plants';
import type { NewPlant, NewSpace } from '../db/schema';
import { deleteSpace, getSpace, insertSpace, updateSpace } from '../db/spaces';
import { createTestDb } from '../db/testing/test-db';
import type { TestDb } from '../db/testing/test-db';
import { DEFAULT_COEFFICIENTS } from '../engine';
import type { CalendarDate } from '../engine';
import { saveSpacePatch } from './save-space';

const KST = 540;
/** 기기 시간대(KST)의 그 날짜 몇 시 */
const at = (month: number, day: number, hour = 0) => Date.UTC(2026, month - 1, day, hour - 9);
const date = (month: number, day: number): CalendarDate => ({ year: 2026, month, day });

/** 11/17 겨울 */
const context = {
  today: date(11, 17),
  season: 'winter' as const,
  coefficients: DEFAULT_COEFFICIENTS,
  utcOffsetMinutes: KST,
};

const window: NewSpace = {
  id: 'space-1',
  name: '남향 실내 창가',
  photoPath: 'spaces/space-1.jpg',
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'medium',
  lightSource: 'default',
  createdAt: 1_000,
};

/** 열대 관엽, 기본 7일. 겨울 중광이면 7 × 1.6 = 11일, 강광이면 × 0.8 = 9일 */
const monstera: NewPlant = {
  id: 'plant-1',
  spaceId: 'space-1',
  nickname: '몬스테라',
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  baseInterval: 7,
  lastWateredAt: at(11, 10, 12),
  nextWaterAt: at(11, 21),
  createdAt: 2_000,
};

let db: TestDb;

beforeEach(async () => {
  ({ db } = createTestDb());
  await insertSpace(db, window);
  await insertSpace(db, { ...window, id: 'space-2', name: '테라스', spaceType: 'terrace' });
  await insertPlant(db, monstera, []);
});

describe('saveSpacePatch: 공간을 고치고 식물을 다시 센다 (SPEC.md 3.3)', () => {
  it('빛이 바뀌면 그 공간 식물의 다음 물주기를 다시 센다', async () => {
    const space = (await getSpace(db, 'space-1'))!;

    const count = await saveSpacePatch(
      db,
      space,
      { lightGrade: 'high', lightSource: 'manual' },
      context,
    );

    expect(count).toBe(1);
    expect(await getSpace(db, 'space-1')).toMatchObject({ lightGrade: 'high', lightSource: 'manual' });
    expect((await getPlantWithSpace(db, 'plant-1'))?.plant.nextWaterAt).toBe(at(11, 19));
  });

  it('이름만 바꾸면 식물은 그대로다', async () => {
    const space = (await getSpace(db, 'space-1'))!;

    expect(await saveSpacePatch(db, space, { name: '거실 창가' }, context)).toBe(0);
    expect((await getSpace(db, 'space-1'))?.name).toBe('거실 창가');
    expect((await getPlantWithSpace(db, 'plant-1'))?.plant.nextWaterAt).toBe(at(11, 21));
  });

  it('다른 공간의 식물은 건드리지 않는다', async () => {
    const terrace = (await getSpace(db, 'space-2'))!;

    expect(await saveSpacePatch(db, terrace, { lightGrade: 'low' }, context)).toBe(0);
    expect((await getPlantWithSpace(db, 'plant-1'))?.plant.nextWaterAt).toBe(at(11, 21));
  });
});

describe('공간 한 개 읽기·고치기·지우기', () => {
  it('없는 공간은 null', async () => {
    expect(await getSpace(db, 'ghost')).toBeNull();
  });

  it('사진 판단(JSON)을 고쳐 쓰고 다시 읽는다', async () => {
    await updateSpace(db, 'space-1', { aiEvidence: { grade: 'low', confidence: 0.7 } });

    expect((await getSpace(db, 'space-1'))?.aiEvidence).toEqual({ grade: 'low', confidence: 0.7 });
  });

  it('식물이 있는 공간은 지우지 않는다', async () => {
    expect(await deleteSpace(db, 'space-1')).toEqual({ deleted: false, photoPath: null });
    expect(await getSpace(db, 'space-1')).not.toBeNull();
  });

  it('빈 공간은 지우고 사진 경로를 돌려준다. 파일은 부른 쪽이 지운다', async () => {
    expect(await deleteSpace(db, 'space-2')).toEqual({
      deleted: true,
      photoPath: 'spaces/space-1.jpg',
    });
    expect(await getSpace(db, 'space-2')).toBeNull();
    expect(await deleteSpace(db, 'space-2')).toEqual({ deleted: false, photoPath: null });
  });
});

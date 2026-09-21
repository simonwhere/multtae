import { beforeEach, describe, expect, it } from 'vitest';

import { insertPlant } from './plants';
import type { NewPlant, NewSpace } from './schema';
import { insertSpace } from './spaces';
import { insertPlantTasks, listPlantTasks, markTaskDone } from './tasks';
import { createTestDb } from './testing/test-db';
import type { TestDb } from './testing/test-db';

let db: TestDb;

beforeEach(async () => {
  ({ db } = createTestDb());
  await insertSpace(db, {
    id: 'space-1',
    name: '베란다',
    direction: 'S',
    spaceType: 'balcony_ext',
    lightGrade: 'high',
    lightSource: 'default',
    createdAt: 1,
  } satisfies NewSpace);
  await insertPlant(
    db,
    {
      id: 'plant-1',
      spaceId: 'space-1',
      nickname: '곰솔',
      groupCode: 'bonsai_conifer',
      potSize: 'm',
      soilType: 'akadama',
      isBonsai: true,
      bonsaiGroup: 'conifer',
      lastWateredAt: 1,
      createdAt: 1,
    } satisfies NewPlant,
    [],
  );
});

describe('분재 작업 (SPEC.md 6.2)', () => {
  it('등록할 때 넣고 월 순서로 읽는다', async () => {
    await insertPlantTasks(db, [
      { id: 't2', plantId: 'plant-1', taskCode: 'repot', monthStart: 3, monthEnd: 4, labelKo: '분갈이' },
      { id: 't1', plantId: 'plant-1', taskCode: 'pinch', monthStart: 5, monthEnd: 6, labelKo: '순따기' },
    ]);

    expect((await listPlantTasks(db, 'plant-1')).map((task) => task.labelKo)).toEqual([
      '분갈이',
      '순따기',
    ]);
  });

  it('올해 마친 것으로 표시하고 되돌린다', async () => {
    await insertPlantTasks(db, [
      { id: 't1', plantId: 'plant-1', taskCode: 'pinch', monthStart: 5, monthEnd: 6, labelKo: '순따기' },
    ]);

    await markTaskDone(db, 't1', 2026);
    expect((await listPlantTasks(db, 'plant-1'))[0]?.doneYear).toBe(2026);

    await markTaskDone(db, 't1', null);
    expect((await listPlantTasks(db, 'plant-1'))[0]?.doneYear).toBeNull();
  });

  it('같은 id 를 두 번 넣어도 늘지 않는다', async () => {
    const task = { id: 't1', plantId: 'plant-1', taskCode: 'pinch', monthStart: 5, monthEnd: 6, labelKo: '순따기' };
    await insertPlantTasks(db, [task]);
    await insertPlantTasks(db, [task]);

    expect(await listPlantTasks(db, 'plant-1')).toHaveLength(1);
  });
});

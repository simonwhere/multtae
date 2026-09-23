import { beforeEach, describe, expect, it } from 'vitest';

import { insertEvent } from '../db/events';
import { addPlantPhoto } from '../db/photos';
import { insertPlant, listPlantsWithSpace } from '../db/plants';
import { getSetting, setSetting } from '../db/settings';
import { insertSpace, listSpaces } from '../db/spaces';
import { createTestDb } from '../db/testing/test-db';
import type { TestDb } from '../db/testing/test-db';
import { buildBackup, parseBackup } from './backup';
import { deleteAll, readAll, replaceAll } from './store';

let db: TestDb;

beforeEach(async () => {
  ({ db } = createTestDb());
  await insertSpace(db, {
    id: 'space-1',
    name: '거실 창가',
    photoPath: 'spaces/1.jpg',
    direction: 'S',
    spaceType: 'indoor_window',
    lightGrade: 'medium',
    lightSource: 'default',
    createdAt: 1,
  });
  await insertPlant(
    db,
    {
      id: 'plant-1',
      spaceId: 'space-1',
      nickname: '몬스테라',
      groupCode: 'tropical',
      potSize: 'm',
      soilType: 'potting',
      lastWateredAt: 1_000,
      nextWaterAt: 2_000,
      coverPhotoPath: 'plants/cover.jpg',
      createdAt: 1_000,
    },
    [],
  );
  await addPlantPhoto(db, { id: 'photo-1', plantId: 'plant-1', path: 'plants/1.jpg', takenAt: 1_200 });
  await insertEvent(db, {
    id: 'event-1',
    plantId: 'plant-1',
    type: 'diagnose',
    occurredAt: 1_300,
    photoPath: 'plants/diag.jpg',
  });
  await setSetting(db, 'notify_time', '07:30');
});

describe('내보내기와 가져오기 (SPEC.md 3.6)', () => {
  it('읽은 것을 그대로 다시 넣는다', async () => {
    const backup = buildBackup(await readAll(db), '0.1.0', 1_790_000_000_000);
    const text = JSON.stringify(backup);

    await replaceAll(db, parseBackup(text)!);

    expect((await listSpaces(db)).map((space) => space.name)).toEqual(['거실 창가']);
    expect((await listPlantsWithSpace(db)).map(({ plant }) => plant.nickname)).toEqual(['몬스테라']);
    expect(await getSetting(db, 'notify_time')).toBe('07:30');
    expect(await readAll(db)).toEqual(backupTables(backup));
  });

  it('가져오면 지금 것은 지우고, 가져온 사진 파일은 남긴다', async () => {
    const backup = parseBackup(JSON.stringify(buildBackup(await readAll(db), '0.1.0', 1)))!;
    // 다른 기기에서 온 파일이라고 하자: 공간 하나뿐이고 사진은 다른 경로다
    const other = {
      ...backup,
      plants: [],
      wateringLogs: [],
      events: [],
      plantTasks: [],
      photos: [],
      spaces: [{ ...backup.spaces[0]!, id: 'space-9', photoPath: 'spaces/9.jpg' }],
    };

    const removed = await replaceAll(db, other);

    expect(removed.sort()).toEqual(['plants/1.jpg', 'plants/cover.jpg', 'plants/diag.jpg', 'spaces/1.jpg']);
    expect((await listSpaces(db)).map((space) => space.id)).toEqual(['space-9']);
    expect((await readAll(db)).plants).toEqual([]);
  });

  it('전체 삭제는 사진 경로를 돌려주고 표를 비운다', async () => {
    const removed = await deleteAll(db);

    expect(removed.sort()).toEqual(['plants/1.jpg', 'plants/cover.jpg', 'plants/diag.jpg', 'spaces/1.jpg']);
    expect(await readAll(db)).toEqual({
      spaces: [],
      plants: [],
      wateringLogs: [],
      events: [],
      plantTasks: [],
      photos: [],
      settings: [],
    });
  });
});

function backupTables(backup: ReturnType<typeof buildBackup>) {
  const { app, version, exportedAt, appVersion, ...tables } = backup;
  return tables;
}

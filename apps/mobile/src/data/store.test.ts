import { beforeEach, describe, expect, it } from 'vitest';

import { insertEvent } from '../db/events';
import { addPlantPhoto } from '../db/photos';
import { insertPlant, listPlantsWithSpace } from '../db/plants';
import { getSetting, setSetting } from '../db/settings';
import { insertSpace, listSpaces } from '../db/spaces';
import { createTestDb } from '../db/testing/test-db';
import type { TestDb } from '../db/testing/test-db';
import { buildBackup, parseBackup } from './backup';
import { deleteAll, mergeAll, readAll, replaceAll } from './store';

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

describe('예전 파일 (9-2 이전)', () => {
  it('고친 시각이 없는 행은 등록한 때로 채워 넣는다. 다음에 합칠 때 판단이 흔들리지 않게', async () => {
    const backup = buildBackup(await readAll(db), '0.1.0', 1);
    const old = {
      ...backup,
      plants: backup.plants.map(({ updatedAt: _dropped, ...row }) => row),
      spaces: backup.spaces.map(({ updatedAt: _dropped, ...row }) => row),
    };

    await replaceAll(db, old);

    const tablesAfter = await readAll(db);
    expect(tablesAfter.plants[0]?.updatedAt).toBe(tablesAfter.plants[0]?.createdAt);
    expect(tablesAfter.spaces[0]?.updatedAt).toBe(tablesAfter.spaces[0]?.createdAt);
  });
});

describe('합치기 (9-2)', () => {
  it('지금 기록은 두고 파일에만 있는 식물과 기록을 더한다. 설정은 이 기기 것이다', async () => {
    const mine = buildBackup(await readAll(db), '0.1.0', 1);
    // 가족 기기: 같은 몬스테라에 오늘 물을 줬고, 새 식물을 하나 들였다
    const theirs = {
      ...mine,
      plants: [
        { ...mine.plants[0]!, lastWateredAt: 5_000, nextWaterAt: 9_000, updatedAt: 5_000 },
        { ...mine.plants[0]!, id: 'plant-2', nickname: '금귤', coverPhotoPath: null, createdAt: 4_000, updatedAt: 4_000 },
      ],
      wateringLogs: [
        { id: 'log-9', plantId: 'plant-1', wateredAt: 5_000, soilState: 'ok' as const, source: 'user' as const },
      ],
      settings: [{ key: 'notify_time' as const, value: '06:00' }],
    };

    const { result, removedPaths } = await mergeAll(db, theirs);

    const plants = await listPlantsWithSpace(db);
    expect(plants.map(({ plant }) => plant.nickname).sort()).toEqual(['금귤', '몬스테라']);
    expect(plants.find(({ plant }) => plant.id === 'plant-1')?.plant.lastWateredAt).toBe(5_000);
    expect((await readAll(db)).wateringLogs.map((log) => log.id)).toEqual(['log-9']);
    expect(await getSetting(db, 'notify_time')).toBe('07:30');
    expect(result.added).toMatchObject({ plants: 1, records: 1 });
    // 이 기기 사진은 모두 남는다
    expect(removedPaths).toEqual([]);
  });
});

describe('기기마다 다른 설정 (9-4)', () => {
  it('알림 권한을 물었는지는 파일로 옮기지 않고, 바꾸거나 합쳐도 이 기기 값을 둔다', async () => {
    await setSetting(db, 'notification_asked', '1');
    const backup = buildBackup(await readAll(db), '0.1.0', 1);
    expect(backup.settings.map((row) => row.key)).toEqual(['notify_time']);

    // 다른 기기에서 온 파일에 섞여 있어도 읽지 않는다
    const foreign = parseBackup(
      JSON.stringify({ ...backup, settings: [...backup.settings, { key: 'notification_asked', value: '1' }] }),
    )!;
    expect(foreign.settings.map((row) => row.key)).toEqual(['notify_time']);

    await replaceAll(db, foreign);
    expect(await getSetting(db, 'notification_asked')).toBe('1');

    await mergeAll(db, foreign);
    expect(await getSetting(db, 'notification_asked')).toBe('1');
  });

  it('전체 삭제하면 처음처럼 다시 묻는다', async () => {
    await setSetting(db, 'notification_asked', '1');
    await deleteAll(db);
    expect(await getSetting(db, 'notification_asked')).toBeNull();
  });
});

function backupTables(backup: ReturnType<typeof buildBackup>) {
  const { app, version, exportedAt, appVersion, ...tables } = backup;
  return tables;
}

import { describe, expect, it } from 'vitest';

import { backupFileName, backupSummary, buildBackup, parseBackup } from './backup';
import type { BackupTables } from './backup';

const tables: BackupTables = {
  spaces: [
    {
      id: 'space-1',
      name: '거실 창가',
      direction: 'S',
      spaceType: 'indoor_window',
      lightGrade: 'medium',
      lightSource: 'default',
      createdAt: 1,
    },
  ],
  plants: [
    {
      id: 'plant-1',
      spaceId: 'space-1',
      nickname: '몬스테라',
      groupCode: 'tropical',
      potSize: 'm',
      soilType: 'potting',
      lastWateredAt: 1_000,
      nextWaterAt: 2_000,
      createdAt: 1_000,
    },
  ],
  wateringLogs: [
    { id: 'log-1', plantId: 'plant-1', wateredAt: 1_500, soilState: 'ok', source: 'user' },
  ],
  events: [{ id: 'event-1', plantId: 'plant-1', type: 'fertilize', occurredAt: 1_600 }],
  plantTasks: [
    { id: 'task-1', plantId: 'plant-1', taskCode: 'pinch', monthStart: 5, monthEnd: 6, labelKo: '순따기' },
  ],
  photos: [{ id: 'photo-1', plantId: 'plant-1', path: 'plants/1.jpg', takenAt: 1_200 }],
  settings: [{ key: 'notify_time', value: '08:00' }],
};

const text = () => JSON.stringify(buildBackup(tables, '0.1.0', 1_790_000_000_000));

describe('내보내기 파일 (SPEC.md 3.6, 8.4)', () => {
  it('앱 이름과 판, 내보낸 시각을 적는다', () => {
    expect(JSON.parse(text())).toMatchObject({
      app: 'multtae',
      version: 1,
      exportedAt: 1_790_000_000_000,
      appVersion: '0.1.0',
    });
  });

  it('내보낸 것을 그대로 다시 읽는다', () => {
    expect(parseBackup(text())).toMatchObject(tables);
  });

  it('파일 이름은 날짜로', () => {
    expect(backupFileName({ year: 2026, month: 9, day: 3 }, 'json')).toBe('multtae-20260903.json');
    expect(backupFileName({ year: 2026, month: 12, day: 25 }, 'zip')).toBe('multtae-20261225.zip');
  });

  it('무엇이 들어 있는지 센다', () => {
    expect(backupSummary(parseBackup(text())!)).toEqual({
      spaces: 1,
      plants: 1,
      records: 2,
      photos: 1,
    });
  });
});

describe('parseBackup: 가져오기 검사', () => {
  it('우리 앱 파일이 아니거나 판이 높으면 받지 않는다', () => {
    expect(parseBackup('{broken')).toBeNull();
    expect(parseBackup(JSON.stringify({ app: 'other', version: 1 }))).toBeNull();
    expect(parseBackup(JSON.stringify({ app: 'multtae', version: 2 }))).toBeNull();
  });

  it('없는 공간에 딸린 식물과, 없는 식물에 딸린 기록은 버린다', () => {
    const broken = JSON.parse(text());
    broken.plants.push({ ...tables.plants[0], id: 'plant-2', spaceId: 'gone' });
    broken.wateringLogs.push({ id: 'log-2', plantId: 'plant-2', wateredAt: 1, soilState: 'ok', source: 'user' });
    broken.photos.push({ id: 'photo-2', plantId: 'gone', path: 'plants/2.jpg', takenAt: 1 });

    const parsed = parseBackup(JSON.stringify(broken));

    expect(parsed?.plants.map((plant) => plant.id)).toEqual(['plant-1']);
    expect(parsed?.wateringLogs.map((log) => log.id)).toEqual(['log-1']);
    expect(parsed?.photos.map((photo) => photo.id)).toEqual(['photo-1']);
  });

  it('꼭 있어야 하는 값이 빠진 행과 모르는 설정 키는 버린다', () => {
    const broken = JSON.parse(text());
    broken.spaces.push({ id: 'space-2' });
    broken.events.push({ id: 'event-2', plantId: 'plant-1' });
    broken.settings.push({ key: 'unknown_key', value: '1' }, { key: 'dnd_start', value: 7 });

    const parsed = parseBackup(JSON.stringify(broken));

    expect(parsed?.spaces.map((space) => space.id)).toEqual(['space-1']);
    expect(parsed?.events.map((event) => event.id)).toEqual(['event-1']);
    expect(parsed?.settings).toEqual([{ key: 'notify_time', value: '08:00' }]);
  });

  it('표가 통째로 빠져 있어도 읽는다', () => {
    expect(parseBackup(JSON.stringify({ app: 'multtae', version: 1 }))).toMatchObject({
      spaces: [],
      plants: [],
      settings: [],
    });
  });
});

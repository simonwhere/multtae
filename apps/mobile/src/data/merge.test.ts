import { describe, expect, it } from 'vitest';

import type { NewPhoto, NewPlant, NewSpace } from '../db/schema';
import type { BackupTables } from './backup';
import { MAX_PHOTOS_PER_PLANT, planMerge } from './merge';

const space = (patch: Partial<NewSpace> = {}): NewSpace => ({
  id: 'space-1',
  name: '거실 창가',
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'medium',
  lightSource: 'default',
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

const plant = (patch: Partial<NewPlant> = {}): NewPlant => ({
  id: 'plant-1',
  spaceId: 'space-1',
  nickname: '몬스테라',
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  learnFactor: 1,
  lastWateredAt: 1_000,
  nextWaterAt: 8_000,
  postponeCount: 0,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

const tables = (patch: Partial<BackupTables> = {}): BackupTables => ({
  spaces: [space()],
  plants: [plant()],
  wateringLogs: [],
  events: [],
  plantTasks: [],
  photos: [],
  settings: [],
  ...patch,
});

describe('planMerge: 가족과 나눈 파일 합치기 (9-2)', () => {
  it('파일에만 있는 공간·식물·기록·사진을 더한다', () => {
    const incoming = tables({
      spaces: [space(), space({ id: 'space-2', name: '베란다' })],
      plants: [plant(), plant({ id: 'plant-2', spaceId: 'space-2', nickname: '금귤' })],
      wateringLogs: [
        { id: 'log-2', plantId: 'plant-2', wateredAt: 2_000, soilState: 'ok', source: 'user' },
      ],
      photos: [{ id: 'photo-2', plantId: 'plant-2', path: 'plants/2.jpg', takenAt: 2_000 }],
    });

    const { tables: merged, added } = planMerge(tables(), incoming);

    expect(merged.spaces.map((row) => row.id)).toEqual(['space-1', 'space-2']);
    expect(merged.plants.map((row) => row.id)).toEqual(['plant-1', 'plant-2']);
    expect(added).toEqual({ spaces: 1, plants: 1, records: 1, photos: 1 });
  });

  it('물 준 기록은 id 로 합쳐 겹치지 않는다', () => {
    const log = { id: 'log-1', plantId: 'plant-1', wateredAt: 1_000, soilState: 'ok' as const, source: 'user' as const };
    const theirs = { ...log, id: 'log-2', wateredAt: 5_000 };

    const { tables: merged, added } = planMerge(
      tables({ wateringLogs: [log] }),
      tables({ wateringLogs: [log, theirs] }),
    );

    expect(merged.wateringLogs.map((row) => row.id)).toEqual(['log-1', 'log-2']);
    expect(added.records).toBe(1);
  });

  it('같은 식물은 물 준 상태를 더 최근에 물 준 쪽에서 가져온다', () => {
    // 내가 월요일에, 가족이 화요일에 물을 줬다
    const mine = plant({ lastWateredAt: 1_000, nextWaterAt: 8_000, learnFactor: 1, updatedAt: 1_000 });
    const theirs = plant({ lastWateredAt: 2_000, nextWaterAt: 9_000, learnFactor: 0.85, updatedAt: 2_000 });

    const { tables: merged, updated } = planMerge(tables({ plants: [mine] }), tables({ plants: [theirs] }));

    expect(merged.plants[0]).toMatchObject({ lastWateredAt: 2_000, nextWaterAt: 9_000, learnFactor: 0.85 });
    expect(updated.plants).toBe(1);
  });

  it('이름·자리는 더 최근에 고친 쪽, 물 준 상태는 더 최근에 물 준 쪽이다', () => {
    // 내가 어제 물을 줬고, 가족은 그 사실을 모른 채 오늘 이름을 바꿨다
    const mine = plant({ nickname: '몬스테라', lastWateredAt: 5_000, nextWaterAt: 12_000, updatedAt: 5_000 });
    const theirs = plant({ nickname: '큰 몬스테라', lastWateredAt: 1_000, nextWaterAt: 8_000, updatedAt: 6_000 });

    const { tables: merged } = planMerge(tables({ plants: [mine] }), tables({ plants: [theirs] }));

    expect(merged.plants[0]).toMatchObject({
      nickname: '큰 몬스테라',
      lastWateredAt: 5_000,
      nextWaterAt: 12_000,
      updatedAt: 6_000,
    });
  });

  it('양쪽이 똑같으면 바꾼 것이 없다', () => {
    const { updated, added } = planMerge(tables(), tables());

    expect(updated).toEqual({ spaces: 0, plants: 0 });
    expect(added).toEqual({ spaces: 0, plants: 0, records: 0, photos: 0 });
  });

  it('고친 시각만 다르고 내용이 같으면 맞춘 것으로 세지 않는다', () => {
    const { updated } = planMerge(
      tables({ plants: [plant({ updatedAt: 0 })] }),
      tables({ plants: [plant({ updatedAt: 50 })] }),
    );

    expect(updated.plants).toBe(0);
  });

  it('공간도 더 최근에 고친 쪽이다', () => {
    const { tables: merged, updated } = planMerge(
      tables({ spaces: [space({ lightGrade: 'medium', updatedAt: 5 })] }),
      tables({ spaces: [space({ lightGrade: 'high', updatedAt: 9 })] }),
    );

    expect(merged.spaces[0]?.lightGrade).toBe('high');
    expect(updated.spaces).toBe(1);
  });

  it('고친 시각이 없는 예전 파일은 등록한 때를 고친 때로 본다', () => {
    const old = plant({ nickname: '예전 이름', updatedAt: undefined, createdAt: 1 });
    const { tables: merged } = planMerge(tables({ plants: [plant({ updatedAt: 10 })] }), tables({ plants: [old] }));

    expect(merged.plants[0]?.nickname).toBe('몬스테라');
  });

  it('설정은 이 기기 것을 그대로 둔다. 알림 시각과 기기 번호는 사람마다 다르다', () => {
    const { tables: merged } = planMerge(
      tables({ settings: [{ key: 'notify_time', value: '08:00' }, { key: 'device_id', value: 'mine' }] }),
      tables({ settings: [{ key: 'notify_time', value: '07:00' }, { key: 'device_id', value: 'theirs' }] }),
    );

    expect(merged.settings).toEqual([
      { key: 'notify_time', value: '08:00' },
      { key: 'device_id', value: 'mine' },
    ]);
  });

  it(`한 식물의 사진이 ${MAX_PHOTOS_PER_PLANT}장을 넘으면 오래된 것부터 뺀다`, () => {
    const photo = (index: number): NewPhoto => ({
      id: `photo-${index}`,
      plantId: 'plant-1',
      path: `plants/${index}.jpg`,
      takenAt: index,
    });
    const mine = Array.from({ length: MAX_PHOTOS_PER_PLANT }, (_, index) => photo(index + 1));
    const theirs = [photo(1_000)];

    const { tables: merged } = planMerge(tables({ photos: mine }), tables({ photos: theirs }));

    expect(merged.photos).toHaveLength(MAX_PHOTOS_PER_PLANT);
    expect(merged.photos.some((row) => row.id === 'photo-1000')).toBe(true);
    expect(merged.photos.some((row) => row.id === 'photo-1')).toBe(false);
  });
});

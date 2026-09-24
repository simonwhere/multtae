/**
 * 가족과 나눈 파일 합치기 (9-2). 서버를 쓰지 않고 파일을 주고받아 두 기기의 기록을 맞춘다.
 * 파일과 DB 는 다루지 않는 순수 함수다. 쓰는 일은 store.ts 가 한다.
 *
 * - 파일에만 있는 공간·식물·기록·사진은 더한다
 * - 같은 식물은 물 준 상태를 더 최근에 물 준 쪽에서, 이름·자리 같은 나머지는 더 최근에 고친 쪽에서 가져온다
 * - 물 준 기록·이벤트·작업·사진은 id 로 합친다
 * - 설정은 이 기기 것을 둔다. 알림 시각과 기기 번호는 사람마다 다르다
 * - 지운 것은 전해지지 않는다. 한쪽에서 지운 식물은 다른 쪽 파일을 합치면 돌아온다
 */
import type { NewPlant, NewSpace } from '../db/schema';
import type { BackupTables } from './backup';

/** 식물 하나의 사진 상한. db/photos.ts addPlantPhoto 와 같다 (SPEC 15 이미지) */
export const MAX_PHOTOS_PER_PLANT = 100;

/** 물을 줄 때마다 함께 바뀌는 값. 더 최근에 물 준 쪽 것을 쓴다 */
const WATERING_FIELDS = [
  'lastWateredAt',
  'lastWateredUnknown',
  'nextWaterAt',
  'postponeCount',
  'learnFactor',
] as const satisfies readonly (keyof NewPlant)[];

export interface MergeResult {
  tables: BackupTables;
  /** 파일에서 새로 들어온 것 */
  added: { spaces: number; plants: number; records: number; photos: number };
  /** 양쪽에 있던 것 중 파일 쪽으로 맞춘 것 */
  updated: { spaces: number; plants: number };
}

/** 사람이 마지막으로 고친 시각. 예전 파일에는 없어서 등록한 때로 본다 */
const editedAt = (row: { updatedAt?: number | null; createdAt: number }) =>
  row.updatedAt ?? row.createdAt;

function unionById<T extends { id: string }>(
  mine: readonly T[],
  theirs: readonly T[],
): { rows: T[]; added: number } {
  const ids = new Set(mine.map((row) => row.id));
  const extra = theirs.filter((row) => !ids.has(row.id));
  return { rows: [...mine, ...extra], added: extra.length };
}

/** 내용이 같은지. 고친 시각은 기록일 뿐이라 비교하지 않는다 */
function sameRow(a: object, b: object): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('updatedAt');
  return [...keys].every(
    (key) =>
      JSON.stringify((a as Record<string, unknown>)[key] ?? null) ===
      JSON.stringify((b as Record<string, unknown>)[key] ?? null),
  );
}

/** 양쪽에 다 있으면 고르고, 한쪽에만 있으면 그대로 둔다 */
function mergeRows<T extends { id: string }>(
  mine: readonly T[],
  theirs: readonly T[],
  pick: (mine: T, theirs: T) => T,
): { rows: T[]; added: number; updated: number } {
  const theirsById = new Map(theirs.map((row) => [row.id, row]));
  let updated = 0;
  const rows = mine.map((row) => {
    const other = theirsById.get(row.id);
    if (!other) return row;
    const merged = pick(row, other);
    if (!sameRow(merged, row)) updated += 1;
    return merged;
  });
  const { rows: all, added } = unionById(rows, theirs);
  return { rows: all, added, updated };
}

const pickSpace = (mine: NewSpace, theirs: NewSpace): NewSpace =>
  editedAt(theirs) > editedAt(mine) ? theirs : mine;

function pickPlant(mine: NewPlant, theirs: NewPlant): NewPlant {
  const base = editedAt(theirs) > editedAt(mine) ? theirs : mine;
  const watered = (theirs.lastWateredAt ?? 0) > (mine.lastWateredAt ?? 0) ? theirs : mine;
  const merged: NewPlant = { ...base, updatedAt: Math.max(editedAt(mine), editedAt(theirs)) };
  for (const field of WATERING_FIELDS) {
    (merged as Record<string, unknown>)[field] = watered[field];
  }
  return merged;
}

/** 식물마다 최근 사진만 남긴다 */
function capPhotos(photos: BackupTables['photos']): BackupTables['photos'] {
  const byPlant = new Map<string, BackupTables['photos']>();
  for (const photo of photos) {
    const list = byPlant.get(photo.plantId) ?? [];
    list.push(photo);
    byPlant.set(photo.plantId, list);
  }
  const kept = new Set<string>();
  for (const list of byPlant.values()) {
    [...list]
      .sort((a, b) => b.takenAt - a.takenAt)
      .slice(0, MAX_PHOTOS_PER_PLANT)
      .forEach((photo) => kept.add(photo.id));
  }
  return photos.filter((photo) => kept.has(photo.id));
}

export function planMerge(mine: BackupTables, theirs: BackupTables): MergeResult {
  const spaces = mergeRows(mine.spaces, theirs.spaces, pickSpace);
  const plants = mergeRows(mine.plants, theirs.plants, pickPlant);
  const logs = unionById(mine.wateringLogs, theirs.wateringLogs);
  const events = unionById(mine.events, theirs.events);
  const tasks = unionById(mine.plantTasks, theirs.plantTasks);
  const photos = unionById(mine.photos, theirs.photos);
  const cappedPhotos = capPhotos(photos.rows);

  return {
    tables: {
      spaces: spaces.rows,
      plants: plants.rows,
      wateringLogs: logs.rows,
      events: events.rows,
      plantTasks: tasks.rows,
      photos: cappedPhotos,
      settings: mine.settings,
    },
    added: {
      spaces: spaces.added,
      plants: plants.added,
      records: logs.added + events.added,
      photos: cappedPhotos.filter((photo) => !mine.photos.some((own) => own.id === photo.id)).length,
    },
    updated: { spaces: spaces.updated, plants: plants.updated },
  };
}

/**
 * 내보내기·가져오기 (SPEC.md 3.6 데이터, 8.4). 기기 안의 모든 기록을 JSON 하나로 옮긴다.
 * 파일과 DB 는 여기서 다루지 않는다. 모양을 만들고 검사하는 순수 함수다.
 */
import type {
  NewPhoto,
  NewPlant,
  NewPlantEvent,
  NewPlantTask,
  NewSpace,
  NewWateringLog,
  SettingKey,
} from '../db/schema';
import { SETTING_KEYS } from '../db/schema';
import { isOneOf, isString, parseJsonObject } from '../lib/validate';

/** 파일 안에 적는 이름과 판. 판이 다르면 가져오지 않는다 */
export const BACKUP_APP = 'multtae';
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  /** 내보낸 시각 (epoch ms) */
  exportedAt: number;
  /** 내보낸 앱 버전 */
  appVersion: string;
  spaces: NewSpace[];
  plants: NewPlant[];
  wateringLogs: NewWateringLog[];
  events: NewPlantEvent[];
  plantTasks: NewPlantTask[];
  photos: NewPhoto[];
  settings: { key: SettingKey; value: string }[];
}

export type BackupTables = Omit<Backup, 'app' | 'version' | 'exportedAt' | 'appVersion'>;

/** 기기마다 다른 설정. 파일로 옮기지 않고, 가져와도 이 기기의 값을 그대로 둔다 */
export const DEVICE_ONLY_SETTINGS: readonly SettingKey[] = ['notification_asked'];

export const isPortableSetting = (row: { key: SettingKey }): boolean =>
  !DEVICE_ONLY_SETTINGS.includes(row.key);

export function buildBackup(tables: BackupTables, appVersion: string, now: number): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now,
    appVersion,
    ...tables,
    settings: tables.settings.filter(isPortableSetting),
  };
}

const rows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          typeof row === 'object' && row !== null && !Array.isArray(row),
      )
    : [];

const isText = (value: unknown): value is string => isString(value) && value !== '';
const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * 가져온 파일을 읽는다. 우리 앱의 파일이 아니거나 판이 높으면 null.
 * 행은 꼭 있어야 하는 값이 빠진 것만 버리고, 나머지는 그대로 넣는다. 앱이 모르는 값은 DB 가 무시한다.
 */
export function parseBackup(text: string): Backup | null {
  const raw = parseJsonObject(text);
  if (!raw || raw.app !== BACKUP_APP) return null;
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) return null;

  const spaces = rows(raw.spaces).filter(
    (row) => isText(row.id) && isText(row.name) && isText(row.direction) && isText(row.spaceType),
  ) as unknown as NewSpace[];
  const spaceIds = new Set(spaces.map((space) => space.id));

  // 공간이 없는 식물은 넣을 수 없다 (외래 키)
  const plants = rows(raw.plants).filter(
    (row) => isText(row.id) && isText(row.nickname) && isText(row.spaceId) && spaceIds.has(row.spaceId as string),
  ) as unknown as NewPlant[];
  const plantIds = new Set(plants.map((plant) => plant.id));
  const ofPlant = (row: Record<string, unknown>) =>
    isText(row.id) && isText(row.plantId) && plantIds.has(row.plantId);

  return {
    app: BACKUP_APP,
    version: raw.version,
    exportedAt: isTime(raw.exportedAt) ? raw.exportedAt : 0,
    appVersion: isString(raw.appVersion) ? raw.appVersion : '',
    spaces,
    plants,
    wateringLogs: rows(raw.wateringLogs).filter(
      (row) => ofPlant(row) && isTime(row.wateredAt),
    ) as unknown as NewWateringLog[],
    events: rows(raw.events).filter(
      (row) => ofPlant(row) && isText(row.type) && isTime(row.occurredAt),
    ) as unknown as NewPlantEvent[],
    plantTasks: rows(raw.plantTasks).filter(
      (row) => ofPlant(row) && isText(row.taskCode) && isText(row.labelKo),
    ) as unknown as NewPlantTask[],
    photos: rows(raw.photos).filter(
      (row) => ofPlant(row) && isText(row.path) && isTime(row.takenAt),
    ) as unknown as NewPhoto[],
    settings: rows(raw.settings)
      .filter(
        (row): row is { key: SettingKey; value: string } =>
          isOneOf(SETTING_KEYS, row.key) && isString(row.value),
      )
      .filter(isPortableSetting),
  };
}

/** 내보내기 파일 이름: multtae-20260923.json */
export function backupFileName(date: { year: number; month: number; day: number }, extension: string): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `multtae-${date.year}${pad(date.month)}${pad(date.day)}.${extension}`;
}

/** 가져온 파일에 적힌 내용 요약 (덮어쓰기 전에 보여 준다) */
export function backupSummary(backup: Backup): { spaces: number; plants: number; records: number; photos: number } {
  return {
    spaces: backup.spaces.length,
    plants: backup.plants.length,
    records: backup.wateringLogs.length + backup.events.length,
    photos: backup.photos.length,
  };
}

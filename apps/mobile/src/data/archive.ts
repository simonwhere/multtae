/**
 * 내보내기·가져오기의 파일 쪽 (SPEC.md 3.6 데이터, 8.4). 기록 JSON 과 사진을 압축 파일 하나로 묶는다.
 * 서버로 보내지 않고 기기 안에서 만들어 공유 시트로 건넨다 (CLAUDE.md 절대 규칙).
 */
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

import { db } from '@/db/client';
import { toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { deletePhoto } from '@/photos/photo-store';

import { backupFileName, backupSummary, buildBackup, parseBackup } from './backup';
import type { Backup, BackupTables } from './backup';
import type { MergeResult } from './merge';
import { deleteAll, mergeAll, readAll, replaceAll } from './store';

/** 압축 파일 안의 기록 파일 이름 */
const DATA_FILE = 'multtae.json';
const EXPORT_DIR = 'exports';

function photoPathsOf(tables: BackupTables): string[] {
  const paths = new Set<string>();
  for (const photo of tables.photos) paths.add(photo.path);
  for (const plant of tables.plants) if (plant.coverPhotoPath) paths.add(plant.coverPhotoPath);
  for (const space of tables.spaces) if (space.photoPath) paths.add(space.photoPath);
  for (const event of tables.events) if (event.photoPath) paths.add(event.photoPath);
  return [...paths];
}

export type ExportResult = 'shared' | 'empty' | 'unavailable' | 'failed';

/** 기록과 사진을 압축해 공유 시트로 건넨다 */
export async function exportBackup(
  now = Date.now(),
  utcOffsetMinutes = -new Date().getTimezoneOffset(),
): Promise<ExportResult> {
  try {
    const tables = await readAll(db);
    if (tables.spaces.length === 0 && tables.plants.length === 0) return 'empty';
    const backup = buildBackup(tables, Constants.expoConfig?.version ?? '', now);

    const zip = new JSZip();
    zip.file(DATA_FILE, JSON.stringify(backup));
    for (const path of photoPathsOf(tables)) {
      const photo = new File(Paths.document, path);
      if (photo.exists) zip.file(path, await photo.bytes());
    }
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const directory = new Directory(Paths.cache, EXPORT_DIR);
    directory.create({ idempotent: true, intermediates: true });
    const file = new File(directory, backupFileName(toCalendarDate(now, utcOffsetMinutes), 'zip'));
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);

    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/zip',
      dialogTitle: ko.settings.exportTitle,
    });
    return 'shared';
  } catch {
    return 'failed';
  }
}

/** 고른 파일. 합칠지 바꿀지 고르는 동안 들고 있는다 */
export interface PickedBackup {
  backup: Backup;
  photos: { path: string; bytes: Uint8Array }[];
  summary: ReturnType<typeof backupSummary>;
}

export type PickResult =
  | { status: 'picked'; picked: PickedBackup }
  | { status: 'canceled' }
  /** 우리 앱의 파일이 아니거나 읽을 수 없다 */
  | { status: 'invalid' }
  | { status: 'failed' };

/** 파일을 골라 읽기만 한다. 기기 안의 기록은 아직 그대로다 */
export async function pickBackup(): Promise<PickResult> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return { status: 'canceled' };

    const file = new File(asset.uri);
    const isZip =
      asset.name?.toLowerCase().endsWith('.zip') === true || asset.mimeType === 'application/zip';

    let backup: Backup | null = null;
    const photos: { path: string; bytes: Uint8Array }[] = [];

    if (isZip) {
      const zip = await JSZip.loadAsync(await file.bytes());
      const data = zip.file(DATA_FILE);
      if (!data) return { status: 'invalid' };
      backup = parseBackup(await data.async('string'));
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || entry.name === DATA_FILE) continue;
        photos.push({ path: entry.name, bytes: await entry.async('uint8array') });
      }
    } else {
      backup = parseBackup(await file.text());
    }
    if (!backup) return { status: 'invalid' };

    return { status: 'picked', picked: { backup, photos, summary: backupSummary(backup) } };
  } catch {
    return { status: 'failed' };
  }
}

/** 기기 안의 기록을 파일 것으로 통째로 바꾼다. 기기를 옮길 때 쓴다. 되돌릴 수 없다 */
export async function replaceWithBackup(picked: PickedBackup): Promise<boolean> {
  try {
    const removed = await replaceAll(db, picked.backup);
    removed.forEach(deletePhoto);
    for (const photo of picked.photos) writePhoto(photo.path, photo.bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * 가족이 보낸 파일을 합친다 (9-2). 지금 기록은 두고 새 것만 더한다.
 * 사진은 합친 결과가 쓰는 것 중 기기에 없는 것만 적는다.
 */
export async function mergeBackup(picked: PickedBackup): Promise<MergeResult | null> {
  try {
    const { result, removedPaths } = await mergeAll(db, picked.backup);
    removedPaths.forEach(deletePhoto);

    const used = new Set(photoPathsOf(result.tables));
    for (const photo of picked.photos) {
      if (used.has(photo.path) && !new File(Paths.document, photo.path).exists) {
        writePhoto(photo.path, photo.bytes);
      }
    }
    return result;
  } catch {
    return null;
  }
}

function writePhoto(path: string, bytes: Uint8Array): void {
  // 압축 파일 안의 경로는 문서 폴더 기준이다. 밖으로 나가는 경로는 넣지 않는다
  if (path.includes('..') || path.startsWith('/')) return;

  const file = new File(Paths.document, path);
  new Directory(file.parentDirectory).create({ idempotent: true, intermediates: true });
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
}

/** 기기 안의 기록과 사진을 모두 지운다 (3.6 전체 삭제) */
export async function eraseAll(): Promise<boolean> {
  try {
    const removed = await deleteAll(db);
    removed.forEach(deletePhoto);
    return true;
  } catch {
    return false;
  }
}

/**
 * 오늘 닫은 경고 카드 (SPEC 3.2 "닫기 가능, 당일만 표시"). 날짜가 바뀌면 저장된 값은 쓰지 않는다.
 */
import { getSetting, setSetting } from '../db/settings';
import type { Database } from '../db/types';
import { parseJsonObject } from '../lib/validate';

/** 그날 닫은 카드 키. 다른 날의 값이거나 깨졌으면 빈 목록 */
export function parseDismissed(json: string | null, date: string): string[] {
  const raw = parseJsonObject(json);
  if (!raw || raw.date !== date || !Array.isArray(raw.keys)) return [];
  return raw.keys.filter((key): key is string => typeof key === 'string');
}

export async function loadDismissed(db: Database, date: string): Promise<string[]> {
  return parseDismissed(await getSetting(db, 'dismissed_cards'), date);
}

export async function dismissCard(db: Database, date: string, key: string): Promise<string[]> {
  const keys = [...new Set([...(await loadDismissed(db, date)), key])];
  await setSetting(db, 'dismissed_cards', JSON.stringify({ date, keys }));
  return keys;
}

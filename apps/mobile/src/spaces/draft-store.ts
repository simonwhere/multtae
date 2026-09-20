import { deleteSetting, getSetting, setSetting } from '../db/settings';
import type { Database } from '../db/types';
import { parseSpaceDraft } from './registration';
import type { SpaceDraft } from './registration';

// 등록 플로우를 중간에 나가도 이어서 할 수 있게 초안을 settings 에 둔다 (SPEC 4).

export async function loadSpaceDraft(db: Database): Promise<SpaceDraft | null> {
  return parseSpaceDraft(await getSetting(db, 'draft_space'));
}

export async function saveSpaceDraft(db: Database, draft: SpaceDraft): Promise<void> {
  await setSetting(db, 'draft_space', JSON.stringify(draft));
}

export async function clearSpaceDraft(db: Database): Promise<void> {
  await deleteSetting(db, 'draft_space');
}

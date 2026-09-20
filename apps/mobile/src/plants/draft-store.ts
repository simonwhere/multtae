import { deleteSetting, getSetting, setSetting } from '../db/settings';
import type { Database } from '../db/types';
import { parsePlantDraft } from './registration';
import type { PlantDraft } from './registration';

// 등록 플로우를 중간에 나가도 이어서 할 수 있게 초안을 settings 에 둔다 (SPEC 4).

export async function loadPlantDraft(db: Database): Promise<PlantDraft | null> {
  return parsePlantDraft(await getSetting(db, 'draft_plant'));
}

export async function savePlantDraft(db: Database, draft: PlantDraft): Promise<void> {
  await setSetting(db, 'draft_plant', JSON.stringify(draft));
}

export async function clearPlantDraft(db: Database): Promise<void> {
  await deleteSetting(db, 'draft_plant');
}

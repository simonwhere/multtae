/**
 * 진단 한도용 기기 id (SPEC.md 11.3). 첫 사용 때 만든 무작위 uuid 이고 진단 요청에만 보낸다.
 * 계정이 없으므로 사람을 알아볼 수 있는 값은 쓰지 않는다.
 */
import { getSetting, setSetting } from '../db/settings';
import type { Database } from '../db/types';

export async function getDeviceId(db: Database, newId: () => string): Promise<string> {
  const stored = await getSetting(db, 'device_id');
  if (stored) return stored;

  const id = newId();
  await setSetting(db, 'device_id', id);
  return id;
}

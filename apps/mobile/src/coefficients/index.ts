/**
 * 지금 쓰는 계수 (SPEC.md 11.2). 번들 기본값으로 시작해서, 기기에 저장해 둔 마지막 서버 값이 있으면 그것으로,
 * 서버에 닿으면 새 값으로 바꾼다. 서버에 닿지 않아도 앱은 그대로 돈다.
 */
import { getSetting, setSetting } from '../db/settings';
import type { Database } from '../db/types';
import { DEFAULT_COEFFICIENTS } from '../engine';
import type { Coefficients } from '../engine';
import { parseServerRows } from './parse';

let current: Coefficients = DEFAULT_COEFFICIENTS;

export function currentCoefficients(): Coefficients {
  return current;
}

/** 테스트용: 번들 기본값으로 되돌린다 */
export function resetCoefficients(): void {
  current = DEFAULT_COEFFICIENTS;
}

/** 앱을 켤 때 한 번: 기기에 저장해 둔 마지막 서버 값을 읽는다. 없거나 깨졌으면 번들 기본값 그대로다 */
export async function loadCachedCoefficients(db: Database): Promise<void> {
  const cached = await getSetting(db, 'coefficients_cache');
  if (cached === null) return;

  try {
    current = parseServerRows(JSON.parse(cached)) ?? current;
  } catch {
    // 저장된 값이 깨졌으면 쓰던 값으로 돈다
  }
}

/**
 * 서버에서 새 값을 받아 온다. 받은 값이 멀쩡하면 바로 쓰고 기기에 저장한다.
 * 값이 바뀌었으면 true 다. 다음 물주기를 다시 세야 한다는 뜻이다.
 * fetchRows 는 서버 설정이 없으면 null 을 돌려준다.
 */
export async function refreshCoefficients(
  db: Database,
  fetchRows: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const rows = await fetchRows();
    const parsed = parseServerRows(rows);
    if (!parsed) return false;

    const changed = JSON.stringify(parsed) !== JSON.stringify(current);
    current = parsed;
    await setSetting(db, 'coefficients_cache', JSON.stringify(rows));
    return changed;
  } catch {
    return false;
  }
}

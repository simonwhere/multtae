import { beforeEach, describe, expect, it } from 'vitest';

import { getSetting, setSetting } from '../db/settings';
import { createTestDb } from '../db/testing/test-db';
import type { TestDb } from '../db/testing/test-db';
import { DEFAULT_COEFFICIENTS } from '../engine';
import { currentCoefficients, loadCachedCoefficients, refreshCoefficients, resetCoefficients } from './index';
import { toServerRows } from './parse';

const tunedRows = () =>
  toServerRows({ ...DEFAULT_COEFFICIENTS, maxPostpones: 2, hydroFixedDays: 10 });

let db: TestDb;

beforeEach(() => {
  ({ db } = createTestDb());
  resetCoefficients();
});

describe('계수 저장소 (SPEC.md 11.2)', () => {
  it('첫 실행 오프라인이면 번들 기본값으로 돈다', async () => {
    await loadCachedCoefficients(db);

    expect(currentCoefficients()).toEqual(DEFAULT_COEFFICIENTS);
  });

  it('서버에서 받으면 바로 쓰고 기기에 저장한다', async () => {
    const changed = await refreshCoefficients(db, async () => tunedRows());

    expect(changed).toBe(true);
    expect(currentCoefficients()).toMatchObject({ maxPostpones: 2, hydroFixedDays: 10 });
    expect(await getSetting(db, 'coefficients_cache')).not.toBeNull();
  });

  it('다음 실행에 서버에 닿지 않아도 마지막으로 받은 값으로 돈다', async () => {
    await refreshCoefficients(db, async () => tunedRows());
    resetCoefficients();

    await loadCachedCoefficients(db);

    expect(currentCoefficients().maxPostpones).toBe(2);
  });

  it('받은 값이 지금과 같으면 바뀌지 않았다고 알린다', async () => {
    await refreshCoefficients(db, async () => tunedRows());

    expect(await refreshCoefficients(db, async () => tunedRows())).toBe(false);
  });

  it('서버 값이 깨졌으면 버리고 쓰던 값을 그대로 쓴다', async () => {
    await refreshCoefficients(db, async () => tunedRows());

    const changed = await refreshCoefficients(db, async () => [{ key: 'pot', value: 'broken' }]);

    expect(changed).toBe(false);
    expect(currentCoefficients().maxPostpones).toBe(2);
  });

  it('서버에 닿지 못해도(설정 없음, 네트워크 오류) 조용히 넘어간다', async () => {
    expect(await refreshCoefficients(db, async () => null)).toBe(false);
    expect(
      await refreshCoefficients(db, async () => {
        throw new Error('offline');
      }),
    ).toBe(false);
    expect(currentCoefficients()).toEqual(DEFAULT_COEFFICIENTS);
  });

  it('기기에 저장된 값이 깨졌으면 번들 기본값으로 돈다', async () => {
    await setSetting(db, 'coefficients_cache', '{broken');

    await loadCachedCoefficients(db);

    expect(currentCoefficients()).toEqual(DEFAULT_COEFFICIENTS);
  });
});

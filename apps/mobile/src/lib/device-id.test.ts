import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestDb } from '../db/testing/test-db';
import type { TestDb } from '../db/testing/test-db';
import { getDeviceId } from './device-id';

let db: TestDb;

beforeEach(() => {
  ({ db } = createTestDb());
});

describe('getDeviceId (SPEC.md 11.3)', () => {
  it('처음 한 번 만들고 그 뒤로는 같은 값을 쓴다', async () => {
    const newId = vi.fn().mockReturnValueOnce('id-1').mockReturnValueOnce('id-2');

    expect(await getDeviceId(db, newId)).toBe('id-1');
    expect(await getDeviceId(db, newId)).toBe('id-1');
    expect(newId).toHaveBeenCalledTimes(1);
  });
});

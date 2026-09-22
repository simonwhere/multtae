import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from '../db/testing/test-db';
import type { TestDb } from '../db/testing/test-db';
import { dismissCard, loadDismissed, parseDismissed } from './dismissed';

let db: TestDb;

beforeEach(() => {
  ({ db } = createTestDb());
});

describe('닫은 경고 카드 (SPEC.md 3.2 당일만)', () => {
  it('닫은 카드를 그날 동안 기억한다', async () => {
    await dismissCard(db, '2026-09-22', 'heat');
    await dismissCard(db, '2026-09-22', 'dust');
    await dismissCard(db, '2026-09-22', 'heat');

    expect(await loadDismissed(db, '2026-09-22')).toEqual(['heat', 'dust']);
  });

  it('날짜가 바뀌면 다시 뜬다', async () => {
    await dismissCard(db, '2026-09-22', 'heat');

    expect(await loadDismissed(db, '2026-09-23')).toEqual([]);
    expect(await dismissCard(db, '2026-09-23', 'cold')).toEqual(['cold']);
  });

  it('깨진 값은 없는 것으로 본다', () => {
    expect(parseDismissed('{broken', '2026-09-22')).toEqual([]);
    expect(parseDismissed(JSON.stringify({ date: '2026-09-22', keys: 'heat' }), '2026-09-22')).toEqual([]);
    expect(parseDismissed(JSON.stringify({ date: '2026-09-22', keys: ['heat', 3] }), '2026-09-22')).toEqual([
      'heat',
    ]);
  });
});

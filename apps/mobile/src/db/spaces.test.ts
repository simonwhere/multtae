import { beforeEach, describe, expect, it } from 'vitest';

import { clearSpaceDraft, loadSpaceDraft, saveSpaceDraft } from '../spaces/draft-store';
import { createSpaceDraft, reduceSpaceDraft } from '../spaces/registration';
import type { NewSpace } from './schema';
import { deleteSetting, getSetting, setSetting } from './settings';
import { countSpaces, insertSpace, listSpaces } from './spaces';
import { createTestDb } from './testing/test-db';
import type { TestDb } from './testing/test-db';

const livingRoom: NewSpace = {
  id: 'space-1',
  name: '남향 실내 창가',
  photoPath: 'spaces/space-1.jpg',
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'high',
  lightSource: 'default',
  createdAt: 2_000,
};

let db: TestDb;

beforeEach(() => {
  ({ db } = createTestDb());
});

describe('settings 키-값', () => {
  it('없는 키는 null 이다', async () => {
    expect(await getSetting(db, 'notify_time')).toBeNull();
  });

  it('쓰고 읽고, 같은 키에 다시 쓰면 바뀐다', async () => {
    await setSetting(db, 'notify_time', '08:00');
    await setSetting(db, 'notify_time', '07:30');

    expect(await getSetting(db, 'notify_time')).toBe('07:30');
  });

  it('지우면 없어지고, 없는 키를 지워도 괜찮다', async () => {
    await setSetting(db, 'region_code', '11680');
    await deleteSetting(db, 'region_code');
    await deleteSetting(db, 'region_code');

    expect(await getSetting(db, 'region_code')).toBeNull();
  });
});

describe('공간 저장소', () => {
  it('처음에는 공간이 없다', async () => {
    expect(await listSpaces(db)).toEqual([]);
    expect(await countSpaces(db)).toBe(0);
  });

  it('등록한 순서대로 돌려준다', async () => {
    await insertSpace(db, { ...livingRoom, id: 'space-2', name: '테라스', createdAt: 3_000 });
    await insertSpace(db, livingRoom);

    const spaces = await listSpaces(db);

    expect(spaces.map((space) => space.name)).toEqual(['남향 실내 창가', '테라스']);
    expect(spaces[0]).toMatchObject({ ...livingRoom, aiEvidence: null });
    expect(await countSpaces(db)).toBe(2);
  });

  it('같은 id 로 다시 저장해도 하나만 남는다 (저장 도중 앱이 꺼진 뒤의 재시도)', async () => {
    await insertSpace(db, livingRoom);
    await insertSpace(db, { ...livingRoom, name: '다시 저장' });

    expect(await listSpaces(db)).toHaveLength(1);
    expect((await listSpaces(db))[0].name).toBe('남향 실내 창가');
  });
});

describe('공간 등록 임시 저장 (SPEC 4)', () => {
  const draft = [
    { type: 'photoPicked', photoPath: 'spaces/space-9.jpg' } as const,
    { type: 'next' } as const,
    { type: 'directionChosen', direction: 'W' } as const,
  ].reduce(reduceSpaceDraft, createSpaceDraft('space-9'));

  it('저장한 적이 없으면 null 이다', async () => {
    expect(await loadSpaceDraft(db)).toBeNull();
  });

  it('저장한 초안을 되살린다', async () => {
    await saveSpaceDraft(db, draft);

    expect(await loadSpaceDraft(db)).toEqual(draft);
  });

  it('다시 저장하면 마지막 초안만 남는다', async () => {
    await saveSpaceDraft(db, draft);
    const next = reduceSpaceDraft(draft, { type: 'next' });
    await saveSpaceDraft(db, next);

    expect(await loadSpaceDraft(db)).toEqual(next);
  });

  it('지우면 없다', async () => {
    await saveSpaceDraft(db, draft);
    await clearSpaceDraft(db);

    expect(await loadSpaceDraft(db)).toBeNull();
  });

  it('깨진 값이 들어 있으면 없는 것으로 본다', async () => {
    await setSetting(db, 'draft_space', '{broken');

    expect(await loadSpaceDraft(db)).toBeNull();
  });
});

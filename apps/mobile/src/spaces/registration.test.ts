import { describe, expect, it } from 'vitest';

import {
  canAdvance,
  createSpaceDraft,
  MAX_SPACE_NAME_LENGTH,
  parseSpaceDraft,
  progressOf,
  reduceSpaceDraft,
  resolveLight,
  resolveSpaceName,
  SPACE_STEPS,
  suggestSpaceName,
  toNewSpace,
} from './registration';
import type { SpaceDraft, SpaceDraftAction } from './registration';
import type { LightReading } from './light-reading';

const apply = (draft: SpaceDraft, ...actions: SpaceDraftAction[]) =>
  actions.reduce(reduceSpaceDraft, draft);

/** 사진으로 읽은 빛 (SPEC 9.2) */
const reading = (overrides: Partial<LightReading> = {}): LightReading => ({
  grade: 'medium',
  confidence: 0.8,
  evidence: ['창이 사진 왼쪽에 크게 보임'],
  windowVisible: true,
  curtain: 'sheer',
  distanceM: 1,
  noteKo: '오전에만 직사광이 들어요',
  ...overrides,
});

const empty = createSpaceDraft('space-1');
/** 사진·방향·유형까지 고르고 빛 등급 단계에 온 초안 */
const atLight = apply(
  empty,
  { type: 'photoPicked', photoPath: 'spaces/space-1.jpg' },
  { type: 'next' },
  { type: 'directionChosen', direction: 'S' },
  { type: 'next' },
  { type: 'typeChosen', spaceType: 'indoor_window' },
  { type: 'next' },
);

describe('공간 등록 단계 (SPEC.md 4.1)', () => {
  it('사진 → 방향 → 유형 → 빛 등급 → 이름 순서다', () => {
    expect(SPACE_STEPS).toEqual(['photo', 'direction', 'type', 'light', 'name']);
    expect(empty).toMatchObject({ id: 'space-1', step: 'photo' });
  });

  it('입력을 마쳐야 다음으로 간다', () => {
    expect(canAdvance(empty)).toBe(false);
    expect(apply(empty, { type: 'next' }).step).toBe('photo');

    const withPhoto = apply(empty, { type: 'photoPicked', photoPath: 'spaces/space-1.jpg' });
    expect(canAdvance(withPhoto)).toBe(true);
    expect(apply(withPhoto, { type: 'next' }).step).toBe('direction');
  });

  it('방향과 유형도 골라야 넘어간다', () => {
    const atDirection = apply(
      empty,
      { type: 'photoPicked', photoPath: 'spaces/space-1.jpg' },
      { type: 'next' },
    );
    expect(canAdvance(atDirection)).toBe(false);

    const atType = apply(atDirection, { type: 'directionChosen', direction: 'N' }, { type: 'next' });
    expect(atType.step).toBe('type');
    expect(canAdvance(atType)).toBe(false);
    expect(canAdvance(apply(atType, { type: 'typeChosen', spaceType: 'terrace' }))).toBe(true);
  });

  it('모든 단계에서 뒤로 갈 수 있고 입력은 남는다', () => {
    const back = apply(atLight, { type: 'back' }, { type: 'back' });

    expect(back.step).toBe('direction');
    expect(back).toMatchObject({ direction: 'S', spaceType: 'indoor_window' });
    expect(apply(empty, { type: 'back' }).step).toBe('photo');
  });

  it('마지막 단계에서 next 는 제자리다', () => {
    const atName = apply(atLight, { type: 'next' });

    expect(atName.step).toBe('name');
    expect(apply(atName, { type: 'next' }).step).toBe('name');
  });

  it('진행률은 흙 게이지가 차오르는 값이다: 첫 단계 1/5, 마지막 1', () => {
    expect(progressOf(empty)).toBeCloseTo(0.2, 10);
    expect(progressOf(atLight)).toBeCloseTo(0.8, 10);
    expect(progressOf(apply(atLight, { type: 'next' }))).toBe(1);
  });

  it('초안을 바꾸지 않고 새 객체를 돌려준다', () => {
    const frozen = Object.freeze({ ...empty });

    expect(() => reduceSpaceDraft(frozen, { type: 'directionChosen', direction: 'E' })).not.toThrow();
    expect(frozen.direction).toBeNull();
  });
});

describe('빛 등급 (AI 없이 기본값 표)', () => {
  it('방향과 유형으로 기본값을 정한다', () => {
    expect(resolveLight(atLight)).toEqual({ lightGrade: 'high', lightSource: 'default' });
  });

  it('방향이나 유형이 없으면 아직 정할 수 없다', () => {
    expect(resolveLight(empty)).toBeNull();
  });

  it('사용자가 고치면 manual 로 기록한다', () => {
    const edited = apply(atLight, { type: 'lightGradeChosen', lightGrade: 'medium' });

    expect(resolveLight(edited)).toEqual({ lightGrade: 'medium', lightSource: 'manual' });
  });

  it('기본값과 같은 등급을 다시 고르면 default 로 돌아온다', () => {
    const edited = apply(
      atLight,
      { type: 'lightGradeChosen', lightGrade: 'low' },
      { type: 'lightGradeChosen', lightGrade: 'high' },
    );

    expect(resolveLight(edited)).toEqual({ lightGrade: 'high', lightSource: 'default' });
  });

  it('방향이나 유형을 바꾸면 고친 등급은 버리고 새 기본값을 쓴다', () => {
    const edited = apply(atLight, { type: 'lightGradeChosen', lightGrade: 'medium' });

    expect(resolveLight(apply(edited, { type: 'directionChosen', direction: 'N' }))).toEqual({
      lightGrade: 'low',
      lightSource: 'default',
    });
    expect(resolveLight(apply(edited, { type: 'typeChosen', spaceType: 'indoor_far' }))).toEqual({
      lightGrade: 'low',
      lightSource: 'default',
    });
  });

  it('같은 방향·유형을 다시 골라도 고친 등급은 남는다', () => {
    const edited = apply(
      atLight,
      { type: 'lightGradeChosen', lightGrade: 'medium' },
      { type: 'directionChosen', direction: 'S' },
      { type: 'typeChosen', spaceType: 'indoor_window' },
    );

    expect(resolveLight(edited)).toEqual({ lightGrade: 'medium', lightSource: 'manual' });
  });
});

describe('사진으로 읽은 빛 (SPEC.md 9.2)', () => {
  it('확신이 서면 읽은 등급을 쓴다', () => {
    const read = apply(atLight, { type: 'lightRead', reading: reading({ grade: 'medium' }) });

    expect(resolveLight(read)).toEqual({ lightGrade: 'medium', lightSource: 'ai' });
  });

  it('확신이 낮으면 기본값 표로 간다', () => {
    const read = apply(atLight, {
      type: 'lightRead',
      reading: reading({ grade: 'very_low', confidence: 0.4 }),
    });

    expect(resolveLight(read)).toEqual({ lightGrade: 'high', lightSource: 'default' });
  });

  it('읽지 못했으면 기본값 표로 간다', () => {
    expect(resolveLight(apply(atLight, { type: 'lightRead', reading: null }))).toEqual({
      lightGrade: 'high',
      lightSource: 'default',
    });
  });

  it('사람이 고치면 읽은 값보다 먼저다', () => {
    const edited = apply(
      atLight,
      { type: 'lightRead', reading: reading({ grade: 'medium' }) },
      { type: 'lightGradeChosen', lightGrade: 'low' },
    );

    expect(resolveLight(edited)).toEqual({ lightGrade: 'low', lightSource: 'manual' });
  });

  it('읽은 등급을 다시 고르면 고치지 않은 것으로 본다', () => {
    const edited = apply(
      atLight,
      { type: 'lightRead', reading: reading({ grade: 'medium' }) },
      { type: 'lightGradeChosen', lightGrade: 'low' },
      { type: 'lightGradeChosen', lightGrade: 'medium' },
    );

    expect(resolveLight(edited)).toEqual({ lightGrade: 'medium', lightSource: 'ai' });
  });

  it('사진이나 방향·유형이 바뀌면 읽은 값을 버린다', () => {
    const read = apply(atLight, { type: 'lightRead', reading: reading() });

    expect(apply(read, { type: 'photoPicked', photoPath: 'spaces/space-1-2.jpg' }).aiLight).toBeNull();
    expect(apply(read, { type: 'directionChosen', direction: 'N' }).aiLight).toBeNull();
    expect(apply(read, { type: 'typeChosen', spaceType: 'terrace' }).aiLight).toBeNull();
    expect(apply(read, { type: 'photoPicked', photoPath: 'spaces/space-1.jpg' }).aiLight).not.toBeNull();
  });
});

describe('이름 자동 제안', () => {
  it('방향과 유형으로 짓는다', () => {
    expect(suggestSpaceName('S', 'indoor_window', [])).toBe('남향 실내 창가');
    expect(suggestSpaceName('W', 'balcony_ext', [])).toBe('서향 발코니 확장');
    expect(suggestSpaceName('E', 'terrace', [])).toBe('동향 테라스');
    expect(suggestSpaceName('N', 'indoor_far', [])).toBe('북향 창에서 먼 실내');
  });

  it('방향을 모르면 유형만 쓴다', () => {
    expect(suggestSpaceName('unknown', 'terrace', [])).toBe('테라스');
  });

  it('같은 이름이 있으면 번호를 붙인다', () => {
    expect(suggestSpaceName('S', 'indoor_window', ['남향 실내 창가'])).toBe('남향 실내 창가 2');
    expect(suggestSpaceName('S', 'indoor_window', ['남향 실내 창가', '남향 실내 창가 2'])).toBe(
      '남향 실내 창가 3',
    );
  });

  it('고치지 않았으면 제안을, 고쳤으면 고친 이름을 쓴다', () => {
    expect(resolveSpaceName(atLight, [])).toBe('남향 실내 창가');
    expect(resolveSpaceName(apply(atLight, { type: 'nameEdited', name: '거실 창가' }), [])).toBe(
      '거실 창가',
    );
  });

  it('이름을 비우거나 너무 길면 저장할 수 없다', () => {
    const atName = apply(atLight, { type: 'next' });

    expect(canAdvance(atName)).toBe(true);
    expect(canAdvance(apply(atName, { type: 'nameEdited', name: '   ' }))).toBe(false);
    expect(
      canAdvance(apply(atName, { type: 'nameEdited', name: '가'.repeat(MAX_SPACE_NAME_LENGTH) })),
    ).toBe(true);
    expect(
      canAdvance(
        apply(atName, { type: 'nameEdited', name: '가'.repeat(MAX_SPACE_NAME_LENGTH + 1) }),
      ),
    ).toBe(false);
  });
});

describe('저장할 공간 만들기', () => {
  it('초안을 spaces 행으로 바꾼다', () => {
    const atName = apply(atLight, { type: 'next' }, { type: 'nameEdited', name: '  거실 창가 ' });

    expect(toNewSpace(atName, [], 1_789_000_000_000)).toEqual({
      id: 'space-1',
      name: '거실 창가',
      photoPath: 'spaces/space-1.jpg',
      direction: 'S',
      spaceType: 'indoor_window',
      lightGrade: 'high',
      lightSource: 'default',
      aiEvidence: null,
      createdAt: 1_789_000_000_000,
    });
  });

  it('확신이 낮아 쓰지 않은 판단도 함께 저장한다 (SPEC.md 3.3, 9.2)', () => {
    const draft = apply(
      atLight,
      { type: 'lightRead', reading: reading({ grade: 'low', confidence: 0.2 }) },
      { type: 'next' },
    );

    expect(toNewSpace(draft, [], 1)).toMatchObject({
      lightGrade: 'high',
      lightSource: 'default',
      aiEvidence: { grade: 'low', confidence: 0.2 },
    });
  });

  it('고친 빛 등급과 자동 이름을 반영한다', () => {
    const draft = apply(atLight, { type: 'lightGradeChosen', lightGrade: 'low' }, { type: 'next' });

    expect(toNewSpace(draft, ['남향 실내 창가'], 1)).toMatchObject({
      name: '남향 실내 창가 2',
      lightGrade: 'low',
      lightSource: 'manual',
    });
  });

  it('입력이 덜 됐으면 만들지 않는다', () => {
    expect(toNewSpace(empty, [], 1)).toBeNull();
    expect(toNewSpace(apply(atLight, { type: 'nameEdited', name: '' }), [], 1)).toBeNull();
  });
});

describe('임시 저장 복원 (SPEC 4: 중간 이탈 시 임시 저장)', () => {
  it('저장한 초안을 그대로 되살린다', () => {
    const draft = apply(atLight, { type: 'lightGradeChosen', lightGrade: 'medium' });

    expect(parseSpaceDraft(JSON.stringify(draft))).toEqual(draft);
  });

  it('읽어 둔 빛도 되살리고, 깨졌으면 없는 것으로 본다', () => {
    const read = apply(atLight, { type: 'lightRead', reading: reading() });

    expect(parseSpaceDraft(JSON.stringify(read))?.aiLight).toEqual(reading());
    expect(parseSpaceDraft(JSON.stringify({ ...read, aiLight: { grade: 'sunny' } }))).toMatchObject({
      aiLight: null,
      step: 'light',
    });
  });

  it('없거나 깨진 값은 버린다', () => {
    expect(parseSpaceDraft(null)).toBeNull();
    expect(parseSpaceDraft('')).toBeNull();
    expect(parseSpaceDraft('{not json')).toBeNull();
    expect(parseSpaceDraft('[]')).toBeNull();
    expect(parseSpaceDraft(JSON.stringify({ ...atLight, id: '' }))).toBeNull();
    expect(parseSpaceDraft(JSON.stringify({ ...atLight, step: 'payment' }))).toBeNull();
    expect(parseSpaceDraft(JSON.stringify({ ...atLight, direction: 'up' }))).toBeNull();
    expect(parseSpaceDraft(JSON.stringify({ ...atLight, spaceType: 'garage' }))).toBeNull();
    expect(parseSpaceDraft(JSON.stringify({ ...atLight, manualLightGrade: 'blinding' }))).toBeNull();
    expect(parseSpaceDraft(JSON.stringify({ ...atLight, photoPath: 7 }))).toBeNull();
    expect(parseSpaceDraft(JSON.stringify({ ...atLight, name: 7 }))).toBeNull();
  });

  it('입력보다 앞선 단계가 저장돼 있으면 아직 안 채운 첫 단계로 되돌린다', () => {
    const ahead = { ...empty, photoPath: 'spaces/space-1.jpg', step: 'light' };

    expect(parseSpaceDraft(JSON.stringify(ahead))?.step).toBe('direction');
  });
});

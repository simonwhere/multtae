import { describe, expect, it } from 'vitest';

import type { Space } from '../db/schema';
import type { LightReading } from './light-reading';
import { planLightGrade, planRetake, planSpaceName, spaceLightReading } from './space-edit';

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

/** 남향 실내 창가. 방향 × 유형 기본값은 강광이다 (SPEC 4.1) */
function space(patch: Partial<Space> = {}): Space {
  return {
    id: 'space-1',
    name: '남향 실내 창가',
    photoPath: 'spaces/space-1.jpg',
    direction: 'S',
    spaceType: 'indoor_window',
    lightGrade: 'high',
    lightSource: 'default',
    aiEvidence: null,
    createdAt: 1,
    ...patch,
  };
}

describe('spaceLightReading: 저장해 둔 사진 판단을 읽는다', () => {
  it('읽어 두었으면 그대로, 없거나 깨졌으면 null', () => {
    expect(spaceLightReading(space({ aiEvidence: reading() }))).toEqual(reading());
    expect(spaceLightReading(space())).toBeNull();
    expect(spaceLightReading(space({ aiEvidence: { grade: 'sunny' } }))).toBeNull();
  });
});

describe('planLightGrade: 빛 등급 수정 (SPEC.md 3.3)', () => {
  it('다른 등급을 고르면 직접 고른 것으로 남긴다', () => {
    expect(planLightGrade(space(), 'low')).toEqual({ lightGrade: 'low', lightSource: 'manual' });
  });

  it('지금 값과 같으면 고칠 것이 없다', () => {
    expect(planLightGrade(space(), 'high')).toBeNull();
    expect(planLightGrade(space({ lightGrade: 'low', lightSource: 'manual' }), 'low')).toBeNull();
  });

  it('가만히 두었을 때와 같은 등급을 고르면 고친 것을 되돌린다', () => {
    const edited = space({ lightGrade: 'low', lightSource: 'manual' });

    expect(planLightGrade(edited, 'high')).toEqual({ lightGrade: 'high', lightSource: 'default' });
  });

  it('사진으로 읽어 둔 공간은 그 등급으로 되돌린다', () => {
    const fromPhoto = space({
      lightGrade: 'very_low',
      lightSource: 'manual',
      aiEvidence: reading({ grade: 'medium' }),
    });

    expect(planLightGrade(fromPhoto, 'medium')).toEqual({
      lightGrade: 'medium',
      lightSource: 'ai',
    });
  });
});

describe('planRetake: 사진 다시 찍기 (SPEC.md 3.3)', () => {
  it('새 사진으로 읽은 등급을 쓴다', () => {
    expect(planRetake(space(), 'spaces/space-1-2.jpg', reading({ grade: 'low' }))).toEqual({
      photoPath: 'spaces/space-1-2.jpg',
      lightGrade: 'low',
      lightSource: 'ai',
      aiEvidence: reading({ grade: 'low' }),
    });
  });

  it('읽지 못했거나 확신이 낮으면 창 방향과 자리로 돌아간다', () => {
    const before = space({ lightGrade: 'medium', lightSource: 'ai', aiEvidence: reading() });

    expect(planRetake(before, 'spaces/new.jpg', null)).toMatchObject({
      lightGrade: 'high',
      lightSource: 'default',
      aiEvidence: null,
    });
    expect(
      planRetake(before, 'spaces/new.jpg', reading({ grade: 'low', confidence: 0.2 })),
    ).toMatchObject({ lightGrade: 'high', lightSource: 'default' });
  });

  it('직접 고쳐 둔 등급은 사진을 바꿔도 남는다', () => {
    const edited = space({ lightGrade: 'very_low', lightSource: 'manual' });

    expect(planRetake(edited, 'spaces/new.jpg', reading({ grade: 'high' }))).toEqual({
      photoPath: 'spaces/new.jpg',
      lightGrade: 'very_low',
      lightSource: 'manual',
      aiEvidence: reading({ grade: 'high' }),
    });
  });
});

describe('planSpaceName', () => {
  it('고친 이름을 앞뒤 공백 없이 저장한다', () => {
    expect(planSpaceName(space(), '  거실 창가 ')).toEqual({ name: '거실 창가' });
  });

  it('비었거나 너무 길거나 그대로면 고치지 않는다', () => {
    expect(planSpaceName(space(), '   ')).toBeNull();
    expect(planSpaceName(space(), '남향 실내 창가')).toBeNull();
    expect(planSpaceName(space(), '가'.repeat(21))).toBeNull();
    expect(planSpaceName(space(), '가'.repeat(20))).toEqual({ name: '가'.repeat(20) });
  });
});

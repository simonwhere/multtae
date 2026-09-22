import { describe, expect, it } from 'vitest';

import { defaultLightGrade, isConfident, MIN_LIGHT_CONFIDENCE, resolveLightGrade } from './light';
import { DIRECTIONS, SPACE_TYPES } from './types';
import type { Direction, LightGrade, SpaceType } from './types';

// SPEC.md 4.1 "AI 실패 시 기본값 표" (방향 × 유형). 열 순서도 표와 같다.
const TABLE: Record<Direction, Record<SpaceType, LightGrade>> = {
  S: { indoor_window: 'high', balcony_ext: 'high', terrace: 'high', indoor_far: 'low' },
  E: { indoor_window: 'medium', balcony_ext: 'medium', terrace: 'high', indoor_far: 'low' },
  W: { indoor_window: 'medium', balcony_ext: 'high', terrace: 'high', indoor_far: 'low' },
  N: { indoor_window: 'low', balcony_ext: 'low', terrace: 'medium', indoor_far: 'very_low' },
  unknown: {
    indoor_window: 'medium',
    balcony_ext: 'medium',
    terrace: 'high',
    indoor_far: 'very_low',
  },
};

describe('defaultLightGrade: SPEC.md 4.1 방향 × 유형 기본값 표', () => {
  const cases = DIRECTIONS.flatMap((direction) =>
    SPACE_TYPES.map((spaceType) => [direction, spaceType, TABLE[direction][spaceType]] as const),
  );

  it('표의 20칸을 모두 다룬다', () => {
    expect(cases).toHaveLength(20);
  });

  it.each(cases)('%s × %s → %s', (direction, spaceType, grade) => {
    expect(defaultLightGrade(direction, spaceType)).toBe(grade);
  });

  it('SPEC 5.6 의 예시 공간과 맞는다', () => {
    // 북향 실내 창가(약광), 남향 창가(강광), 남향 테라스(강광), 서향 발코니 확장(강광)
    expect(defaultLightGrade('N', 'indoor_window')).toBe('low');
    expect(defaultLightGrade('S', 'indoor_window')).toBe('high');
    expect(defaultLightGrade('S', 'terrace')).toBe('high');
    expect(defaultLightGrade('W', 'balcony_ext')).toBe('high');
  });
});

describe('isConfident: 확신도 0.5 미만은 쓰지 않는다 (SPEC.md 9.2)', () => {
  it('경계는 0.5 이고, 그 미만이거나 판단이 없으면 쓰지 않는다', () => {
    expect(MIN_LIGHT_CONFIDENCE).toBe(0.5);
    expect(isConfident({ grade: 'high', confidence: 0.5 })).toBe(true);
    expect(isConfident({ grade: 'high', confidence: 0.78 })).toBe(true);
    expect(isConfident({ grade: 'high', confidence: 0.49 })).toBe(false);
    expect(isConfident(null)).toBe(false);
    expect(isConfident(undefined)).toBe(false);
  });
});

describe('resolveLightGrade: 사람 > AI > 기본값 (SPEC.md 4.1, 9.2)', () => {
  const space = { direction: 'N', spaceType: 'indoor_window' } as const;

  it('AI 가 없으면 방향 × 유형 기본값', () => {
    expect(resolveLightGrade(space)).toEqual({ lightGrade: 'low', lightSource: 'default' });
  });

  it('확신이 서면 AI 판단을 쓴다', () => {
    expect(resolveLightGrade({ ...space, ai: { grade: 'medium', confidence: 0.8 } })).toEqual({
      lightGrade: 'medium',
      lightSource: 'ai',
    });
  });

  it('확신이 낮으면 AI 판단을 쓰지 않고 기본값으로 간다', () => {
    expect(resolveLightGrade({ ...space, ai: { grade: 'high', confidence: 0.3 } })).toEqual({
      lightGrade: 'low',
      lightSource: 'default',
    });
  });

  it('사람이 고른 값이 AI 보다 먼저다', () => {
    expect(
      resolveLightGrade({ ...space, ai: { grade: 'medium', confidence: 0.9 }, manual: 'very_low' }),
    ).toEqual({ lightGrade: 'very_low', lightSource: 'manual' });
  });
});

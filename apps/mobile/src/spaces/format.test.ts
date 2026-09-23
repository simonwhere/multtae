import { describe, expect, it } from 'vitest';

import { formatPlace, formatSpaceLine, spaceCardLabel } from './format';

const space = {
  name: '거실 창가',
  direction: 'S' as const,
  spaceType: 'indoor_window' as const,
  lightGrade: 'high' as const,
};

describe('공간을 글로 (SPEC.md 3.3)', () => {
  it('방향과 자리를 한 줄로', () => {
    expect(formatPlace(space)).toBe('남향 실내 창가');
  });

  it('방향을 모르면 자리만 말한다', () => {
    expect(formatPlace({ ...space, direction: 'unknown' })).toBe('실내 창가');
  });

  it('식물 수를 받으면 뒤에 붙인다', () => {
    expect(formatSpaceLine(space)).toBe('남향 실내 창가');
    expect(formatSpaceLine(space, 2)).toBe('남향 실내 창가, 식물 2개');
  });

  it('카드를 한 번에 읽을 말에는 이름과 자리, 빛이 다 들어간다', () => {
    expect(spaceCardLabel(space, 2)).toBe('거실 창가, 남향 실내 창가, 식물 2개, 강광');
    expect(spaceCardLabel(space)).toBe('거실 창가, 남향 실내 창가, 강광');
  });
});

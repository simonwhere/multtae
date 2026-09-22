import { describe, expect, it } from 'vitest';

import { withObject } from './josa';

describe('withObject: 을/를', () => {
  it('받침이 있으면 을, 없으면 를', () => {
    expect(withObject('발코니 확장')).toBe('발코니 확장을');
    expect(withObject('남향 실내 창가')).toBe('남향 실내 창가를');
    expect(withObject('거실')).toBe('거실을');
    expect(withObject('베란다')).toBe('베란다를');
  });

  it('숫자로 끝나면 읽는 소리로 고른다', () => {
    expect(withObject('창가 2')).toBe('창가 2를');
    expect(withObject('창가 3')).toBe('창가 3을');
    expect(withObject('창가 10')).toBe('창가 10을');
  });

  it('영문이나 빈 문자열은 를', () => {
    expect(withObject('Room')).toBe('Room를');
    expect(withObject('')).toBe('를');
  });
});

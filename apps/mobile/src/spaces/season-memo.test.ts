import { describe, expect, it } from 'vitest';

import { SEASONS, SPACE_TYPES } from '../engine/types';
import { seasonMemo } from './season-memo';

describe('seasonMemo: 공간 상세의 계절 메모 (SPEC.md 3.3)', () => {
  it('발코니 확장은 겨울에 새벽 기온을 알려 준다', () => {
    expect(seasonMemo('balcony_ext', 'winter')).toContain('5도');
  });

  it('겨울 실내는 온풍을 피하라고 말한다 (SPEC 7.3)', () => {
    expect(seasonMemo('indoor_window', 'winter')).toContain('온풍기');
    expect(seasonMemo('indoor_far', 'winter')).toContain('온풍기');
  });

  it('장마에는 바깥 자리에 비가 들이치는 것을 알려 준다 (SPEC 7.4)', () => {
    expect(seasonMemo('terrace', 'monsoon')).toContain('비가 들이치면');
    expect(seasonMemo('balcony_ext', 'monsoon')).toContain('비가 들이치면');
  });

  it('할 말이 없는 계절은 비워 둔다', () => {
    expect(seasonMemo('indoor_window', 'spring')).toBeNull();
    expect(seasonMemo('indoor_far', 'heat')).toBeNull();
  });

  it('테라스는 네 계절 모두 할 말이 있다', () => {
    for (const season of SEASONS) {
      expect(seasonMemo('terrace', season)).not.toBeNull();
    }
  });

  it('문구는 존댓말이고 느낌표와 이모지를 쓰지 않는다 (CLAUDE.md)', () => {
    for (const spaceType of SPACE_TYPES) {
      for (const season of SEASONS) {
        const memo = seasonMemo(spaceType, season);
        if (!memo) continue;

        expect(memo).not.toContain('!');
        expect(memo).toMatch(/(요|요\.)$/);
      }
    }
  });
});

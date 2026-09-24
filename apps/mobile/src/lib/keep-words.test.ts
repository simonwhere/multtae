import { describe, expect, it } from 'vitest';

import { keepHangulWords, WORD_JOINER } from './keep-words';

const shown = (text: string) => text.replaceAll(WORD_JOINER, '|');

describe('keepHangulWords: 안드로이드에서 낱말이 갈리지 않게', () => {
  it('붙어 있는 한글 사이에만 넣고 띄어쓰기는 그대로 둔다', () => {
    expect(shown(keepHangulWords('위치 권한은 쓰지 않아요.'))).toBe('위|치 권|한|은 쓰|지 않|아|요.');
  });

  it('숫자와 한글이 붙은 곳도 잇는다', () => {
    expect(shown(keepHangulWords('9월 26일, 2일 지남'))).toBe('9|월 26|일, 2|일 지|남');
  });

  it('보이는 글자는 바뀌지 않는다', () => {
    const text = '다음은 곰솔, 9월 26일 (분재) AI 추정이에요';
    expect(keepHangulWords(text).replaceAll(WORD_JOINER, '')).toBe(text);
  });

  it('한글이 없으면 그대로다', () => {
    expect(keepHangulWords('D-3 08:00')).toBe('D-3 08:00');
    expect(keepHangulWords('')).toBe('');
  });

  it('두 번 넣어도 같다', () => {
    const once = keepHangulWords('오늘은 물 줄 식물이 없어요');
    expect(keepHangulWords(once)).toBe(once);
  });
});

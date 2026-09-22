/**
 * 이름 뒤에 붙는 조사 (을/를). 사용자가 지은 이름이라 받침이 있는지 보고 고른다.
 */

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const FINALS = 28;

/** 숫자를 한국어로 읽을 때 받침이 있는가: 영 일 이 삼 사 오 육 칠 팔 구 */
const DIGIT_HAS_FINAL = [true, true, false, true, false, false, true, true, true, false];
/** 받침이 ㄹ 인가: 일 칠 팔 */
const DIGIT_RIEUL = [false, true, false, false, false, false, false, true, true, false];
/** 종성 번호 8 이 ㄹ 이다 */
const RIEUL = 8;

/** 끝 글자의 받침. 'none' 이면 받침 없음, 'rieul' 이면 ㄹ 받침 */
function finalOf(word: string): 'none' | 'rieul' | 'other' {
  const last = word.trim().at(-1);
  if (!last) return 'none';

  const code = last.charCodeAt(0);
  if (code >= HANGUL_START && code <= HANGUL_END) {
    const final = (code - HANGUL_START) % FINALS;
    return final === 0 ? 'none' : final === RIEUL ? 'rieul' : 'other';
  }
  if (last >= '0' && last <= '9') {
    const digit = Number(last);
    return DIGIT_RIEUL[digit] ? 'rieul' : DIGIT_HAS_FINAL[digit] ? 'other' : 'none';
  }
  // 영문 등은 읽는 법을 알 수 없어 받침이 없는 쪽으로 둔다
  return 'none';
}

function hasFinalConsonant(word: string): boolean {
  return finalOf(word) !== 'none';
}

/** "창가를", "발코니 확장을", "창가 3을" */
export function withObject(word: string): string {
  return `${word}${hasFinalConsonant(word) ? '을' : '를'}`;
}

/** "베란다로", "거실로", "창가 3으로". ㄹ 받침 뒤에는 "로" 다 */
export function withTo(word: string): string {
  return `${word}${finalOf(word) === 'other' ? '으로' : '로'}`;
}

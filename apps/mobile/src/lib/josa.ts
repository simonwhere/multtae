/**
 * 이름 뒤에 붙는 조사 (을/를). 사용자가 지은 이름이라 받침이 있는지 보고 고른다.
 */

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const FINALS = 28;

/** 숫자를 한국어로 읽을 때 받침이 있는가: 영 일 이 삼 사 오 육 칠 팔 구 */
const DIGIT_HAS_FINAL = [true, true, false, true, false, false, true, true, true, false];

function hasFinalConsonant(word: string): boolean {
  const last = word.trim().at(-1);
  if (!last) return false;

  const code = last.charCodeAt(0);
  if (code >= HANGUL_START && code <= HANGUL_END) return (code - HANGUL_START) % FINALS !== 0;
  if (last >= '0' && last <= '9') return DIGIT_HAS_FINAL[Number(last)];
  // 영문 등은 읽는 법을 알 수 없어 받침이 없는 쪽으로 둔다
  return false;
}

/** "창가를", "발코니 확장을", "창가 3을" */
export function withObject(word: string): string {
  return `${word}${hasFinalConsonant(word) ? '을' : '를'}`;
}

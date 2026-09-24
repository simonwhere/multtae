/**
 * 안드로이드는 한글을 음절마다 줄바꿈할 수 있어서 "위치 권 / 한은"처럼 낱말이 갈린다 (9-4).
 * iOS 는 AppText 의 lineBreakStrategyIOS 로 막지만 안드로이드에는 그런 설정이 없어서,
 * 붙어 있는 글자 사이에 보이지 않는 WORD JOINER 를 넣어 띄어쓰기에서만 줄이 바뀌게 한다
 * (CSS word-break: keep-all 과 같다). 화면에 보이는 글자는 그대로다.
 */

export const WORD_JOINER = '⁠';

const HANGUL = '가-힣ㄱ-ㆎ';
/** 한글과 그 앞뒤에 붙은 숫자·영문 사이. "9월", "2일", "D-3일"의 "3일" 같은 곳 */
const JOINABLE = new RegExp(
  `([${HANGUL}])(?=[${HANGUL}A-Za-z0-9])|([A-Za-z0-9])(?=[${HANGUL}])`,
  'g',
);

export function keepHangulWords(text: string): string {
  return text.replace(JOINABLE, (_match, hangul: string | undefined, latin: string | undefined) =>
    `${hangul ?? latin ?? ''}${WORD_JOINER}`,
  );
}

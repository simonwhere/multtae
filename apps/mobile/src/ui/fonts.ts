import { fonts } from './tokens';

/** useFonts 에 넘기는 서체 파일. 키는 tokens.ts 의 패밀리 이름이다 (둘 다 OFL, assets/fonts 에 라이선스 동봉) */
export const fontAssets = {
  [fonts.serif]: require('@/assets/fonts/InstrumentSerif-Regular.ttf'),
  [fonts.serifItalic]: require('@/assets/fonts/InstrumentSerif-Italic.ttf'),
  [fonts.sans]: require('@/assets/fonts/Pretendard-Regular.otf'),
  [fonts.sansSemiBold]: require('@/assets/fonts/Pretendard-SemiBold.otf'),
};

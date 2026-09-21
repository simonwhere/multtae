import { fonts } from './tokens';

/**
 * useFonts 에 넘기는 서체 파일. 키는 tokens.ts 의 패밀리 이름이다.
 * Pretendard 는 assets/fonts 에 라이선스와 함께 있고, Figtree 는 @expo-google-fonts/figtree 패키지에 들어 있다 (둘 다 OFL).
 */
export const fontAssets = {
  [fonts.numeral]: require('@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf'),
  [fonts.latin]: require('@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf'),
  [fonts.sans]: require('@/assets/fonts/Pretendard-Regular.otf'),
  [fonts.sansSemiBold]: require('@/assets/fonts/Pretendard-SemiBold.otf'),
};

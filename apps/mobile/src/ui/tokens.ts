/**
 * 디자인 토큰 (SPEC.md 14.2 색, 14.3 타이포그래피).
 * 앱의 색은 여기 있는 토큰만 쓴다. 초록(moss)은 완료 상태 전용이다.
 */
import type { TextStyle } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export interface ColorTokens {
  soil: {
    /** 젖은 흙, 주요 텍스트 */
    wet: string;
    /** 마른 흙, 게이지 배경 */
    dry: string;
    /** 밀림 */
    crack: string;
  };
  /** 배경 (종이·화분 안쪽 느낌) */
  paper: string;
  /** 성공·완료·분재 뱃지 */
  moss: string;
  /** 오늘 물주기 강조에만. 넓은 면 금지 */
  water: string;
  /** 경고 카드 */
  warn: string;
}

export const colors: Record<ColorScheme, ColorTokens> = {
  light: {
    soil: { wet: '#4A3728', dry: '#C9B08A', crack: '#9E8B76' },
    paper: '#F4EFE6',
    moss: '#5B6B3E',
    water: '#3F6E8C',
    warn: '#B5542E',
  },
  dark: {
    soil: { wet: '#5C4534', dry: '#8A7355', crack: '#6B5D4D' },
    paper: '#1C1814',
    moss: '#7A8C55',
    water: '#6F9EBB',
    warn: '#D4784F',
  },
};

/** 서체 패밀리 이름. 서체 파일은 이 이름으로 등록한다 */
export const fonts = {
  /** Instrument Serif Regular (OFL): 숫자·D-day */
  serif: 'InstrumentSerif-Regular',
  /** Instrument Serif Italic: 학명 */
  serifItalic: 'InstrumentSerif-Italic',
  /** Pretendard Regular: 본문·계산식 */
  sans: 'Pretendard-Regular',
  /** Pretendard SemiBold: 제목 */
  sansSemiBold: 'Pretendard-SemiBold',
} as const;

// React Native 의 letterSpacing 은 pt 단위라 "자간 -2%" 를 크기에 곱해 둔다.
const NUMERAL_TRACKING = -0.02;
const BODY_LINE_HEIGHT = 1.55;

export const typography = {
  /** 숫자·D-day 상한 56pt */
  numeralLg: {
    fontFamily: fonts.serif,
    fontSize: 56,
    fontWeight: '400',
    letterSpacing: 56 * NUMERAL_TRACKING,
  },
  /** 숫자·D-day 하한 40pt */
  numeralSm: {
    fontFamily: fonts.serif,
    fontSize: 40,
    fontWeight: '400',
    letterSpacing: 40 * NUMERAL_TRACKING,
  },
  /** 제목 상한 24pt */
  titleLg: { fontFamily: fonts.sansSemiBold, fontSize: 24, fontWeight: '600' },
  /** 제목 하한 20pt */
  titleSm: { fontFamily: fonts.sansSemiBold, fontSize: 20, fontWeight: '600' },
  /** 본문 15pt, 행간 1.55 */
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 15 * BODY_LINE_HEIGHT,
  },
  /** 학명 13pt */
  scientific: { fontFamily: fonts.serifItalic, fontSize: 13, fontStyle: 'italic' },
  /** 계산식 13pt, 고정폭 숫자 */
  formula: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;

/**
 * 디자인 토큰 (SPEC.md 14.2 색, 14.3 타이포그래피).
 * 앱의 색은 여기 있는 토큰만 쓴다. 초록(moss)은 완료 상태 전용이다.
 */
import type { TextStyle } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export interface ColorTokens {
  /**
   * 글자와 선(아이콘, 게이지의 금, 화분 윤곽). 주 버튼의 면색이기도 하다.
   * 14.2 는 soil.wet 을 주요 텍스트로 쓰라고 하지만 다크에서는 배경과의 대비가 2:1 이라 읽히지 않아
   * 글자 전용 토큰을 따로 둔다. 라이트는 soil.wet 과 같은 색이다.
   */
  ink: string;
  /** 카드 면. paper 보다 한 단계 밝다 (14.4) */
  surface: string;
  soil: {
    /** 젖은 흙 */
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
    ink: '#4A3728',
    surface: '#FBF8F3',
    soil: { wet: '#4A3728', dry: '#C9B08A', crack: '#9E8B76' },
    paper: '#F4EFE6',
    moss: '#5B6B3E',
    water: '#3F6E8C',
    warn: '#B5542E',
  },
  dark: {
    ink: '#EDE4D3',
    surface: '#28221C',
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

/** 14.4: 카드 모서리 12pt. 버튼도 같은 값을 쓴다 */
export const radius = {
  card: 12,
  gauge: 4,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** 14.4: 전환 200ms, 흙 게이지 600ms, 그 외 모션 없음 */
export const motion = {
  transition: 200,
  soilGauge: 600,
} as const;

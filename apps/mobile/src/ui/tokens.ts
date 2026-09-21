/**
 * 디자인 토큰 (SPEC.md 14.2 색, 14.3 타이포그래피): 화원 라벨.
 * 식물 가게의 이름표에서 가져왔다. 옅은 잎빛 바탕에 흰 카드, 깊은 잎 초록 하나, 새순 연두의 강조 면.
 * 앱의 색은 여기 있는 토큰만 쓴다. 상태는 색만으로 구분하지 않고 글자나 표시를 함께 쓴다 (SPEC 15).
 */
import type { TextStyle } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export interface ColorTokens {
  /** 글자와 아이콘 */
  ink: string;
  /** 보조 글자: 공간 이름, 날짜, 설명 */
  sub: string;
  /** 화면 바탕. 아주 옅은 잎빛이고 베이지가 아니다 */
  paper: string;
  /** 카드와 시트의 면 */
  surface: string;
  /** 카드 테두리와 구분선 */
  hair: string;
  /** 보조 버튼과 이름표의 옅은 면 */
  soft: string;
  /** 사진이 없는 자리 */
  block: string;
  /** 주색, 깊은 잎 초록: 주 버튼, 게이지의 찬 칸, 고른 탭, 완료 */
  accent: string;
  /** 주색 면 위의 글자 */
  onAccent: string;
  /** 강조 면, 새순 연두: 오늘 물 줄 카드, 다음 물주기 카드, 고른 탭과 선택지 */
  highlight: string;
  /** 게이지의 빈 칸 */
  gaugeEmpty: string;
  /** 밀림과 삭제, 열매 자주 */
  berry: string;
  /** 밀림 이름표와 경고 상자의 면 */
  berryTint: string;
  /** 밀린 게이지의 빈 칸 */
  berryEmpty: string;
  /** 꾸밈 선: 잔가지 그림, 다가옴 점 */
  sprig: string;
}

export const colors: Record<ColorScheme, ColorTokens> = {
  light: {
    ink: '#1F2B25',
    sub: '#5A675F',
    paper: '#F4F6F2',
    surface: '#FFFFFF',
    hair: '#E0E7DE',
    soft: '#EAF0E8',
    block: '#E3EAE1',
    accent: '#2F5F49',
    onAccent: '#FFFFFF',
    highlight: '#E4EDD3',
    gaugeEmpty: '#DDE6DB',
    berry: '#8E3646',
    berryTint: '#F3E2E5',
    berryEmpty: '#EBD3D7',
    sprig: '#A9BFAC',
  },
  dark: {
    ink: '#E7EEE8',
    sub: '#A5B5AA',
    paper: '#141A16',
    surface: '#1D2621',
    hair: '#2E3A33',
    soft: '#27322C',
    block: '#26312B',
    accent: '#8FC7A5',
    onAccent: '#10201A',
    highlight: '#2B3C2F',
    gaugeEmpty: '#33403A',
    berry: '#E8A3B0',
    berryTint: '#3B242A',
    berryEmpty: '#4A2D34',
    sprig: '#4F6355',
  },
};

/** 서체 패밀리 이름. 서체 파일은 이 이름으로 등록한다 (src/ui/fonts.ts) */
export const fonts = {
  /** Figtree SemiBold (OFL): 큰 숫자. 한글이 없어 숫자와 라틴 글자에만 쓴다 */
  numeral: 'Figtree-SemiBold',
  /** Figtree Medium: 학명 */
  latin: 'Figtree-Medium',
  /** Pretendard Regular (OFL): 본문 */
  sans: 'Pretendard-Regular',
  /** Pretendard SemiBold: 제목, 버튼, 이름표 */
  sansSemiBold: 'Pretendard-SemiBold',
} as const;

const BODY_LINE_HEIGHT = 1.55;

export const typography = {
  /** 오늘 탭의 날짜 "9.21" */
  numeralLg: { fontFamily: fonts.numeral, fontSize: 56, fontWeight: '600', letterSpacing: -1 },
  /** 식물 상세의 다음 물주기 날짜 */
  numeralMd: { fontFamily: fonts.numeral, fontSize: 48, fontWeight: '600', letterSpacing: -1 },
  /** 개수 칩의 숫자 */
  numeralSm: { fontFamily: fonts.numeral, fontSize: 26, fontWeight: '600' },
  /** 화면 제목, 식물 이름 */
  titleLg: { fontFamily: fonts.sansSemiBold, fontSize: 30, fontWeight: '600' },
  /** 카드의 식물 이름, 시트 제목 */
  titleSm: { fontFamily: fonts.sansSemiBold, fontSize: 18, fontWeight: '600' },
  /** 구역 제목, 버튼 */
  label: { fontFamily: fonts.sansSemiBold, fontSize: 15, fontWeight: '600' },
  /** 본문 15pt, 행간 1.55 */
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 15 * BODY_LINE_HEIGHT,
  },
  /** 이름표: "오늘", "D-3", "3일 지남" */
  tag: { fontFamily: fonts.sansSemiBold, fontSize: 13, fontWeight: '600' },
  /** 작은 글자: 공간 이름, 날짜, 설명. 숫자는 고정폭 */
  caption: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  /** 학명 */
  scientific: { fontFamily: fonts.latin, fontSize: 13, fontWeight: '500' },
} satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;

/** 14.4: 테두리는 거의 쓰지 않고 둥근 면으로 나눈다 */
export const radius = {
  card: 20,
  /** 버튼, 입력, 사진 */
  control: 14,
  tag: 8,
  gauge: 4,
  sheet: 28,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** 14.4: 전환 200ms, 게이지가 차는 600ms, 그 외 모션 없음 */
export const motion = {
  transition: 200,
  gauge: 600,
} as const;

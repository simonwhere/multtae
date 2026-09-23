import { describe, expect, it } from 'vitest';

import { colors, fonts, motion, radius, typography } from './tokens';
import type { ColorScheme } from './tokens';

/** WCAG 2.x 상대 휘도 */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG 2.x 대비. 본문은 4.5 이상, 큰 글자와 UI 요소는 3 이상이어야 한다 */
function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const SCHEMES: ColorScheme[] = ['light', 'dark'];

describe('색 토큰: SPEC.md 14.2 화원 라벨', () => {
  it('라이트는 시안의 값 그대로다', () => {
    expect(colors.light).toMatchObject({
      ink: '#1F2B25',
      sub: '#5A675F',
      paper: '#F4F6F2',
      surface: '#FFFFFF',
      accent: '#2F5F49',
      highlight: '#E4EDD3',
      berry: '#8E3646',
    });
  });

  it('바탕은 베이지가 아니다: 붉은 기보다 초록 기가 많다', () => {
    const [red, green] = [1, 3].map((start) => Number.parseInt(colors.light.paper.slice(start, start + 2), 16));

    expect(green).toBeGreaterThan(red);
  });

  it.each(SCHEMES)('%s: 글자색은 바탕·카드·옅은 면·강조 면 위에서 본문 기준(4.5)을 넘는다', (scheme) => {
    const c = colors[scheme];
    for (const background of [c.paper, c.surface, c.soft, c.highlight]) {
      expect(contrast(c.ink, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(SCHEMES)('%s: 보조 글자도 바탕·카드·강조 면 위에서 본문 기준을 넘는다', (scheme) => {
    const c = colors[scheme];
    for (const background of [c.paper, c.surface, c.highlight]) {
      expect(contrast(c.sub, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(SCHEMES)('%s: 주 버튼(주색 면 + 그 위의 글자)은 본문 기준을 넘는다', (scheme) => {
    const c = colors[scheme];
    expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SCHEMES)('%s: 주색 글자(완료, 고른 탭)는 카드와 강조 면 위에서 본문 기준을 넘는다', (scheme) => {
    const c = colors[scheme];
    expect(contrast(c.accent, c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.accent, c.highlight)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SCHEMES)('%s: 밀림 글자는 밀림 이름표와 카드, 바탕 위에서 본문 기준을 넘는다', (scheme) => {
    const c = colors[scheme];
    for (const background of [c.berryTint, c.surface, c.paper]) {
      expect(contrast(c.berry, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(SCHEMES)('%s: 게이지의 찬 칸과 빈 칸은 UI 요소 기준(3)으로 구분된다', (scheme) => {
    const c = colors[scheme];
    for (const empty of [c.gaugeEmpty, c.berryEmpty, c.gaugeEmptyOnHighlight]) {
      expect(contrast(c.accent, empty)).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(SCHEMES)('%s: 강조 면 위 게이지의 빈 칸은 카드 면보다 밝다 (구멍처럼 보이지 않게)', (scheme) => {
    const c = colors[scheme];
    expect(luminance(c.gaugeEmptyOnHighlight)).toBeGreaterThan(luminance(c.highlight));
    // 라이트의 흰 칸(1.21)이 기준이다. 다크도 그만큼은 떠 보여야 한다
    expect(contrast(c.gaugeEmptyOnHighlight, c.highlight)).toBeGreaterThanOrEqual(1.2);
  });

  it.each(SCHEMES)('%s: 카드 면은 바탕과 구분된다', (scheme) => {
    expect(colors[scheme].surface).not.toBe(colors[scheme].paper);
  });
});

describe('타이포그래피: SPEC.md 14.3', () => {
  it('큰 숫자는 Figtree SemiBold 26~56pt', () => {
    expect(typography.numeralLg).toMatchObject({ fontFamily: fonts.numeral, fontSize: 56 });
    expect(typography.numeralMd).toMatchObject({ fontFamily: fonts.numeral, fontSize: 48 });
    expect(typography.numeralSm).toMatchObject({ fontFamily: fonts.numeral, fontSize: 26 });
  });

  it('한글은 Pretendard: 제목은 SemiBold, 본문은 15pt 행간 1.55', () => {
    expect(typography.titleLg).toMatchObject({ fontFamily: fonts.sansSemiBold, fontSize: 30 });
    expect(typography.titleSm).toMatchObject({ fontFamily: fonts.sansSemiBold, fontSize: 18 });
    expect(typography.label).toMatchObject({ fontFamily: fonts.sansSemiBold, fontSize: 15 });
    expect(typography.body).toMatchObject({ fontFamily: fonts.sans, fontSize: 15 });
    expect(typography.body.lineHeight).toBeCloseTo(15 * 1.55, 5);
  });

  it('이름표와 작은 글자는 13pt. 한글이 섞이므로 Pretendard 다', () => {
    expect(typography.tag).toMatchObject({ fontFamily: fonts.sansSemiBold, fontSize: 13 });
    expect(typography.caption).toMatchObject({ fontFamily: fonts.sans, fontSize: 13 });
  });

  it('학명은 라틴 글자라 Figtree 13pt', () => {
    expect(typography.scientific).toMatchObject({ fontFamily: fonts.latin, fontSize: 13 });
  });
});

describe('컴포넌트 원칙: SPEC.md 14.4', () => {
  it('카드 20pt, 버튼·입력 14pt, 이름표 8pt, 게이지 칸 4pt', () => {
    expect(radius).toMatchObject({ card: 20, control: 14, tag: 8, gauge: 4 });
  });

  it('전환 200ms, 게이지 600ms', () => {
    expect(motion).toEqual({ transition: 200, gauge: 600 });
  });
});

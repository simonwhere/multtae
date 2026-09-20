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

describe('색 토큰: SPEC.md 14.2 값 그대로', () => {
  it('라이트', () => {
    expect(colors.light).toMatchObject({
      soil: { wet: '#4A3728', dry: '#C9B08A', crack: '#9E8B76' },
      paper: '#F4EFE6',
      moss: '#5B6B3E',
      water: '#3F6E8C',
      warn: '#B5542E',
    });
  });

  it('다크', () => {
    expect(colors.dark).toMatchObject({
      soil: { wet: '#5C4534', dry: '#8A7355', crack: '#6B5D4D' },
      paper: '#1C1814',
      moss: '#7A8C55',
      water: '#6F9EBB',
      warn: '#D4784F',
    });
  });

  it('라이트의 글자색은 젖은 흙 색과 같다', () => {
    expect(colors.light.ink).toBe(colors.light.soil.wet);
  });
});

describe.each(SCHEMES)('대비 (%s): SPEC.md 15 접근성', (scheme) => {
  const c = colors[scheme];

  it('글자색은 배경과 카드 면 위에서 본문 기준(4.5)을 넘는다', () => {
    expect(contrast(c.ink, c.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.ink, c.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('주 버튼(글자색 면 + 배경색 글자)도 본문 기준을 넘는다', () => {
    expect(contrast(c.paper, c.ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('완료(moss)와 물주기 강조(water) 글자는 배경 위에서 본문 기준을 넘는다', () => {
    expect(contrast(c.moss, c.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.water, c.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('경고색(warn)은 UI 요소 기준(3)을 넘는다', () => {
    expect(contrast(c.warn, c.paper)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.warn, c.surface)).toBeGreaterThanOrEqual(3);
  });

  it('흙 게이지의 선(글자색)은 마른 흙·밀린 흙 위에서 UI 요소 기준을 넘는다', () => {
    expect(contrast(c.ink, c.soil.dry)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.ink, c.soil.crack)).toBeGreaterThanOrEqual(3);
  });

  it('젖은 흙과 마른 흙은 서로 구분된다', () => {
    expect(contrast(c.soil.wet, c.soil.dry)).toBeGreaterThanOrEqual(1.9);
  });

  it('카드 면은 배경보다 한 단계 밝다 (SPEC 14.4)', () => {
    expect(luminance(c.surface)).toBeGreaterThan(luminance(c.paper));
  });
});

describe('타이포그래피: SPEC.md 14.3', () => {
  it('숫자·D-day 는 Instrument Serif 40~56pt, 자간 −2%', () => {
    expect(typography.numeralLg).toMatchObject({ fontFamily: fonts.serif, fontSize: 56 });
    expect(typography.numeralSm).toMatchObject({ fontFamily: fonts.serif, fontSize: 40 });
    expect(typography.numeralLg.letterSpacing).toBeCloseTo(-1.12, 6);
    expect(typography.numeralSm.letterSpacing).toBeCloseTo(-0.8, 6);
  });

  it('제목은 Pretendard SemiBold 20~24pt', () => {
    expect(typography.titleLg).toMatchObject({ fontFamily: fonts.sansSemiBold, fontSize: 24 });
    expect(typography.titleSm).toMatchObject({ fontFamily: fonts.sansSemiBold, fontSize: 20 });
  });

  it('본문은 Pretendard 15pt, 행간 1.55', () => {
    expect(typography.body).toMatchObject({ fontFamily: fonts.sans, fontSize: 15 });
    expect(typography.body.lineHeight).toBeCloseTo(23.25, 6);
  });

  it('학명은 Instrument Serif Italic 13pt, 계산식은 고정폭 숫자 13pt', () => {
    expect(typography.scientific).toMatchObject({ fontFamily: fonts.serifItalic, fontSize: 13 });
    expect(typography.formula).toMatchObject({ fontSize: 13, fontVariant: ['tabular-nums'] });
  });
});

describe('컴포넌트 원칙: SPEC.md 14.4', () => {
  it('카드 모서리 12pt, 전환 200ms, 흙 게이지 600ms', () => {
    expect(radius.card).toBe(12);
    expect(motion.transition).toBe(200);
    expect(motion.soilGauge).toBe(600);
  });
});

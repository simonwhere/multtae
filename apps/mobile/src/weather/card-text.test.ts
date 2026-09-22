import { describe, expect, it } from 'vitest';

import { cardText, listNames, winterCardText } from './card-text';

describe('경고 카드 문구 (SPEC.md 3.2, 6.3, 7.2)', () => {
  it('식물 이름은 세 개까지 적고 나머지는 외 N개', () => {
    expect(listNames(['곰솔'])).toBe('곰솔');
    expect(listNames(['곰솔', '금귤', '율마'])).toBe('곰솔, 금귤, 율마');
    expect(listNames(['곰솔', '금귤', '율마', '라벤더', '로즈마리'])).toBe('곰솔, 금귤, 율마 외 2개');
  });

  it('한파: 새벽 기온과 식물, 분재·발코니 문구를 붙인다', () => {
    expect(
      cardText({ kind: 'cold', when: 'tomorrow', low: -7, names: ['곰솔'], bonsai: true, balcony: true }),
    ).toEqual({
      key: 'cold',
      title: '한파 예보',
      body:
        '내일 새벽 -7도까지 내려가요. 곰솔 화분을 챙겨 주세요. ' +
        '분재 화분은 얼 수 있어요. 발코니 안쪽이나 스티로폼 상자로 보호해 주세요. ' +
        '확장 발코니도 새벽에는 5도 아래로 떨어질 수 있어요.',
      tone: 'warning',
    });
    expect(
      cardText({ kind: 'cold', when: 'today', low: -5, names: ['율마'], bonsai: false, balcony: false }).body,
    ).toBe('오늘 새벽 -5도까지 내려가요. 율마 화분을 챙겨 주세요.');
  });

  it('강풍: 작은 화분이 있으면 한 줄 더', () => {
    expect(cardText({ kind: 'wind', names: ['율마', '로즈마리'], small: [] }).body).toBe(
      '율마, 로즈마리 화분이 넘어지지 않게 벽 쪽 낮은 곳으로 옮겨 주세요.',
    );
    expect(cardText({ kind: 'wind', names: ['율마', '로즈마리'], small: ['로즈마리'] }).body).toBe(
      '율마, 로즈마리 화분이 넘어지지 않게 벽 쪽 낮은 곳으로 옮겨 주세요. 로즈마리처럼 작은 화분은 특히 잘 넘어져요.',
    );
  });

  it('안내 카드는 연두, 경고 카드는 자줏빛', () => {
    expect(cardText({ kind: 'dust' }).tone).toBe('tip');
    expect(cardText({ kind: 'humidity' }).tone).toBe('tip');
    expect(cardText({ kind: 'monsoon' }).tone).toBe('tip');
    expect(cardText({ kind: 'heat', names: ['율마'] }).tone).toBe('warning');
    expect(cardText({ kind: 'frost', when: 'tomorrow', low: 2, names: ['율마'] }).tone).toBe('warning');
  });

  it('분재 월동 경고도 같은 카드다', () => {
    expect(winterCardText({ kind: 'conifer_indoor', nicknames: ['곰솔'] })).toMatchObject({
      key: 'winter-conifer_indoor',
      title: '겨울나기',
      tone: 'warning',
    });
  });

  it('문구에 느낌표를 쓰지 않는다 (CLAUDE.md)', () => {
    const all = [
      cardText({ kind: 'heat', names: ['a'] }),
      cardText({ kind: 'cold', when: 'today', low: -9, names: ['a'], bonsai: true, balcony: true }),
      cardText({ kind: 'frost', when: 'today', low: 1, names: ['a'] }),
      cardText({ kind: 'wind', names: ['a'], small: ['a'] }),
      cardText({ kind: 'dust' }),
      cardText({ kind: 'humidity' }),
      cardText({ kind: 'monsoon' }),
    ];
    for (const card of all) {
      expect(card.body).not.toContain('!');
      expect(card.body).toMatch(/요\.$/);
    }
  });
});

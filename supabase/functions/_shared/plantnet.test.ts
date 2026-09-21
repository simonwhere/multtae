import { describe, expect, it } from 'vitest';

import {
  MAX_IMAGES,
  ORGANS,
  parseIdentifyResponse,
  pickCandidates,
  withKoreanNames,
} from './plantnet';

/** PlantNet v2 응답의 결과 한 건 */
const result = (name: string, score: number, commonNames: string[] = []) => ({
  score,
  species: {
    scientificNameWithoutAuthor: name,
    scientificNameAuthorship: 'Liebm.',
    commonNames,
    genus: { scientificNameWithoutAuthor: name.split(' ')[0] },
    family: { scientificNameWithoutAuthor: 'Araceae' },
  },
});

describe('parseIdentifyResponse: PlantNet 응답에서 후보를 고른다 (SPEC.md 9.1)', () => {
  it('상위 3개를 학명·국명 후보·점수로 돌려준다', () => {
    const parsed = parseIdentifyResponse({
      results: [
        result('Monstera deliciosa', 0.87, ['Swiss cheese plant']),
        result('Monstera adansonii', 0.06),
        result('Philodendron hederaceum', 0.03),
        result('Epipremnum aureum', 0.01),
      ],
      remainingIdentificationRequests: 499,
    });

    expect(parsed).toEqual([
      { scientificName: 'Monstera deliciosa', commonNames: ['Swiss cheese plant'], score: 0.87 },
      { scientificName: 'Monstera adansonii', commonNames: [], score: 0.06 },
      { scientificName: 'Philodendron hederaceum', commonNames: [], score: 0.03 },
    ]);
  });

  it('학명에서 명명자는 뗀다. 종 DB 의 키와 맞춰야 한다', () => {
    const [first] = parseIdentifyResponse({ results: [result('Ficus elastica', 0.9)] });

    expect(first?.scientificName).toBe('Ficus elastica');
  });

  it('결과가 없으면 빈 배열이다', () => {
    expect(parseIdentifyResponse({ results: [] })).toEqual([]);
    expect(parseIdentifyResponse({})).toEqual([]);
    expect(parseIdentifyResponse(null)).toEqual([]);
  });

  it('모양이 다른 항목은 건너뛴다. 남의 응답을 믿지 않는다', () => {
    const parsed = parseIdentifyResponse({
      results: [
        { score: 0.5 },
        { species: { scientificNameWithoutAuthor: 'Aloe vera' } },
        { score: 'high', species: { scientificNameWithoutAuthor: 'Aloe vera' } },
        { score: 0.4, species: { scientificNameWithoutAuthor: '  Hedera helix  ' } },
      ],
    });

    expect(parsed).toEqual([{ scientificName: 'Hedera helix', commonNames: [], score: 0.4 }]);
  });

  it('국명 후보는 글자만 남긴다', () => {
    const [first] = parseIdentifyResponse({
      results: [result('Aloe vera', 0.7, ['알로에', '', 12 as unknown as string, '알로에 베라'])],
    });

    expect(first?.commonNames).toEqual(['알로에', '알로에 베라']);
  });
});

describe('pickCandidates: 앱에 보낼 후보 (SPEC.md 4.2)', () => {
  const three = [
    { scientificName: 'Monstera deliciosa', commonNames: [], score: 0.87 },
    { scientificName: 'Monstera adansonii', commonNames: [], score: 0.06 },
    { scientificName: 'Philodendron hederaceum', commonNames: [], score: 0.03 },
  ];

  it('점수가 너무 낮은 후보는 버린다. 엉뚱한 이름을 보여 주지 않는다', () => {
    const picked = pickCandidates([
      { scientificName: 'A', commonNames: [], score: 0.004 },
      { scientificName: 'B', commonNames: [], score: 0.002 },
    ]);

    expect(picked).toEqual([]);
  });

  it('쓸 만한 후보는 그대로 둔다', () => {
    expect(pickCandidates(three)).toEqual(three);
  });
});

describe('요청 규칙 (SPEC.md 9.1)', () => {
  it(`사진은 ${MAX_IMAGES}장까지, 부위는 네 가지다`, () => {
    expect(MAX_IMAGES).toBe(3);
    expect([...ORGANS]).toEqual(['leaf', 'flower', 'fruit', 'bark']);
  });
});

describe('withKoreanNames: 국명은 종 DB 에서 채운다 (SPEC.md 9.1)', () => {
  const candidates = [
    { scientificName: 'Monstera deliciosa', commonNames: ['Swiss cheese plant'], score: 0.9 },
    { scientificName: 'Aloe vera', commonNames: [], score: 0.1 },
  ];

  it('찾은 것만 국명을 붙인다. PlantNet 은 한국어를 주지 못한다', () => {
    const named = withKoreanNames(candidates, [
      { scientific_name: 'Monstera deliciosa', name_ko: '몬스테라' },
    ]);

    expect(named[0]).toMatchObject({ nameKo: '몬스테라' });
    expect(named[1]?.nameKo).toBeUndefined();
  });

  it('종 DB 조회가 실패하거나 모양이 다르면 그대로 둔다', () => {
    expect(withKoreanNames(candidates, null)).toEqual(candidates);
    expect(withKoreanNames(candidates, [{ scientific_name: 1 }])).toEqual(candidates);
  });
});

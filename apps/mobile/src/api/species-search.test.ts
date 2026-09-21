import { describe, expect, it } from 'vitest';

import { buildSearchFilter, mergeResults } from './species-search';

describe('buildSearchFilter: 서버에서 종을 찾는 조건 (SPEC.md 4.2)', () => {
  it('국명·별칭·학명에서 찾는다', () => {
    expect(buildSearchFilter('몬스테라')).toBe(
      '(name_ko.ilike.*몬스테라*,aliases_ko.cs.{몬스테라},scientific_name.ilike.*몬스테라*)',
    );
  });

  it('PostgREST 문법을 깨는 글자는 뺀다. 남의 서버에 이상한 질의를 보내지 않는다', () => {
    expect(buildSearchFilter('몬스,테라)')).toContain('name_ko.ilike.*몬스테라*');
    expect(buildSearchFilter('a{b}c')).toContain('name_ko.ilike.*abc*');
  });

  it('찾을 글자가 없으면 null', () => {
    expect(buildSearchFilter('   ')).toBeNull();
    expect(buildSearchFilter(',,,')).toBeNull();
  });
});

describe('mergeResults: 번들 시드와 서버 결과를 합친다', () => {
  const seed = [
    { scientificName: 'Monstera deliciosa', nameKo: '몬스테라', groupCode: 'tropical' as const, baseInterval: 7, bonsaiGroup: null },
  ];
  const server = [
    { scientificName: 'Monstera deliciosa', nameKo: '몬스테라(서버)', groupCode: 'tropical' as const, baseInterval: 7, bonsaiGroup: null },
    { scientificName: 'Monstera adansonii', nameKo: '몬스테라 아단소니', groupCode: 'tropical' as const, baseInterval: 7, bonsaiGroup: null },
  ];

  it('시드를 앞에 두고, 같은 학명은 시드를 남긴다', () => {
    const merged = mergeResults(seed, server);

    expect(merged.map((s) => s.scientificName)).toEqual([
      'Monstera deliciosa',
      'Monstera adansonii',
    ]);
    expect(merged[0]?.nameKo).toBe('몬스테라');
  });

  it('서버에 닿지 못하면 시드만 보여 준다', () => {
    expect(mergeResults(seed, [])).toEqual(seed);
  });
});

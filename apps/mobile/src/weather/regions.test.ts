import { describe, expect, it } from 'vitest';

import { REGIONS as SERVER_REGIONS } from '../../../../supabase/functions/_shared/regions';
import { findRegion, REGIONS, searchRegions, SIDOS } from './regions';

describe('날씨 지역 (SPEC.md 3.6)', () => {
  it('서버 목록과 id·시·도·이름이 같다. 다르면 서버가 모르는 지역을 보내게 된다', () => {
    expect(REGIONS).toEqual(
      SERVER_REGIONS.map(({ id, sido, name }) => ({ id, sido, name })),
    );
  });

  it('시·도는 서울부터 제주까지 17곳', () => {
    expect(SIDOS).toHaveLength(17);
    expect(SIDOS[0]).toBe('서울');
    expect(SIDOS.at(-1)).toBe('제주');
  });

  it('id 로 찾는다. 없거나 비었으면 null', () => {
    expect(findRegion('경기 수원시')).toEqual({ id: '경기 수원시', sido: '경기', name: '수원시' });
    expect(findRegion('경기 없는시')).toBeNull();
    expect(findRegion(null)).toBeNull();
    expect(findRegion('')).toBeNull();
  });

  it('이름이나 시·도로 찾는다', () => {
    expect(searchRegions('강남').map((region) => region.id)).toEqual(['서울 강남구']);
    expect(searchRegions('제주').map((region) => region.id)).toEqual(['제주 제주시', '제주 서귀포시']);
    expect(searchRegions('서울중구').map((region) => region.id)).toEqual(['서울 중구']);
    expect(searchRegions('   ')).toEqual([]);
  });
});

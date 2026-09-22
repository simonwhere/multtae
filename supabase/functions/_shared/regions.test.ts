import { describe, expect, it } from 'vitest';

import { toGrid } from './kma-grid';
import { AIR_AREAS, findRegion, REGIONS } from './regions';

describe('toGrid: 위경도 → 기상청 격자 (SPEC.md 7.1)', () => {
  it('활용가이드의 서울 예시와 같다', () => {
    expect(toGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 });
  });

  it('남쪽·동쪽으로 갈수록 ny 는 줄고 nx 는 는다', () => {
    const seoul = toGrid(37.5665, 126.978);
    const busan = toGrid(35.1796, 129.0756);

    expect(busan.nx).toBeGreaterThan(seoul.nx);
    expect(busan.ny).toBeLessThan(seoul.ny);
  });
});

describe('날씨 지역 목록 (SPEC.md 3.6)', () => {
  it('시·도 17곳, 시·군·구 229곳', () => {
    expect(new Set(REGIONS.map((region) => region.sido)).size).toBe(17);
    expect(REGIONS).toHaveLength(229);
  });

  it('id 는 겹치지 않고 id 로 찾을 수 있다', () => {
    expect(new Set(REGIONS.map((region) => region.id)).size).toBe(REGIONS.length);
    expect(findRegion('서울 강남구')).toMatchObject({ sido: '서울', name: '강남구', air: '서울' });
    expect(findRegion('없는 곳')).toBeUndefined();
  });

  it('모두 기상청 격자 안에 있다', () => {
    for (const region of REGIONS) {
      const { nx, ny } = toGrid(region.lat, region.lon);
      expect(nx, region.id).toBeGreaterThanOrEqual(1);
      expect(nx, region.id).toBeLessThanOrEqual(149);
      expect(ny, region.id).toBeGreaterThanOrEqual(1);
      expect(ny, region.id).toBeLessThanOrEqual(253);
    }
  });

  // 좌표를 잘못 적으면 엉뚱한 도시의 예보를 받는다. 시·도마다 격자가 모여 있는지 본다
  it.each([
    ['서울', 57, 63, 124, 129],
    ['부산', 95, 101, 73, 80],
    ['대구', 85, 91, 88, 99],
    ['인천', 50, 58, 118, 132],
    ['광주', 56, 61, 73, 76],
    ['대전', 66, 69, 99, 102],
    ['울산', 99, 105, 82, 87],
    ['제주', 50, 56, 31, 40],
  ])('%s 은 격자 nx %i~%i, ny %i~%i 안이다', (sido, nxMin, nxMax, nyMin, nyMax) => {
    for (const region of REGIONS.filter((item) => item.sido === sido)) {
      const { nx, ny } = toGrid(region.lat, region.lon);
      expect(nx, region.id).toBeGreaterThanOrEqual(nxMin);
      expect(nx, region.id).toBeLessThanOrEqual(nxMax);
      expect(ny, region.id).toBeGreaterThanOrEqual(nyMin);
      expect(ny, region.id).toBeLessThanOrEqual(nyMax);
    }
  });

  it('미세먼지 권역은 에어코리아 예보 권역 가운데 하나다', () => {
    for (const region of REGIONS) {
      expect(AIR_AREAS).toContain(region.air);
    }
    // 경기·강원만 둘로 나뉜다
    expect(findRegion('경기 고양시')?.air).toBe('경기북부');
    expect(findRegion('경기 수원시')?.air).toBe('경기남부');
    expect(findRegion('강원 강릉시')?.air).toBe('영동');
    expect(findRegion('강원 춘천시')?.air).toBe('영서');
  });
});

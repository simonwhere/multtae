import { describe, expect, it } from 'vitest';

import { crackPath, potOutlinePath, potShapePath } from './soil-texture';

/** path 문자열에서 좌표 쌍을 뽑는다 */
function points(path: string): { x: number; y: number }[] {
  const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    result.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return result;
}

const countCracks = (path: string) => (path.match(/M/g) ?? []).length;

describe('crackPath: 흙 게이지의 잔금·균열 (SPEC.md 14.1)', () => {
  it('같은 입력이면 늘 같은 모양이다', () => {
    expect(crackPath(320, 12, 'fine')).toBe(crackPath(320, 12, 'fine'));
    expect(crackPath(320, 12, 'deep')).toBe(crackPath(320, 12, 'deep'));
  });

  it('모든 점이 띠 안에 있다', () => {
    for (const kind of ['fine', 'deep'] as const) {
      for (const width of [40, 160, 320, 700]) {
        for (const { x, y } of points(crackPath(width, 12, kind))) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(width);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it('폭이 넓을수록 금이 많아져 밀도가 일정하다', () => {
    const narrow = countCracks(crackPath(160, 12, 'fine'));
    const wide = countCracks(crackPath(320, 12, 'fine'));

    expect(narrow).toBeGreaterThan(0);
    expect(wide).toBeGreaterThanOrEqual(narrow * 2 - 1);
    expect(wide).toBeLessThanOrEqual(narrow * 2 + 1);
  });

  it('밀린 흙의 균열은 잔금보다 굵직하게 갈라진다: 금 하나가 더 길고 가지를 친다', () => {
    const fine = crackPath(320, 12, 'fine');
    const deep = crackPath(320, 12, 'deep');

    expect(points(deep).length / countCracks(deep)).toBeGreaterThan(
      points(fine).length / countCracks(fine),
    );
  });

  it('잔금과 균열은 모양이 다르다 (색만으로 상태를 구분하지 않는다, SPEC 15)', () => {
    expect(crackPath(320, 12, 'fine')).not.toBe(crackPath(320, 12, 'deep'));
  });

  it('폭이 없으면 빈 문자열이다', () => {
    expect(crackPath(0, 12, 'fine')).toBe('');
    expect(crackPath(-5, 12, 'deep')).toBe('');
  });
});

describe('화분 단면 (분재용 게이지)', () => {
  it('위가 넓고 아래가 좁은 닫힌 도형이다', () => {
    const shape = potShapePath(200, 22);
    const xs = points(shape).map((point) => point.x);

    expect(shape.startsWith('M')).toBe(true);
    expect(shape.endsWith('Z')).toBe(true);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(200);
  });

  it('윤곽선은 흙 표면(윗변)을 그리지 않는 열린 선이다', () => {
    const outline = potOutlinePath(200, 22);

    expect(outline.startsWith('M')).toBe(true);
    expect(outline.endsWith('Z')).toBe(false);
  });

  it('모든 점이 영역 안에 있다', () => {
    for (const path of [potShapePath(200, 22), potOutlinePath(200, 22)]) {
      for (const { x, y } of points(path)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(200);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(22);
      }
    }
  });
});

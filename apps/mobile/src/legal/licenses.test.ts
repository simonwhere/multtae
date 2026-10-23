import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import licenses from './licenses.json';

const app = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};

// 설정의 오픈소스 라이선스 목록은 scripts/licenses.mjs 가 만든다. 의존성과 어긋나면 pnpm licenses 로 다시 만든다
describe('오픈소스 라이선스 목록 (SPEC.md 3.6)', () => {
  it('package.json 의 의존성과 같다', () => {
    expect(licenses.map((row) => row.name)).toEqual(Object.keys(app.dependencies).sort((a, b) => a.localeCompare(b)));
  });

  it('모든 항목에 라이선스가 적혀 있다', () => {
    for (const row of licenses) {
      expect(row.license, row.name).not.toBe('');
      expect(row.version, row.name).not.toBe('');
    }
  });
});

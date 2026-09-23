import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 화면 문구는 ko.ts 키로만 쓴다 (SPEC.md 15 다국어, CLAUDE.md 절대 규칙).
 * 영어를 더할 때 고칠 곳이 한 군데로 모이게, 소스에 한글 문자열이 남지 않았는지 본다.
 */

/** 문구가 아니라 말 자체를 다루는 곳 */
const ALLOWED = [
  // 조사는 글자에 따라 갈리는 문법이라 말 자체다
  'src/lib/josa.ts',
  // 서버에 넣을 SQL 을 만드는 파일. 주석이 SQL 문자열 안에 들어간다
  'src/coefficients/seed.ts',
  // 낱말 목록이 곧 데이터인 곳
  'src/i18n/',
  'src/weather/regions.ts',
  'src/species/seed.ts',
  'src/db/testing/',
];

const HANGUL = /[가-힣]/;
const ROOT = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...sources(path));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) found.push(path);
  }
  return found;
}

/** 주석은 한글로 쓴다. 문자열만 본다 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, (_match, before: string) => before);
}

function hardcoded(path: string): string[] {
  const source = withoutComments(readFileSync(join(ROOT, path), 'utf8'));
  const found: string[] = [];

  for (const match of source.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) {
    const text = match[1] ?? match[2] ?? match[3] ?? '';
    if (HANGUL.test(text)) found.push(text.trim().slice(0, 40));
  }
  // <AppText>물 줬어요</AppText> 처럼 태그 사이에 바로 쓴 글
  for (const match of source.matchAll(/>\s*([^<>{}\n]*[가-힣][^<>{}\n]*)\s*</g)) {
    found.push(match[1].trim().slice(0, 40));
  }
  return found;
}

describe('하드코딩 한국어 문자열', () => {
  it('앱 소스의 한글은 ko.ts 에만 있다', () => {
    const files = [...sources('app'), ...sources('src')].filter(
      (path) => !ALLOWED.some((allowed) => path.startsWith(allowed)),
    );
    const found = files.flatMap((path) => hardcoded(path).map((text) => `${path}: ${text}`));

    expect(found).toEqual([]);
  });

  it('빠뜨리지 않게, 일부러 넣은 한글은 잡는다', () => {
    expect(hardcoded('src/lib/josa.ts').length).toBeGreaterThan(0);
  });
});

// 설정의 "오픈소스 라이선스"에 보여 줄 목록을 만든다 (SPEC 3.6, 태스크 10-2).
// package.json 의 dependencies 마다 node_modules 의 package.json 에서 이름·버전·라이선스·저장소를 읽어
// src/legal/licenses.json 에 쓴다. 의존성을 더하거나 빼면 다시 돌린다: pnpm licenses
// src/legal/licenses.test.ts 가 package.json 과 어긋나지 않는지 지킨다.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const licenseOf = (pkg) =>
  typeof pkg.license === 'string'
    ? pkg.license
    : pkg.license?.type ?? (Array.isArray(pkg.licenses) ? pkg.licenses.map((l) => l.type).join(' / ') : '');

const repositoryOf = (pkg) => {
  const raw = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? '';
  return raw
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/\.git$/, '')
    .replace(/^github:/, 'https://github.com/');
};

const rows = Object.keys(app.dependencies)
  .sort((a, b) => a.localeCompare(b))
  .map((name) => {
    // exports 맵이 package.json 을 막는 패키지가 있어 경로로 바로 읽는다 (pnpm 의 node_modules 링크를 따라간다)
    const pkg = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'));
    return {
      name,
      version: pkg.version ?? '',
      license: licenseOf(pkg),
      repository: repositoryOf(pkg),
    };
  });

writeFileSync(join(root, 'src/legal/licenses.json'), `${JSON.stringify(rows, null, 2)}\n`);
console.log(`${rows.length}개 패키지를 src/legal/licenses.json 에 적었습니다.`);

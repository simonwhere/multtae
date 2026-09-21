/**
 * 서버 coefficients 테이블의 첫 값 (SPEC.md 11.2). 번들 기본값에서 만들어 둘이 어긋나지 않게 한다.
 * supabase/seed/coefficients.sql 은 이 함수의 결과이고, seed.test.ts 가 같은지 지킨다.
 */
import type { Coefficients } from '../engine';
import { toServerRows } from './parse';
import type { CoefficientRow } from './parse';

/** 앱은 읽지 않고 Edge Function 이 읽는 한도값 (SPEC 8.3, 9.1) */
export const SERVER_LIMIT_ROWS: CoefficientRow[] = [
  { key: 'diagnose_daily_limit', value: 3 },
  { key: 'daily_cap_identify', value: 450 },
];

const quote = (text: string) => `'${text.replace(/'/g, "''")}'`;

export function renderCoefficientsSeed(coefficients: Coefficients): string {
  const rows = [...toServerRows(coefficients), ...SERVER_LIMIT_ROWS];
  const values = rows
    .map((row) => `  (${quote(row.key)}, ${quote(JSON.stringify(row.value))}::jsonb)`)
    .join(',\n');

  return [
    '-- 계수의 첫 값. apps/mobile 의 번들 기본값(src/engine/defaults.ts)에서 만든 파일이다.',
    '-- 손으로 고치지 말고 `pnpm seed:coefficients` 로 다시 만든다. 운영 중의 조정은 대시보드에서 한다.',
    'insert into public.coefficients (key, value) values',
    `${values}`,
    'on conflict (key) do nothing;',
    '',
  ].join('\n');
}

/**
 * 종 DB 를 300종으로 채운다 (SPEC.md 10.5).
 *
 * 배포된 species Edge Function 을 학명마다 한 번씩 부른다. 생성 프롬프트와 검증은 그 함수가 하므로
 * 여기서 규칙이 갈라지지 않는다. 이미 DB 에 있는 종은 함수가 cache 로 답하고 넘어가서, 끊겨도 다시 돌리면 된다.
 *
 *   pnpm seed:species              전체 300종
 *   pnpm seed:species --limit 5    앞에서 5종만 (처음 확인할 때)
 *   pnpm seed:species --group herb 한 식물군만
 *
 * 주소와 키는 apps/mobile/.env 에서 읽는다. 비용은 새로 만드는 종 하나당 약 15원이다.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { BONSAI_CONIFER, BONSAI_DECIDUOUS, HERB, SEED_LIST, SUCCULENT, TEMPERATE, TROPICAL } from './species-list.ts';
import type { SeedEntry } from './species-list.ts';

/** 한 번에 보내는 요청 수. 생성은 20초쯤 걸리고, 한꺼번에 많이 보내면 모델 쪽에서 막는다 */
const CONCURRENCY = 3;
const TIMEOUT_MS = 120_000;

const GROUPS: Record<string, SeedEntry[]> = {
  tropical: TROPICAL,
  temperate: TEMPERATE,
  succulent: SUCCULENT,
  herb: HERB,
  bonsai_conifer: BONSAI_CONIFER,
  bonsai_deciduous: BONSAI_DECIDUOUS,
};

function readArg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function loadEnv(): { url: string; key: string } {
  const envPath = resolve(import.meta.dirname, '../apps/mobile/.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const key = (process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '').trim();
  if (!url || !key) {
    console.error('apps/mobile/.env 에 EXPO_PUBLIC_SUPABASE_URL 과 EXPO_PUBLIC_SUPABASE_KEY 가 있어야 합니다.');
    process.exit(1);
  }
  return { url, key };
}

type Outcome = 'generated' | 'cache' | 'pending' | 'error';

async function seedOne(
  entry: SeedEntry,
  { url, key }: { url: string; key: string },
): Promise<{ outcome: Outcome; detail?: string }> {
  const endpoint = `${url}/functions/v1/species?name=${encodeURIComponent(entry.scientificName)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { outcome: 'error', detail: `HTTP ${response.status} ${(await response.text()).slice(0, 80)}` };
    }

    const body = (await response.json()) as { source?: string; reason?: string };
    if (body.source === 'cache') return { outcome: 'cache' };
    if (body.source === 'generated') return { outcome: 'generated' };
    return { outcome: 'pending', detail: body.reason ?? '검증을 두 번 다 통과하지 못했습니다' };
  } catch (error) {
    return { outcome: 'error', detail: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const env = loadEnv();
  const groupName = readArg('group');
  const limit = Number(readArg('limit') ?? '0');

  let list = groupName ? GROUPS[groupName] : SEED_LIST;
  if (!list) {
    console.error(`--group 은 ${Object.keys(GROUPS).join(', ')} 중 하나입니다.`);
    process.exit(1);
  }
  if (limit > 0) list = list.slice(0, limit);

  console.log(`${list.length}종을 채웁니다. 이미 있는 종은 건너뜁니다.\n`);
  const counts: Record<Outcome, number> = { generated: 0, cache: 0, pending: 0, error: 0 };
  const failures: string[] = [];
  let done = 0;

  const queue = [...list];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const { outcome, detail } = await seedOne(entry, env);
      counts[outcome] += 1;
      done += 1;

      const mark = { generated: '생성', cache: '있음', pending: '보류', error: '실패' }[outcome];
      console.log(`[${String(done).padStart(3)}/${list.length}] ${mark}  ${entry.nameKo} (${entry.scientificName})`);
      if (detail) {
        console.log(`        ${detail}`);
        failures.push(`${entry.scientificName}: ${detail}`);
      }
    }
  });
  await Promise.all(workers);

  console.log(`\n생성 ${counts.generated} · 있음 ${counts.cache} · 보류 ${counts.pending} · 실패 ${counts.error}`);
  if (failures.length > 0) {
    console.log('\n다시 돌리면 실패한 것만 새로 시도합니다. 남은 것:');
    for (const line of failures) console.log(`  ${line}`);
  }
  process.exit(counts.error > 0 ? 1 : 0);
}

await main();

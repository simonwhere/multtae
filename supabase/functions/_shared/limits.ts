/**
 * 일일 한도 (SPEC.md 9.1, 9.3, 11.3). 세는 일은 DB 함수 bump_usage 가 원자적으로 한다.
 * 한도값은 coefficients 테이블에서 읽어 앱·함수 배포 없이 조정한다 (11.2).
 */

/** 서버에서 못 읽었을 때 쓰는 값 (SPEC 9.1, 9.3) */
export const DEFAULT_CAPS = {
  /** PlantNet 무료 한도 500 보다 낮게 잡아 여유를 둔다 */
  identify: 450,
  /** 기기당 하루 진단 횟수 */
  diagnose: 3,
} as const;

interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

/**
 * 오늘의 호출 수를 1 올리고 올린 뒤의 값을 돌려준다.
 * DB 가 실패하면 0 이다. 세지 못했다고 기능까지 막지는 않는다.
 */
export async function bumpUsage(
  client: RpcClient,
  functionName: string,
  subject = '',
): Promise<number> {
  const { data, error } = await client.rpc('bump_usage', {
    p_function: functionName,
    p_subject: subject,
  });
  if (error || typeof data !== 'number' || !Number.isFinite(data)) return 0;
  return data;
}

/** coefficients 행에서 한도값을 읽는다. 없거나 이상하면 기본값 */
export function readCap(rows: unknown, key: string, fallback: number): number {
  if (!Array.isArray(rows)) return fallback;
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const entry = row as { key?: unknown; value?: unknown };
    if (entry.key !== key) continue;
    return typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value > 0
      ? entry.value
      : fallback;
  }
  return fallback;
}

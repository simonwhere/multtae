/**
 * Supabase 를 부르는 공통 부분 (SPEC.md 11.2, 13). 주소와 공개 키는 빌드할 때 환경변수로 넣는다.
 * 앱은 비밀 키를 갖지 않고, AI 호출은 모두 Edge Function 을 거친다 (CLAUDE.md 절대 규칙).
 */

import { SIGNATURE_ENV, SIGNATURE_HEADER, signatureHeader } from './signature';
import type { Sha256 } from './signature';

/** .env 에 넣는 이름 */
export const SUPABASE_ENV = {
  url: 'EXPO_PUBLIC_SUPABASE_URL',
  key: 'EXPO_PUBLIC_SUPABASE_KEY',
  signature: SIGNATURE_ENV,
} as const;

export interface SupabaseConfig {
  url: string;
  key: string;
}

const clean = (value: string | undefined) => value?.trim() ?? '';

/** 서버 설정이 없으면 null. 그러면 앱은 서버 없이 도는 길로 간다 */
export function supabaseConfig(): SupabaseConfig | null {
  // Expo 는 EXPO_PUBLIC_ 변수를 빌드할 때 글자 그대로 바꿔 넣는다. process.env[이름] 으로 읽으면 비어 있다
  const url = clean(process.env.EXPO_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
  const key = clean(process.env.EXPO_PUBLIC_SUPABASE_KEY);
  return url && key ? { url, key } : null;
}

/**
 * 무작위 호출을 막는 앱 서명 (SPEC 9). 시크릿이 없으면 붙이지 않는다.
 * 해시를 하는 expo-crypto 는 기기에만 있어서, 시크릿이 있을 때만 불러온다.
 */
async function signHeaders(name: string): Promise<Record<string, string>> {
  const secret = clean(process.env.EXPO_PUBLIC_APP_SIGNATURE_SECRET);
  if (!secret) return {};

  try {
    const Crypto = await import('expo-crypto');
    const sha256: Sha256 = async (data) =>
      new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data));
    const header = await signatureHeader(sha256, secret, name, Date.now());
    return header ? { [SIGNATURE_HEADER]: header } : {};
  } catch {
    // 서명을 못 만들어도 부르기는 한다. 서버가 막으면 그 기능만 쉰다
    return {};
  }
}

export interface CallOptions {
  method?: 'GET' | 'POST';
  /** 쿼리 문자열 */
  search?: Record<string, string>;
  body?: BodyInit;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class FunctionError extends Error {
  constructor(
    /** Edge Function 이 준 코드 (http.ts 의 ErrorCode) 또는 http 상태 */
    readonly code: string,
    readonly status: number,
  ) {
    super(`${code} (${status})`);
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Edge Function 하나를 부른다. 서버 설정이 없으면 null */
export async function callFunction<T>(
  name: string,
  { method = 'GET', search, body, timeoutMs = DEFAULT_TIMEOUT_MS, signal }: CallOptions = {},
): Promise<T | null> {
  const config = supabaseConfig();
  if (!config) return null;

  const url = new URL(`${config.url}/functions/v1/${name}`);
  for (const [key, value] of Object.entries(search ?? {})) url.searchParams.set(key, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        ...(await signHeaders(name)),
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const failure = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new FunctionError(failure?.error ?? String(response.status), response.status);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

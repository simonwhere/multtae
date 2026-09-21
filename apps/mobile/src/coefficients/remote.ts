/**
 * 서버에서 계수를 받아 온다 (SPEC.md 11.2). 계수는 모두에게 같은 공개 값이라 읽기만 하고,
 * 사용자 데이터는 아무것도 보내지 않는다. 주소와 키는 빌드할 때 환경변수로 넣는다 (SPEC 17).
 */
const TIMEOUT_MS = 8000;

/** .env 에 넣는 이름. 실제 읽기는 아래에서 정적으로 한다 */
export const SUPABASE_ENV = {
  url: 'EXPO_PUBLIC_SUPABASE_URL',
  key: 'EXPO_PUBLIC_SUPABASE_KEY',
} as const;

const clean = (value: string | undefined) => value?.trim() ?? '';

/** 서버 설정이 없으면 null. 그러면 앱은 번들 기본값이나 마지막으로 받은 값으로 돈다 */
export async function fetchCoefficientRows(): Promise<unknown> {
  // Expo 는 EXPO_PUBLIC_ 변수를 빌드할 때 글자 그대로 바꿔 넣는다. process.env[이름] 으로 읽으면 비어 있다
  const url = clean(process.env.EXPO_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
  const key = clean(process.env.EXPO_PUBLIC_SUPABASE_KEY);
  if (!url || !key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/rest/v1/coefficients?select=key,value`, {
      // 키는 apikey 헤더로만 보낸다. 새 publishable 키는 JWT 가 아니라서 Authorization 으로는 인증되지 않는다
      headers: { apikey: key },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`coefficients ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

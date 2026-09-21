/**
 * Edge Function 공통 응답 (SPEC.md 9). 앱만 부르므로 CORS 는 넓게 열지 않는다.
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
} as const;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** 앱이 구분해서 처리하는 오류 코드 (SPEC 9.1: limit 이면 텍스트 검색으로 넘어간다) */
export type ErrorCode = 'bad_request' | 'limit' | 'upstream' | 'server';

export function fail(code: ErrorCode, status: number): Response {
  return json({ error: code }, status);
}

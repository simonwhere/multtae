/**
 * Claude 호출 (SPEC.md 9). 키는 Edge Function 환경변수에만 있고 앱은 갖지 않는다.
 */

/**
 * 종 정보 생성과 진단에 쓰는 모델.
 * SPEC 9.2 는 claude-sonnet-4-6 으로 적혀 있으나, 그 뒤에 나온 Sonnet 5 가 같은 값에 더 정확하다.
 */
export const CLAUDE_MODEL = 'claude-sonnet-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/** 비전 호출에 함께 보내는 사진. 사용자 사진은 이 요청에만 쓰이고 저장되지 않는다 */
export interface ClaudeImage {
  mediaType: string;
  base64: string;
}

export interface ClaudeOptions {
  apiKey: string;
  system: string;
  prompt: string;
  /** 사진을 먼저 보내고 글을 뒤에 붙인다 */
  images?: readonly ClaudeImage[];
  maxTokens?: number;
  model?: string;
  signal?: AbortSignal;
}

/** 답의 글자만 돌려준다. 실패하면 던진다 */
export async function askClaude({
  apiKey,
  system,
  prompt,
  images = [],
  maxTokens = 2000,
  model = CLAUDE_MODEL,
  signal,
}: ClaudeOptions): Promise<string> {
  const content = [
    ...images.map((image) => ({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
    })),
    { type: 'text', text: prompt },
  ];

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`claude ${response.status}`);
  }

  const body = (await response.json()) as { content?: { type: string; text?: string }[] };
  return (body.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}

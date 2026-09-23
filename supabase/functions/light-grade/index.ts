/**
 * 공간 사진으로 빛 등급을 판단한다 (SPEC.md 9.2, 4.1).
 * 사진은 Claude 로 넘기는 동안 메모리에만 있고 어디에도 저장하지 않는다 (CLAUDE.md 절대 규칙).
 * 실패하거나 한도를 넘으면 앱이 방향 × 유형 기본값 표로 간다.
 */
import { createClient } from '@supabase/supabase-js';

import { askClaude } from '../_shared/claude.ts';
import { CORS_HEADERS, fail, json } from '../_shared/http.ts';
import { SIGNATURE_HEADER, verifySignature } from '../_shared/signature.ts';
import { bumpUsage, DEFAULT_CAPS, readCap } from '../_shared/limits.ts';
import {
  buildLightPrompt,
  bytesToBase64,
  isDirection,
  isSpaceType,
  SYSTEM_PROMPT,
  validateLightReading,
} from '../_shared/light.ts';
import { extractJson } from '../_shared/species-schema.ts';

/** 사진은 앱에서 1280px JPEG 로 줄여 보낸다. 그보다 훨씬 크면 우리 사진이 아니다 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return fail('bad_request', 405);
  // 앱 서명 확인 (SPEC 9, 13.3). 시크릿을 아직 넣지 않았으면 그냥 지나간다
  const signature = await verifySignature(
    request.headers.get(SIGNATURE_HEADER),
    Deno.env.get('APP_SIGNATURE_SECRET') ?? '',
    'light-grade',
    Date.now(),
  );
  if (signature !== 'ok') return fail('bad_request', 401);


  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !supabaseUrl || !serviceKey) return fail('server', 500);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('bad_request', 400);
  }

  const image = form.get('image');
  const direction = form.get('direction');
  const spaceType = form.get('space_type');
  if (!(image instanceof File) || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return fail('bad_request', 400);
  }
  if (!isDirection(direction) || !isSpaceType(spaceType)) return fail('bad_request', 400);

  const supabase = createClient(supabaseUrl, serviceKey);

  // 한도를 먼저 센다. 넘으면 Claude 를 부르지 않고 앱이 기본값 표로 간다
  const { data: caps } = await supabase.from('coefficients').select('key,value');
  const cap = readCap(caps, 'daily_cap_light_grade', DEFAULT_CAPS.lightGrade);
  if ((await bumpUsage(supabase, 'light-grade')) > cap) return fail('limit', 429);

  let text: string;
  try {
    text = await askClaude({
      apiKey,
      system: SYSTEM_PROMPT,
      prompt: buildLightPrompt(direction, spaceType),
      images: [
        {
          mediaType: image.type || 'image/jpeg',
          base64: bytesToBase64(new Uint8Array(await image.arrayBuffer())),
        },
      ],
      maxTokens: 500,
    });
  } catch (error) {
    console.error('light-grade', error instanceof Error ? error.message : error);
    return fail('upstream', 502);
  }

  const reading = validateLightReading(extractJson(text));
  if (!reading) {
    console.error('light-grade 형식', text.slice(0, 300));
    return fail('upstream', 502);
  }

  return json({ light: reading });
});

/**
 * 병해충·상태 진단 (SPEC.md 8.1, 9.3). 사진 1~3장과 종·식물군·최근 물주기를 Claude 비전으로 본다.
 * 사진은 함수가 도는 동안 메모리에만 있고 어디에도 저장하지 않는다 (CLAUDE.md 절대 규칙).
 *
 * 한도는 기기당 하루 3회(coefficients.diagnose_daily_limit)와 전체 하루 상한(daily_cap_diagnose)이다.
 * 기기는 앱이 처음 켤 때 만든 무작위 uuid 이고, 서버는 그 해시로만 센다 (11.3).
 */
import { createClient } from '@supabase/supabase-js';

import { askClaude } from '../_shared/claude.ts';
import {
  buildDiagnosePrompt,
  hashDeviceId,
  isDeviceId,
  MAX_IMAGES,
  parseRecent,
  SYSTEM_PROMPT,
  validateDiagnosis,
  validateDiagnosisLoosely,
} from '../_shared/diagnose.ts';
import type { Diagnosis } from '../_shared/diagnose.ts';
import { CORS_HEADERS, fail, json } from '../_shared/http.ts';
import { bytesToBase64 } from '../_shared/light.ts';
import { bumpUsage, DEFAULT_CAPS, readCap } from '../_shared/limits.ts';
import { extractJson, GROUP_CODES } from '../_shared/species-schema.ts';

/** 사진은 앱에서 1280px JPEG 로 줄여 보낸다. 그보다 훨씬 크면 우리 사진이 아니다 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return fail('bad_request', 405);

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

  const images = form.getAll('images').filter((value): value is File => value instanceof File);
  const deviceId = form.get('device_id');
  const groupCode = form.get('group_code');
  const species = form.get('species');
  if (images.length === 0 || images.length > MAX_IMAGES) return fail('bad_request', 400);
  if (images.some((image) => image.size === 0 || image.size > MAX_IMAGE_BYTES)) {
    return fail('bad_request', 400);
  }
  if (!isDeviceId(deviceId) || !(GROUP_CODES as readonly unknown[]).includes(groupCode)) {
    return fail('bad_request', 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 기기당 한도를 먼저, 그다음 전체 상한을 센다. 넘으면 Claude 를 부르지 않는다
  const { data: caps } = await supabase.from('coefficients').select('key,value');
  const perDevice = readCap(caps, 'diagnose_daily_limit', DEFAULT_CAPS.diagnose);
  const used = await bumpUsage(supabase, 'diagnose', await hashDeviceId(deviceId));
  if (used > perDevice) return fail('limit', 429);
  if ((await bumpUsage(supabase, 'diagnose')) > readCap(caps, 'daily_cap_diagnose', DEFAULT_CAPS.diagnoseTotal)) {
    return fail('limit', 429);
  }

  const encoded = await Promise.all(
    images.map(async (image) => ({
      mediaType: image.type || 'image/jpeg',
      base64: bytesToBase64(new Uint8Array(await image.arrayBuffer())),
    })),
  );
  const input = {
    species: typeof species === 'string' && species.trim() !== '' ? species.trim().slice(0, 100) : null,
    groupCode: groupCode as string,
    recent: parseRecent(form.get('recent')),
  };

  // 거부되면 이유를 넣어 한 번만 더 묻는다. 두 번째에는 문구 규칙만 어긴 답은 받아 준다 (10.4 와 같은 방식)
  let rejectedReason: string | null = null;
  let diagnosis: Diagnosis | null = null;
  for (let attempt = 0; attempt < 2 && !diagnosis; attempt += 1) {
    let text: string;
    try {
      text = await askClaude({
        apiKey,
        system: SYSTEM_PROMPT,
        prompt: buildDiagnosePrompt(input, rejectedReason),
        images: encoded,
        maxTokens: 1200,
      });
    } catch (error) {
      console.error('diagnose', error instanceof Error ? error.message : error);
      return fail('upstream', 502);
    }

    const value = extractJson(text);
    if (attempt === 0) {
      const result = validateDiagnosis(value);
      if (result.ok) diagnosis = result.value;
      else rejectedReason = result.reason;
    } else {
      diagnosis = validateDiagnosisLoosely(value);
    }
  }

  if (!diagnosis) {
    console.error('diagnose 형식', rejectedReason);
    return fail('upstream', 502);
  }
  return json({ diagnosis, remaining: Math.max(0, perDevice - used) });
});

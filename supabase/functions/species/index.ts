/**
 * 학명으로 종 정보를 준다 (SPEC.md 9.4, 10.3, 10.4).
 * 종 DB 에 있으면 그대로 주고, 없으면 Claude 로 한 번 만들어 검증한 뒤 저장한다.
 * 만든 정보는 모든 사용자가 같이 쓴다. 사용자 데이터는 오가지 않는다.
 */
import { createClient } from '@supabase/supabase-js';

import { askClaude } from '../_shared/claude.ts';
import { CORS_HEADERS, fail, json } from '../_shared/http.ts';
import {
  extractJson,
  GENERATED_SPECIES,
  validateSpecies,
} from '../_shared/species-schema.ts';
import { buildUserPrompt, SYSTEM_PROMPT } from '../_shared/species-prompt.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'GET') return fail('bad_request', 405);

  const scientificName = new URL(request.url).searchParams.get('name')?.trim();
  if (!scientificName || scientificName.length > 200) return fail('bad_request', 400);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !supabaseUrl || !serviceKey) return fail('server', 500);

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: cached } = await supabase
    .from('species')
    .select('*')
    .eq('scientific_name', scientificName)
    .maybeSingle();
  if (cached) return json({ species: cached, source: 'cache' });

  // 한 번 거부되면 이유를 알려 주고 한 번만 더 만든다 (10.4)
  let rejectedReason: string | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let text: string;
    try {
      text = await askClaude({
        apiKey,
        system: SYSTEM_PROMPT,
        prompt: buildUserPrompt(scientificName, { rejectedReason }),
      });
    } catch {
      return fail('upstream', 502);
    }

    const result = validateSpecies(extractJson(text));
    if (!result.ok) {
      rejectedReason = result.reason;
      continue;
    }

    // 학명은 물어본 것으로 맞춘다. 모델이 철자를 바꿔 놓으면 앱의 키와 어긋난다
    const row = GENERATED_SPECIES({ ...result.value, scientific_name: scientificName });
    const { data: saved } = await supabase
      .from('species')
      .upsert(row, { onConflict: 'scientific_name' })
      .select()
      .maybeSingle();

    return json({ species: saved ?? row, source: 'generated' });
  }

  // 두 번 다 실패. 앱은 식물군만 고르게 하고 나중에 다시 묻는다 (9.4)
  return json({ species: null, source: 'pending', reason: rejectedReason }, 200);
});

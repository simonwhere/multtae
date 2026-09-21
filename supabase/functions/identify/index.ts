/**
 * 사진으로 식물 종을 알아본다 (SPEC.md 9.1). 앱은 API 키를 갖지 않고 이 함수를 부른다.
 * 사진은 여기서 PlantNet 으로 넘기는 동안 메모리에만 있고 어디에도 저장하지 않는다 (CLAUDE.md 절대 규칙).
 */
import { createClient } from '@supabase/supabase-js';

import { bumpUsage, DEFAULT_CAPS, readCap } from '../_shared/limits.ts';
import { CORS_HEADERS, fail, json } from '../_shared/http.ts';
import {
  MAX_IMAGES,
  ORGANS,
  parseIdentifyResponse,
  pickCandidates,
  withKoreanNames,
} from '../_shared/plantnet.ts';

const PLANTNET_URL = 'https://my-api.plantnet.org/v2/identify/all';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return fail('bad_request', 405);

  const apiKey = Deno.env.get('PLANTNET_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !supabaseUrl || !serviceKey) return fail('server', 500);

  // 앱이 보낸 사진과 부위를 그대로 PlantNet 형식으로 옮긴다
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return fail('bad_request', 400);
  }

  const images = incoming.getAll('images').filter((value): value is File => value instanceof File);
  const organs = incoming.getAll('organs').map(String);
  if (images.length === 0 || images.length > MAX_IMAGES) return fail('bad_request', 400);
  if (organs.length !== images.length) return fail('bad_request', 400);
  if (!organs.every((organ) => (ORGANS as readonly string[]).includes(organ))) {
    return fail('bad_request', 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 한도를 먼저 센다. 넘으면 PlantNet 을 부르지 않고 앱이 텍스트 검색으로 넘어가게 한다
  const { data: caps } = await supabase.from('coefficients').select('key,value');
  const cap = readCap(caps, 'daily_cap_identify', DEFAULT_CAPS.identify);
  const used = await bumpUsage(supabase, 'identify');
  if (used > cap) return fail('limit', 429);

  const outgoing = new FormData();
  for (const [index, image] of images.entries()) {
    outgoing.append('images', image, image.name || `plant-${index}.jpg`);
    outgoing.append('organs', organs[index]);
  }

  let response: Response;
  try {
    // PlantNet 은 한국어 통용명을 주지 못한다(lang=ko 는 404). 국명은 아래에서 종 DB 로 채운다
    response = await fetch(`${PLANTNET_URL}?api-key=${apiKey}&lang=en`, {
      method: 'POST',
      body: outgoing,
    });
  } catch {
    return fail('upstream', 502);
  }

  // 키가 막혔거나 PlantNet 이 아플 때. 앱은 검색으로 넘어간다
  if (!response.ok) {
    console.error('plantnet', response.status, (await response.text()).slice(0, 300));
    return fail(response.status === 429 ? 'limit' : 'upstream', 502);
  }

  const candidates = pickCandidates(parseIdentifyResponse(await response.json()));
  if (candidates.length === 0) return json({ candidates });

  // 국명은 종 DB 에서 채운다 (9.1). 한 번의 조회로 후보 세 개를 함께 본다
  const { data: known } = await supabase
    .from('species')
    .select('scientific_name,name_ko')
    .in('scientific_name', candidates.map((candidate) => candidate.scientificName));

  return json({ candidates: withKoreanNames(candidates, known) });
});

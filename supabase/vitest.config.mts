import { defineConfig } from 'vitest/config';

// Edge Function 은 Deno 에서 돌지만, 순수 로직(응답 파싱·검증·한도 판단)은 런타임과 무관해서
// 여기서 Node 로 테스트한다. Deno 전용 API(Deno.env, serve)는 각 함수의 index.ts 에만 둔다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['functions/**/*.test.ts'],
  },
});

import { defineConfig } from 'drizzle-kit';

// 스키마를 바꾼 뒤 `pnpm db:generate` 로 마이그레이션을 만든다.
// 새 .sql 은 babel 이 인라인하므로 `expo start -c` 로 Metro 캐시를 비워야 번들에 반영된다.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // tsconfig 의 "@/*" → "./src/*" 와 맞춘다.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // src/engine 은 커버리지 100% 유지 (CLAUDE.md)
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/**/*.test.ts'],
      thresholds: { 100: true },
      reporter: ['text', 'html'],
    },
  },
});

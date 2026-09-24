import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { colors } from './tokens';

// app.json 에는 네이티브 쪽이 읽는 색을 글자로 적을 수밖에 없다. 토큰과 갈라지지 않게 본다
const app = JSON.parse(readFileSync(resolve(__dirname, '../../app.json'), 'utf8')) as {
  expo: {
    android: { adaptiveIcon: { backgroundColor: string } };
    plugins: (string | [string, Record<string, unknown>])[];
  };
};

function pluginOptions(name: string): Record<string, unknown> {
  const entry = app.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === name);
  if (!Array.isArray(entry)) throw new Error(`${name} 설정이 없습니다`);
  return entry[1];
}

describe('app.json 의 색은 토큰과 같다', () => {
  it('스플래시 바탕은 밝은 쪽·어두운 쪽 종이색', () => {
    const splash = pluginOptions('expo-splash-screen') as {
      backgroundColor: string;
      dark: { backgroundColor: string };
    };
    expect(splash.backgroundColor).toBe(colors.light.paper);
    expect(splash.dark.backgroundColor).toBe(colors.dark.paper);
  });

  it('안드로이드 아이콘 바탕은 새순 연두', () => {
    expect(app.expo.android.adaptiveIcon.backgroundColor).toBe(colors.light.highlight);
  });

  it('안드로이드 알림 아이콘 색은 accent (9-4)', () => {
    expect(pluginOptions('expo-notifications')).toMatchObject({ color: colors.light.accent });
  });

  it('안드로이드 시스템 창의 강조색은 accent (9-4)', () => {
    expect(pluginOptions('./plugins/with-android-accent')).toEqual({
      light: colors.light.accent,
      dark: colors.dark.accent,
    });
  });
});

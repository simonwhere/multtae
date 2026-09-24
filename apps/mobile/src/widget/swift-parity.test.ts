import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ko } from '../i18n/ko';
import { buildWidgetSnapshot, WIDGET_APP_GROUP, WIDGET_KEY, WIDGET_VERSION } from './snapshot';

// 위젯(targets/widget)은 Swift 라서 앱 코드를 가져다 쓰지 못한다. 앱이 넘기는 것과 위젯이 읽는 것이
// 갈라지지 않게 여기서 맞춰 본다 (9-3)
const root = resolve(__dirname, '../..');
const swift = readFileSync(resolve(root, 'targets/widget/TodayWidget.swift'), 'utf8');
const appJson = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')) as {
  expo: { ios: { entitlements: Record<string, string[]> } };
};

describe('위젯 Swift 와 앱이 같은 것을 본다', () => {
  it('같은 App Group·키·판을 쓴다', () => {
    expect(appJson.expo.ios.entitlements['com.apple.security.application-groups']).toEqual([
      WIDGET_APP_GROUP,
    ]);
    expect(swift).toContain(`private let appGroup = "${WIDGET_APP_GROUP}"`);
    expect(swift).toContain(`private let snapshotKey = "${WIDGET_KEY}"`);
    expect(swift).toContain(`private let supportedVersion = ${WIDGET_VERSION}`);
  });

  it('위젯 목록의 이름과 설명은 ko.ts 와 같다', () => {
    // 앱을 열기 전에도 보여야 해서 Swift 에만 글자를 둘 수 있는 곳이다
    expect(swift).toContain(`.configurationDisplayName("${ko.widget.galleryName}")`);
    expect(swift).toContain(`.description("${ko.widget.galleryDescription}")`);
  });

  it('앱이 넘기는 항목을 위젯이 모두 읽는다', () => {
    const snapshot = buildWidgetSnapshot([], Date.UTC(2026, 8, 24), 540);
    const keys = [
      ...Object.keys(snapshot),
      ...Object.keys(snapshot.colors),
      ...Object.keys(snapshot.colors.light),
      ...Object.keys(snapshot.days[0]!),
      // 줄은 빈 목록이라 모양에서 가져온다
      'name',
      'tag',
      'overdue',
    ];
    for (const key of keys) expect(swift, key).toMatch(new RegExp(`let ${key}: `));
  });

  it('Swift 에는 위젯 목록 두 줄 말고 한국어가 없다', () => {
    const lines = swift
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('///'))
      .filter((line) => /[가-힣]/.test(line));
    expect(lines.map((line) => line.trim())).toEqual([
      `.configurationDisplayName("${ko.widget.galleryName}")`,
      `.description("${ko.widget.galleryDescription}")`,
    ]);
  });
});

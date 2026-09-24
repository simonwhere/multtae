'use no memo';
/**
 * 안드로이드 위젯이 그릴 때 부르는 곳 (9-3). 앱이 꺼져 있어도 시스템이 한 시간마다 깨워
 * 저장해 둔 일주일치에서 오늘 것을 골라 그리게 한다. 자정이 지나 앱을 열지 않아도 넘어간다.
 * 위젯 라이브러리를 읽으므로 위젯 모듈이 든 빌드에서만 불러야 한다 (./available.ts).
 */
import { File, Paths } from 'expo-file-system';
import type { WidgetInfo, WidgetTaskHandler } from 'react-native-android-widget';

import { ko } from '@/i18n/ko';
import { colors } from '@/ui/tokens';

import { parseWidgetSnapshot, pickWidgetDay, WIDGET_LINES, widgetColors } from '../snapshot';
import { TodayWidget } from './today-widget';

/** 위젯이 이만큼 낮으면 이름을 두 줄만 쓴다 (dp) */
const SHORT_WIDGET_HEIGHT = 170;

export function snapshotFile(): File {
  return new File(Paths.document, 'widget.json');
}

export async function readSnapshotText(): Promise<string | null> {
  try {
    const file = snapshotFile();
    return file.exists ? await file.text() : null;
  } catch {
    return null;
  }
}

/** 밝은 쪽과 어두운 쪽 두 벌을 만든다. 시스템이 테마에 맞는 것을 고른다 */
export function renderToday(text: string | null, info: WidgetInfo, now = Date.now()) {
  const snapshot = parseWidgetSnapshot(text);
  const day = snapshot ? pickWidgetDay(snapshot, now, -new Date(now).getTimezoneOffset()) : null;
  // 앱을 한 번도 열지 않았으면 등록하라는 말을, 만들어 둔 날을 다 썼으면 앱을 열어 달라는 말을 쓴다
  const message = snapshot ? snapshot.stale : ko.widget.empty;
  const palette = snapshot?.colors ?? {
    light: widgetColors(colors.light),
    dark: widgetColors(colors.dark),
  };
  const lines = info.height < SHORT_WIDGET_HEIGHT ? 2 : WIDGET_LINES;

  return {
    light: <TodayWidget day={day} message={message} colors={palette.light} lines={lines} />,
    dark: <TodayWidget day={day} message={message} colors={palette.dark} lines={lines} />,
  };
}

export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetInfo, widgetAction, renderWidget }) => {
  // 누르면 앱이 열리는 것은 위젯 쪽에서 처리한다. 지운 위젯은 그릴 것이 없다
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(renderToday(await readSnapshotText(), widgetInfo));
};

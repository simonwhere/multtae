import { Alert, Platform } from 'react-native';
import type { AlertButton } from 'react-native';

import { keepHangulWords } from '@/lib/keep-words';

/**
 * 시스템 확인 창. 안드로이드 창도 한글 낱말이 갈리지 않게 한다 (lib/keep-words.ts).
 * 앱에서는 Alert.alert 대신 이것을 쓴다.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'android') {
    Alert.alert(title, message, buttons);
    return;
  }
  Alert.alert(
    keepHangulWords(title),
    message === undefined ? undefined : keepHangulWords(message),
    buttons?.map((button) =>
      button.text === undefined ? button : { ...button, text: keepHangulWords(button.text) },
    ),
  );
}

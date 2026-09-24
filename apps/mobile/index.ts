/**
 * 앱 진입점. 화면은 expo-router 가 올리고, 안드로이드 홈 화면 위젯이 앱이 꺼져 있을 때
 * 부를 작업을 여기서 등록한다 (9-3).
 */
import 'expo-router/entry';

import { registerAndroidWidget } from '@/widget/android/register';

registerAndroidWidget();

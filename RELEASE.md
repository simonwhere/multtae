# 배포 안내 (8주차)

여기까지는 코드로 끝나지 않는 일들이다. 계정과 결제, 심사가 섞여 있어 순서대로 적는다.
각 단계는 SPEC.md 16장 8-3·8-4, 17장 체크리스트와 이어진다.

## 0. 먼저 만들어 둘 것

| 무엇 | 어디서 | 비용 | 걸리는 시간 |
| --- | --- | --- | --- |
| Apple Developer Program | developer.apple.com/programs | 연 129,000원쯤 | 승인까지 1~2일, 가끔 일주일 |
| Google Play Console | play.google.com/console | 25달러 1회 | 본인 확인에 1~2일 |
| Expo 계정 | expo.dev | 무료 (빌드는 월 30회 무료) | 바로 |
| Sentry 계정 | sentry.io | 무료 (월 5천 이벤트) | 바로 |

Apple 은 개인 계정이면 앱 이름 옆에 본인 이름이 뜨고, 사업자 등록이 있으면 회사 이름으로
낼 수 있다. Google 은 2023년 이후 새 개인 개발자 계정이면 **비공개 테스트 12명 × 14일**을
채워야 프로덕션에 낼 수 있다. 이 12명은 지인이어도 되지만 실제로 설치해 두어야 한다.

## 1. EAS 준비 (8-3)

```bash
cd apps/mobile
npx eas-cli@latest login          # Expo 계정
npx eas-cli@latest init           # app.json 에 projectId 가 들어간다
```

빌드 설정은 [apps/mobile/eas.json](apps/mobile/eas.json) 에 이미 있다.

| 프로필 | 쓰는 곳 |
| --- | --- |
| development | 개발 빌드. 시뮬레이터에서 배경 작업·알림·아이콘까지 진짜로 확인할 때 |
| preview | 지인에게 설치 파일로 건넬 때 (안드로이드는 apk) |
| production | 스토어에 낼 빌드 |

## 2. 비밀 값 넣기 (EAS Secrets)

앱 번들에 들어가는 값이라 `.env` 대신 EAS 에 넣어 두고 빌드할 때 꺼내 쓴다.

```bash
cd apps/mobile
npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://jddopglqjtrvwmzylrlk.supabase.co"
npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_SUPABASE_KEY --value "sb_publishable_..."
npx eas-cli@latest secret:list
```

### 앱 서명 시크릿 (선택, SPEC 9)

무작위 호출을 막는 문턱이다. **양쪽에 같은 값을 넣어야 켜진다.**

```bash
# 1. 아무 값이나 길게 만든다
openssl rand -hex 32

# 2. 서버에 넣는다
npx -y supabase@latest secrets set APP_SIGNATURE_SECRET="<위에서 만든 값>" --project-ref jddopglqjtrvwmzylrlk

# 3. 앱에 같은 값을 넣는다
cd apps/mobile
npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_APP_SIGNATURE_SECRET --value "<같은 값>"
```

서버에만 넣으면 지금 깔린 앱이 401 을 받아 인식·진단·날씨가 멈춘다. 그러니 **앱 빌드를 먼저
올린 뒤 서버 시크릿을 넣는다.** 끌 때는 반대로 서버 시크릿을 먼저 지운다.

### Sentry (SPEC 13.2)

크래시만 본다. 사진이나 식물 기록은 보내지 않는다.

```bash
# 1. sentry.io 에서 프로젝트를 만든다 (플랫폼: React Native)
#    Settings > Projects > multtae > Client Keys 에서 DSN 을 복사한다
# 2. 앱에 넣는다
cd apps/mobile
npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://...@...ingest.sentry.io/..."
# 3. 소스맵을 올리려면 토큰도 넣는다 (Settings > Auth Tokens)
npx eas-cli@latest secret:create --scope project --name SENTRY_AUTH_TOKEN --value "sntrys_..."
```

그다음 코드에 연결한다. 네이티브 모듈이라 Expo Go 에서는 돌지 않고 개발 빌드가 있어야 한다.

```bash
cd apps/mobile
npx expo install @sentry/react-native
```

`app.json` 의 plugins 에 `"@sentry/react-native/expo"` 를 더하고,
`src/telemetry/report.ts` 의 `reportError` 안에 `Sentry.captureException` 을 넣는다.
`Sentry.init` 은 `app/_layout.tsx` 맨 위에서 한 번 부르고, 개인정보가 섞이지 않게 옵션을 둔다.

```ts
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__ && !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0,
});
```

## 3. 개발 빌드로 확인 (8-3)

Expo Go 에서 확인하지 못한 것들이 여기서 처음 돌아간다.

```bash
cd apps/mobile
npx eas-cli@latest build --profile development --platform ios   # 시뮬레이터용
```

빌드가 끝나면 받은 파일을 시뮬레이터에 끌어다 놓고 확인할 것:

- [ ] 앱 아이콘과 스플래시가 잔가지로 나오는지 (밝은 쪽·어두운 쪽)
- [ ] 백그라운드에서 날씨를 받아 오는지 (expo-background-task, 최소 6시간)
- [ ] 알림이 실제로 예약되고 울리는지
- [ ] 개발용 버튼 없이 스토어 스크린샷을 찍을 수 있는지 (store/README.md)

안드로이드는 실기기가 있어야 성능(7-1 저사양 기기)과 알림을 볼 수 있다.

```bash
npx eas-cli@latest build --profile preview --platform android    # apk 를 받아 설치
```

## 4. 스토어에 올리기 (8-4)

```bash
cd apps/mobile
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios        # App Store Connect 로 올라간다
```

App Store Connect 에서 할 일:

1. 앱 만들기: 이름 **물때**, 번들 ID `kr.multtae.app`, 기본 언어 한국어
2. [store/description-ko.md](store/description-ko.md) 의 이름·부제·설명문·키워드를 붙여 넣기
3. 스크린샷 6장 올리기 (6.9인치)
4. 개인정보처리방침 주소: https://simonwhere.github.io/multtae/privacy.html
5. App Privacy 라벨: 문서의 표대로 (기기 ID 만 수집, 추적 안 함)
6. TestFlight 내부 테스트로 일주일 써 보고 제출
7. 심사 노트에 문서의 글을 붙이고, 식물 사진 세 장을 첨부

플레이스토어:

```bash
npx eas-cli@latest build --profile production --platform android
npx eas-cli@latest submit --platform android
```

1. 데이터 안전 섹션을 문서의 표대로 채우기
2. 내부 테스트 → 비공개 테스트 12명 14일 → 프로덕션
3. 앱 서명은 Play App Signing 을 쓴다

## 5. 반려가 났을 때 (8-4)

흔한 세 가지다.

| 반려 사유 | 대응 |
| --- | --- |
| AI 결과에 대한 안내 부족 | 진단·빛 화면에 이미 "AI 추정" 문구가 있다. 스크린샷으로 보여 준다 |
| 개인정보 라벨과 실제가 다름 | 사진은 저장하지 않고 중계만 한다는 점을 심사 노트로 설명한다 |
| 카메라 권한 설명이 모호함 | Info.plist 문구를 store/description-ko.md 의 것으로 맞춘다 |

## 6. 낸 뒤 첫 주 (SPEC 17.4)

- [ ] Sentry 크래시 매일 확인
- [ ] Supabase 함수 오류율과 `usage_counters` 확인 (PlantNet 하루 300 넘으면 한도 조정)
- [ ] 종 DB 에 이상한 값이 없는지 주 1회 훑기 (SPEC 10.4)

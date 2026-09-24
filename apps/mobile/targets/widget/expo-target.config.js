/**
 * 홈 화면 위젯 (9-3). 앱이 공유 저장소(App Group)에 넣은 내용을 그린다.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'MulttaeWidget',
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});

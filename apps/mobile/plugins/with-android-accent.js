/**
 * 안드로이드 시스템 창(확인 창의 단추, 시각 고르기, 글자 커서)이 쓰는 강조색을 앱 토큰에 맞춘다 (9-4).
 * 정하지 않으면 AppCompat 기본값인 청록색이 나온다. 값은 app.json 에 적은 src/ui/tokens.ts 의 accent 이고
 * src/ui/native-colors.test.ts 가 토큰과 같은지 본다.
 */
const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
} = require('expo/config-plugins');

const NAME = 'colorAccent';

module.exports = function withAndroidAccent(config, { light, dark }) {
  config = withAndroidColors(config, (colors) => {
    colors.modResults = AndroidConfig.Colors.assignColorValue(colors.modResults, { name: NAME, value: light });
    return colors;
  });
  config = withAndroidColorsNight(config, (colors) => {
    colors.modResults = AndroidConfig.Colors.assignColorValue(colors.modResults, { name: NAME, value: dark });
    return colors;
  });
  return withAndroidStyles(config, (styles) => {
    styles.modResults = AndroidConfig.Styles.assignStylesValue(styles.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: NAME,
      value: `@color/${NAME}`,
    });
    return styles;
  });
};

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // drizzle 마이그레이션(.sql)을 문자열로 인라인한다.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};

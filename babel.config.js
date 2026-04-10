module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ─── Required: transforms `'worklet'` directives so functions can run
      //     on the background worklet runtime (react-native-worklets 0.5.x)
      ['react-native-worklets/plugin', {}, 'react-native-worklets'],

      // ─── Reanimated must ALWAYS be last ───────────────────────
      ['react-native-reanimated/plugin', {}, 'react-native-reanimated'],
    ],
  };
};

module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Tamagui babel plugin disabled for now - using runtime mode
      // Enable when building for production with: npm install react-dom
      // [
      //   '@tamagui/babel-plugin',
      //   {
      //     components: ['tamagui'],
      //     config: './src/config/tamagui.config.ts',
      //     logTimings: true,
      //     disableExtraction: process.env.NODE_ENV === 'development',
      //   },
      // ],
      'react-native-reanimated/plugin',
    ],
  }
}

module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@navigation': './src/navigation',
          '@lib': './src/lib',
          '@theme': './src/theme',
          '@hooks': './src/hooks',
          '@types': './src/types',
          '@contexts': './src/contexts',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};

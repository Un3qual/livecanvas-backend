module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.ts'],
  testMatch: ['<rootDir>/tests/**/*.rntl.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|@expo-google-fonts/.*|@react-navigation/.*|react-navigation|@sentry/react-native|native-base|react-native-svg))',
  ],
  watchman: false,
};

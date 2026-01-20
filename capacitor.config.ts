import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'digital.calentrip.android',
  appName: 'CalenTrip',
  webDir: 'out',
  loggingBehavior: 'debug',
  server: {
    hostname: 'localhost',
    androidScheme: 'http',
    cleartext: true,
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '301052542782-32u23eimslvmuvdf3l81md3jobajsgjc.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      androidIsEncryption: false,
      androidSecret: 'secret',
      androidBiometric: {
        biometryAuth: false,
        biometryTitle: 'Biometric login',
        biometrySubTitle: 'Log in with biometrics',
      },
    },
    CapacitorHttp: { enabled: false },
    CapacitorCookies: { enabled: false },
  },
} satisfies CapacitorConfig;

export default config;

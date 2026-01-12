import type { CapacitorConfig } from '@capacitor/cli';

const config = {
  appId: 'digital.calentrip.android',
  appName: 'CalenTrip',
  webDir: 'out',
  loggingBehavior: 'debug',
  plugins: {
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
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
} satisfies CapacitorConfig;

export default config;

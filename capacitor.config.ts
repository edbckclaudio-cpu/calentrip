import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.NEXT_PUBLIC_CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'digital.calentrip.android',
  appName: 'CalenTrip',
  webDir: 'out',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
    },
  },
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: !serverUrl.startsWith('https'),
      }
    : undefined,
};

export default config;

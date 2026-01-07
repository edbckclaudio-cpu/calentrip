import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.NEXT_PUBLIC_CAP_SERVER_URL || 'https://calentrip.digital';

const config: CapacitorConfig = {
  appId: 'digital.calentrip.android',
  appName: 'CalenTrip',
  webDir: 'out',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
    },
  },
  server: {
    url: serverUrl,
    cleartext: !serverUrl.startsWith('https'),
    allowNavigation: ['calentrip.digital', 'www.calentrip.digital', 'https://calentrip.digital/api/auth/*'],
  },
};

export default config;

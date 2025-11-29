import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.NEXT_PUBLIC_CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'digital.calentrip',
  appName: 'CalenTrip',
  webDir: 'out',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: !serverUrl.startsWith('https'),
      }
    : undefined,
};

export default config;

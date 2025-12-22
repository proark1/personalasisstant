import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.darai.app',
  appName: 'DarAI',
  webDir: 'dist',
  server: {
    url: 'https://d44ace30-8829-4d84-9769-44f09f4b4e36.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;

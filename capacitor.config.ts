import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.annadata.app',
  appName: 'annadata-fe',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  },
  android: {
    loggingBehavior: 'none' // Disable native bridge logging
  },
  ios: {
    loggingBehavior: 'none' // Disable native bridge logging
  }
};

export default config;

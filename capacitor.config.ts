import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.annadata.app',
  appName: 'annadata-fe',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#666666",
      splashFullScreen: true,
      splashImmersive: true
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

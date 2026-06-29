import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zexbox.app',
  appName: 'Zex Box',
  webDir: 'dist',
  // For the APK, we load the Vercel-hosted site in a webview
  // This way the app works perfectly with all server-side API routes
  server: {
    url: 'https://zexbox.vercel.app',
    cleartext: true,
  },
  android: {
    // Allow mixed content (some MovieBox images are HTTP)
    allowMixedContent: true,
    // Capture background taps
    captureInput: true,
    // Use native WebView debugging in dev
    webContentsDebuggingEnabled: true,
  },
  // Fullscreen app (no status bar)
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0d0d0f',
      showSpinner: false,
    },
  },
};

export default config;

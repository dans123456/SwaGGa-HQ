import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Unique identifier for the Android app (reverse domain format)
  appId: 'com.swaggahq.app',

  // Display name shown in the launcher and app store
  appName: 'SwaGGa HQ',

  // The folder containing index.html — copied here before each sync
  webDir: 'dist',

  // Server settings
  server: {
    url: 'https://dans123456.github.io/SwaGGa-HQ/',
    // Allow the native app to load resources and use redirects
    allowNavigation: [
      'dans123456.github.io',
      'swagga-hq.web.app',
      'swagga-hq.firebaseapp.com',
      '*.googleapis.com',
      '*.gstatic.com',
      '*.youtube.com',
      '*.youtube-nocookie.com',
      '*.googlevideo.com',
      'open.spotify.com',
    ],
    // Keep Android cleartext HTTP blocked for security
    androidScheme: 'https',
  },

  // Android-specific settings
  android: {
    // Match SwaGGa HQ dark theme
    backgroundColor: '#0d0b0f',
    // Allow mixed content for TradingView widget iframes
    allowMixedContent: false,
    // Override back button behavior — navigate back within the app
    handleApplicationNotifications: true,
    // Build type
    buildOptions: {
      keystorePath: undefined, // Set this when you have your release keystore
      keystoreAlias: undefined,
    },
  },

  // Plugin configurations
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    SplashScreen: {
      // Show splash for 2 seconds then fade out
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#0d0b0f',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0d0b0f',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#00d4ff',
      sound: 'default',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;

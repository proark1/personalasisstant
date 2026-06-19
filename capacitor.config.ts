import type { CapacitorConfig } from "@capacitor/cli";

// IMPORTANT:
// - For TestFlight / production builds, do NOT set `server.url`.
//   Otherwise the app loads a remote website inside the native WebView, which can cause
//   auth popups and (if cached/stale) a white screen.
// - For local development hot-reload, set env var CAPACITOR_SERVER_URL.
const devServerUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.darai.app",
  appName: "DarAI",
  webDir: "dist",
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: true,
    preferredContentMode: "mobile",
    // HealthKit usage descriptions - ensures they're always in Info.plist
    infoPlist: {
      NSHealthShareUsageDescription:
        "DarAI needs access to your health data to display your steps, heart rate, sleep, and other wellness metrics in the Health Hub.",
      NSHealthUpdateUsageDescription:
        "DarAI needs to save health data to help you track your wellness metrics.",
    },
  },
  plugins: {
    Microphone: {
      NSMicrophoneUsageDescription:
        "DarAI needs microphone access for voice commands and voice mode.",
    },
    Geolocation: {
      NSLocationWhenInUseUsageDescription:
        "DarAI uses your location for local news, weather, and location-based reminders.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "DarAI needs continuous location access to remind you when you arrive at or leave specific places.",
      NSLocationAlwaysUsageDescription:
        "DarAI needs background location access to remind you when you arrive at or leave specific places.",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#6366f1",
      sound: "default",
    },
    // HealthKit configuration - enables Apple Health integration
    HealthKit: {
      // This usage description appears in the Health permission prompt
      NSHealthShareUsageDescription:
        "DarAI needs access to your health data to display your steps, heart rate, sleep, and other wellness metrics in the Health Hub.",
    },
  },
  ...(devServerUrl
    ? {
        server: {
          url: devServerUrl,
          cleartext: true,
        },
      }
    : {}),
};

export default config;

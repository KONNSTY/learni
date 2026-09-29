import type { ExpoConfig } from "expo/config";

// Google-Test-App-IDs (oeffentlich dokumentiert). Echte IDs per Env setzen (siehe docs/SETUP_ANLEITUNG.md).
const ADMOB_IOS_TEST = "ca-app-pub-3940256099942544~1458002511";
const ADMOB_ANDROID_TEST = "ca-app-pub-3940256099942544~3347511713";

const config: ExpoConfig = {
  name: "Learni",
  slug: "learni",
  scheme: "learni",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? "app.learni.mobile", // [ANNAHME] vor dem Release durch eigene ID ersetzen
    usesAppleSignIn: true,
    infoPlist: {
      NSMicrophoneUsageDescription: "Learni nutzt das Mikrofon, damit du mit deinem Sprachtutor sprechen kannst. Audio wird nicht gespeichert.",
      NSUserTrackingUsageDescription: "Damit wir dir passendere Werbung zeigen können. Du kannst ablehnen, die App funktioniert genauso.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? "app.learni.mobile",
    permissions: ["RECORD_AUDIO"],
    adaptiveIcon: { backgroundColor: "#F7F5EF", foregroundImage: "./assets/android-icon-foreground.png", backgroundImage: "./assets/android-icon-background.png", monochromeImage: "./assets/android-icon-monochrome.png" },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    ["expo-splash-screen", { image: "./assets/splash-icon.png", resizeMode: "contain", backgroundColor: "#F7F5EF", dark: { backgroundColor: "#12151C" } }],
    "expo-secure-store",
    "expo-localization",
    "expo-apple-authentication",
    ["expo-audio", { microphonePermission: "Learni nutzt das Mikrofon, damit du mit deinem Sprachtutor sprechen kannst. Audio wird nicht gespeichert." }],
    ["expo-tracking-transparency", { userTrackingPermission: "Damit wir dir passendere Werbung zeigen können. Du kannst ablehnen, die App funktioniert genauso." }],
    ["react-native-google-mobile-ads", { iosAppId: process.env.ADMOB_IOS_APP_ID ?? ADMOB_IOS_TEST, androidAppId: process.env.ADMOB_ANDROID_APP_ID ?? ADMOB_ANDROID_TEST, userTrackingUsageDescription: "Damit wir dir passendere Werbung zeigen können. Du kannst ablehnen, die App funktioniert genauso." }],
    "expo-dev-client",
  ],
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID } },
};
export default config;

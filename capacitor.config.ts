import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.formbhro.app",
  appName: "Formbhro",
  webDir: "dist",
  server: {
    url: "https://formbhro-oa2i.vercel.app",
    allowNavigation: [
      "*.supabase.co",
      "*.supabase.io",
      "*.lovable.app",
      "formbhro-oa2i.vercel.app",
      "*.vercel.app",
      "oauth.lovable.app",
      "accounts.google.com",
      "*.google.com",
    ],
  },
  appendUserAgent: "CapacitorFormbhro",
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email"],
      // serverClientId: the WEB application OAuth client ID from Google Console.
      // Used by Supabase to validate the idToken via signInWithIdToken.
      serverClientId: "968890483464-hc7metveqh08o27mur4kbjp44j1aii9v.apps.googleusercontent.com",
      // Web client ID must also be passed to clientId and androidClientId for token retrieval
      clientId: "968890483464-hc7metveqh08o27mur4kbjp44j1aii9v.apps.googleusercontent.com",
      androidClientId: "968890483464-hc7metveqh08o27mur4kbjp44j1aii9v.apps.googleusercontent.com",
      // forceCodeForRefreshToken must be true to receive a valid idToken on Android
      forceCodeForRefreshToken: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 1500, // Show a bit longer so it doesn't flash
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "FIT_CENTER",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;

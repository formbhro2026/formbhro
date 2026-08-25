import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.formbhro.app",
  appName: "Formbhro",
  webDir: "dist",
  server: {
    url: "https://formbhro.lovable.app",
    allowNavigation: [
      "*.supabase.co",
      "*.supabase.io",
      "*.lovable.app",
      "formbhro.lovable.app",
      "formbhro.vercel.app",
      "oauth.lovable.app",
      "accounts.google.com",
      "*.google.com"
    ],
  },
  appendUserAgent: "CapacitorFormbhro",
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email"],
      // serverClientId: the WEB application OAuth client ID from Google Console.
      // Used by Supabase to validate the idToken via signInWithIdToken.
      serverClientId: "417401975573-d2j8qkksdc4acmt2tjgvtk3rj537tfo1.apps.googleusercontent.com",
      // clientId + androidClientId: the ANDROID OAuth client ID registered with the app's SHA-1.
      // This is different from the web client ID above.
      clientId: "417401975573-irshrg7cbkghgc0mv5l1959nl28uu6e6.apps.googleusercontent.com",
      androidClientId: "417401975573-irshrg7cbkghgc0mv5l1959nl28uu6e6.apps.googleusercontent.com",
      // forceCodeForRefreshToken must be true to receive a valid idToken on Android
      forceCodeForRefreshToken: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: "#050505",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;

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
      serverClientId: "111790521008-kdr78o80m6h10voviku4r6uq9iq9nj2v.apps.googleusercontent.com",
      // clientId + androidClientId: the ANDROID OAuth client ID registered with the app's SHA-1.
      // This is different from the web client ID above.
      clientId: "111790521008-5p9iv2598bl00nr9fdchq9he04ee6oac.apps.googleusercontent.com",
      androidClientId: "111790521008-5p9iv2598bl00nr9fdchq9he04ee6oac.apps.googleusercontent.com",
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

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    ssr: false,
  },
  vite: {
    // Exclude Capacitor CLI from Vite's bundler (it's a CLI tool, not a browser module)
    optimizeDeps: {
      exclude: ["@capacitor/cli"],
    },
    build: { sourcemap: true },
    plugins: [
      VitePWA({
        // Use 'prompt' instead of 'autoUpdate' so the service worker does not
        // intercept notifications — native FCM handles push on Android.
        registerType: "prompt",
        devOptions: {
          enabled: false, // Disable SW in dev to avoid conflicts with Capacitor
        },
        manifest: {
          name: "Formbhro",
          short_name: "Formbhro",
          description: "Real-Time Form Assistance Platform",
          theme_color: "#050505",
          background_color: "#050505",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            {
              // Local icon — place your 192x192 PNG at public/icon-192.png
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              // Local icon — place your 512x512 PNG at public/icon-512.png
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.origin === self.location.origin &&
                !url.pathname.startsWith("/api") &&
                !url.pathname.startsWith("/auth"),
              handler: "NetworkFirst",
              options: {
                cacheName: "pages-cache",
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24, // 1 day
                },
              },
            },
          ],
        },
      }),
    ],
  },
});

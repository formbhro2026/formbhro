import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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
    build: {
      sourcemap: true,
      minify: "terser",
    },
    plugins: [],
  },
});

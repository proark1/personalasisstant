/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
// ANALYZE=1 bun run build → also emits dist/stats.html with treemap.
const enableVisualizer = process.env.ANALYZE === "1";

const manualChunkGroups: Record<string, string[]> = {
  // Core React ecosystem
  "vendor-react": ["react", "react-dom", "react-router-dom"],
  // UI framework
  "vendor-radix": [
    "@radix-ui/react-accordion",
    "@radix-ui/react-alert-dialog",
    "@radix-ui/react-avatar",
    "@radix-ui/react-checkbox",
    "@radix-ui/react-collapsible",
    "@radix-ui/react-context-menu",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-hover-card",
    "@radix-ui/react-label",
    "@radix-ui/react-menubar",
    "@radix-ui/react-navigation-menu",
    "@radix-ui/react-popover",
    "@radix-ui/react-progress",
    "@radix-ui/react-radio-group",
    "@radix-ui/react-scroll-area",
    "@radix-ui/react-select",
    "@radix-ui/react-separator",
    "@radix-ui/react-slider",
    "@radix-ui/react-slot",
    "@radix-ui/react-switch",
    "@radix-ui/react-tabs",
    "@radix-ui/react-toast",
    "@radix-ui/react-toggle",
    "@radix-ui/react-toggle-group",
    "@radix-ui/react-tooltip",
  ],
  // Charts (recharts) is intentionally NOT pinned to a vendor chunk:
  // it's only used by lazy panels, so leaving it to Rollup lets it split
  // into an on-demand async chunk instead of being modulepreloaded on
  // first paint (~400 KB / ~110 KB gz saved on initial load).
  // Animation
  "vendor-animation": ["framer-motion"],
  // Date utilities
  "vendor-date": ["date-fns"],
  // Drag and drop
  "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
  // Data fetching
  "vendor-query": ["@tanstack/react-query"],
  // Supabase
  "vendor-supabase": ["@supabase/supabase-js"],
  // Form handling
  "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
};

const manualChunkEntries = Object.entries(manualChunkGroups).flatMap(([chunk, packages]) =>
  packages.map((pkg) => [pkg, chunk] as const),
);

function manualChunks(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/");
  const marker = "/node_modules/";
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) return undefined;

  const modulePath = normalized.slice(idx + marker.length);
  for (const [pkg, chunk] of manualChunkEntries) {
    if (modulePath === pkg || modulePath.startsWith(`${pkg}/`)) return chunk;
  }

  return undefined;
}

export default defineConfig(() => ({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    // Placeholder Supabase config so modules that eagerly construct the
    // client at import time (e.g. lib/telemetry.ts) don't throw
    // "supabaseUrl is required" under vitest. Mirrors the CI build env.
    env: {
      VITE_SUPABASE_URL: "https://placeholder.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "placeholder-anon-key",
    },
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: ["log", "info", "debug"],
        pure_funcs: ["console.log", "console.info", "console.debug"],
      },
    },
    rollupOptions: {
      // Strip dev-only logging from production bundles. Vite 8 uses Oxc by
      // default, so top-level esbuild pure/drop settings are ignored. Terser
      // catches calls that survive Rollup tree-shaking.
      treeshake: {
        manualPureFunctions: ["console.log", "console.info", "console.debug"],
      },
      output: {
        manualChunks,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt"],
      manifest: false, // We use public/manifest.json
      workbox: {
        // Take over open tabs as soon as a new SW activates instead of
        // waiting until every tab is closed. Without these, deploys
        // could leave users pinned to an old precached bundle for
        // days — which is how the realtime-channel bug after #6/#7
        // stayed visible to refreshed clients.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB limit
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // No runtime caching of third-party origins. The Arabic/Quran fonts are
        // self-hosted under public/fonts/ and picked up by the precache globs
        // above (css + woff2), so there is no Google Fonts CDN to cache.
      },
    }),
    enableVisualizer &&
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

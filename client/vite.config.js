import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}'],
        // --- NEW: Cache API responses for offline usage ---
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/api'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-data',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 // 1 day
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }]
      },
      devOptions: {
        enabled: true 
      },
      manifest: {
        name: 'Money Tracker',
        short_name: 'Money',
        description: 'Personal Finance Dashboard',
        theme_color: '#1976D2',
        background_color: '#F2F5F8',
        display: 'standalone',
        // --- NEW: Allow rotation ---
        orientation: 'any',
        icons: [
          {
            src: 'logo.svg',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/svg+xml'
          },
          {
            src: 'logo.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        // --- NEW: App Shortcuts (Long press icon) ---
        shortcuts: [
          {
            name: "Open Budget",
            short_name: "Budget",
            description: "Go directly to budget",
            url: "/?tab=budget",
            icons: [{ src: "logo.svg", sizes: "192x192" }]
          },
          {
            name: "Quick Add",
            short_name: "Add",
            description: "Add new expense",
            url: "/?tab=budget&action=add",
            icons: [{ src: "logo.svg", sizes: "192x192" }]
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
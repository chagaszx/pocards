import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Inclui o .wasm do leitor do Anki, para importar mesmo offline
        // .json inclui os baralhos prontos da aba Explorar
        // woff2 = fontes das fórmulas (KaTeX)
        globPatterns: ['**/*.{js,css,html,svg,png,webp,wasm,json,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Guarda a fonte Geist no aparelho para o app continuar bonito offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fotos dos elementos (Wikimedia Commons): depois de vistas uma vez, funcionam offline
            urlPattern: /^https:\/\/(upload\.wikimedia\.org|images-of-elements\.com)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-photos',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Pocards',
        short_name: 'Pocards',
        description: 'Flashcards gratuitos com repetição espaçada.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f0f11',
        theme_color: '#0f0f11',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})

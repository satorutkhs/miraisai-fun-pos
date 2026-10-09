import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  test: { environment: 'node' },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'img/*.jpg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,jpg}'], navigateFallback: 'index.html' },
      manifest: {
        name: 'FUN ROBO LAB レジ',
        short_name: 'FUN POS',
        lang: 'ja',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#fdf3e3',
        theme_color: '#2b1a10',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});

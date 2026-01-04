import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    base: './',
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['models/*'],
            manifest: {
                name: 'VibeScan AI',
                short_name: 'VibeScan',
                description: 'Offline AI Vibe Detector',
                theme_color: '#050505',
                background_color: '#050505',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: 'logo.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json,shard1}'],
                maximumFileSizeToCacheInBytes: 10 * 1024 * 1024 // Increase limit for models
            }
        })
    ],
    server: {
        host: true
    }
})

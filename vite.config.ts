import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Ensure proper path resolution
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Ensure public directory is copied
  publicDir: 'public',
  // Development server configuration
  server: {
    proxy: {
      // Proxy API calls to prevent 404 in development
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error - API endpoint not available. Run: npm run dev:with-functions');
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Proxying:', req.method, req.url);
          });
        },
      },
    },
  },
})


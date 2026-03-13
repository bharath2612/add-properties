import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
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
  resolve: {
    alias: {
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      process: 'process/browser',
    },
  },
  define: {
    global: 'globalThis',
    'process.env': '{}',
    'process.browser': 'true',
  },
  optimizeDeps: {
    include: ['buffer', 'process'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  // Ensure public directory is copied
  publicDir: 'public',
  // Development server configuration
  server: {
    proxy: {
      // Supabase proxy: rewrite /api/sp/* → Supabase with service_role key
      '/api/sp': {
        target: env.VITE_SUPABASE_URL || 'https://svapyzcfldheymahioor.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sp/, ''),
        headers: {
          apikey: env.VITE_SUPABASE_SERVICE || env.SUPABASE_SERVICE_ROLE_KEY || '',
          Authorization: `Bearer ${env.VITE_SUPABASE_SERVICE || env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
        },
      },
      // Other API calls (R2 upload, etc.) → wrangler pages dev
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error - API endpoint not available. Run: npm run dev:with-functions');
          });
        },
      },
    },
  },
};
})


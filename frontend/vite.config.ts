import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react';
          if (id.includes('/node_modules/@supabase/')) return 'supabase';
          if (id.includes('/node_modules/framer-motion/') || id.includes('/node_modules/animejs/')) return 'motion';
        },
      },
    },
  },
})

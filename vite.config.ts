import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const config = defineConfig({
  server: {
    port: parseInt(process.env.VITE_PORT || '5990'),
  },
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      customViteReactPlugin: true,
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@/ui': resolve(__dirname, './src/taali/components/ui'),
      '@/taali': resolve(__dirname, './src/taali'),
      '@': resolve(__dirname, './src')
    }
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['@tanstack/router-core']
  },
  ssr: {
    noExternal: ['@tanstack/router-core'],
  },
  build: {
    rollupOptions: {
      external: ['node:stream', 'stream'],
    }
  }
})

export default config

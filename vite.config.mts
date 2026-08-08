import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react({})],
  publicDir: 'apps/scene-prototype/public',
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  server: {
    port: 3004,
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei', 'zustand'],
  },
  optimizeDeps: {
    exclude: ['polygon-editor'],
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom/client',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'zustand',
      'zustand/vanilla',
    ],
  },
  build: {
    outDir: 'demo-dist',
  },
});

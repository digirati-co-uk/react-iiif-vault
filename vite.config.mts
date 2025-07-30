import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react({})],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  server: {
    port: 3004,
  },
  optimizeDeps: {
    exclude: ['polygon-editor'],
  },
});

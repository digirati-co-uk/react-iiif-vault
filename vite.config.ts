import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // jsxRuntime: 'classic',
    }),
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  server: {
    port: 3004,
  },
});

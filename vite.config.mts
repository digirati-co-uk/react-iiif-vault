import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react({})],
  test: {
    environment: 'happy-dom',
    globals: true,
    exclude: [...configDefaults.exclude, 'stories/**'],
  },
  server: {
    port: 3004,
  },
  optimizeDeps: {
    exclude: ['polygon-editor'],
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        fullpage: 'full-page.html',
      },
    },
  },
});

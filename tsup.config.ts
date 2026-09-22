import { defineConfig, type Options } from 'tsup';

export default defineConfig((options: Options) => ({
  clean: true,
  dts: true,
  target: ['es2020'],
  format: ['esm', 'cjs'],
  platform: 'browser',
  entry: {
    index: 'src/index.ts',
    core: 'src/core.ts',
    'canvas-panel/scene': 'src/canvas-panel/scene/index.ts',
    'canvas-panel': 'src/canvas-panel/index.tsx',
    utils: 'src/utils.ts',
    'presentation-4': 'src/presentation-4.tsx',
  },
  splitting: true,
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-reconciler'],
  minify: true,
  ...options,
}));

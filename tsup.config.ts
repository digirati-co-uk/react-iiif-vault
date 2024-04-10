import { defineConfig, type Options } from 'tsup';

export default defineConfig((options: Options) => ({
  clean: true,
  dts: true,
  target: ['es2020'],
  format: ['esm', 'cjs'],
  platform: 'browser',
  entry: {
    index: 'src/index.ts',
    'canvas-panel': 'src/canvas-panel/index.tsx',
    utils: 'src/utils.ts',
  },
  minify: true,
  ...options,
}));

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
    'scene-panel': 'src/scene-panel/index.ts',
    utils: 'src/utils.ts',
  },
  external: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
  minify: true,
  ...options,
}));

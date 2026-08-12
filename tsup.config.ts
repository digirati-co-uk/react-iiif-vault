import { defineConfig, type Options } from 'tsup';

export default defineConfig((options: Options) => ({
  clean: true,
  dts: true,
  target: ['es2020'],
  format: ['esm', 'cjs'],
  platform: 'browser',
  entry: {
    index: 'src/index.ts',
    helpers: 'src/helpers.ts',
    'presentation-4': 'src/presentation-4.tsx',
    'presentation-4/helpers': 'src/presentation-4-helpers.ts',
    'canvas-panel': 'src/canvas-panel/index.tsx',
    'scene-panel': 'src/scene-panel/index.ts',
    waveform: 'src/waveform/index.ts',
    utils: 'src/utils.ts',
  },
  external: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei', 'wavesurfer.js'],
  minify: true,
  ...options,
}));

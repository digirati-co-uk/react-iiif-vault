import { defineConfig, type Options } from 'tsup';
// @ts-expect-error
import GlobalsPlugin from 'esbuild-plugin-globals';
import { umdWrapper } from 'esbuild-plugin-umd-wrapper';

export default defineConfig((options: Options) => ({
  dts: true,
  target: ['es2020'],
  format: ['iife'],
  platform: 'browser',
  entry: {
    bundle: 'src/index.ts',
  },
  minify: true,
  external: [],
  globalName: 'ReactIIIFVault',
  esbuildPlugins: [
    GlobalsPlugin({
      react: 'React',
      'react-dom': 'ReactDOM',
    }),
    umdWrapper({
      libraryName: 'ReactIIIFVault',
    }),
  ],
  ...options,
}));

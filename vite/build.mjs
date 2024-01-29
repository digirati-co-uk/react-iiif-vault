import { defaultExternal, defineConfig, buildMsg } from './base-config.mjs';
import { build } from 'vite';

(async () => {
  // Main UMD build.
  buildMsg('UMD');
  await build(
    defineConfig({
      entry: `src/index.ts`,
      name: 'index',
      outDir: 'dist',
      globalName: 'ReactIIIFVault',
      external: ['react', 'react-dom', '@iiif/helpers/vault', '@atlas-viewer/iiif-image-api'],
      react: true,
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM',
        '@iiif/helpers/vault': 'IIIFVault',
        '@atlas-viewer/iiif-image-api': 'IIIFImageApi',
      },
    })
  );

  buildMsg('Libraries');
  await build(
    defineConfig({
      entry: `src/index.ts`,
      name: 'index',
      outDir: 'dist/bundle',
      external: [...defaultExternal],
      react: true,
      react18: true,
    })
  );

  buildMsg('Libraries (React 16/17)');
  await build(
    defineConfig({
      entry: `src/index.ts`,
      name: 'index',
      outDir: 'dist/react17',
      external: [...defaultExternal],
      react: true,
      react18: false,
    })
  );

  // React library special case
  buildMsg('canvas-panel');
  await build(
    defineConfig({
      entry: `src/canvas-panel/index.tsx`,
      name: 'canvas-panel',
      external: [...defaultExternal],
      react: true,
      react18: true,
    })
  );

  // React library special case
  buildMsg('utils');
  await build(
    defineConfig({
      entry: `src/utils.ts`,
      name: 'utils',
      external: [...defaultExternal],
    })
  );

  console.log('');
})();

import { defaultExternal, defineConfig } from './base-config.mjs';
import { build } from 'vite';
import chalk from 'chalk';

(async () => {
  // Main UMD build.
  buildMsg('UMD');
  await build(
    defineConfig({
      entry: `src/index.ts`,
      name: 'index',
      outDir: 'dist',
      globalName: 'ReactIIIFVault',
      external: ['react', 'react-dom', '@iiif/vault', '@atlas-viewer/iiif-image-api'],
      react: true,
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM',
        '@iiif/vault': 'IIIFVault',
        '@atlas-viewer/iiif-image-api': 'IIIFImageApi',
      }
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
    })
  );
  // React library special case
  buildMsg('canvas-panel');
  await build(
    defineConfig({
      entry: `src/canvas-panel/index.ts`,
      name: 'canvas-panel',
      external: [...defaultExternal],
      react: true,
    })
  );

  console.log('')


  function buildMsg(name) {
    console.log(chalk.grey(`\n\nBuilding ${chalk.blue(name)}\n`));
  }
})();

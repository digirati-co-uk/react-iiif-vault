import react from '@vitejs/plugin-react';
import chalk from 'chalk';

export const defaultExternal = [
  '@iiif/helpers',
  // Need sub-packages too.
  '@iiif/helpers/styles',
  '@iiif/helpers/annotation-targets',
  '@iiif/helpers/thumbnail',
  '@iiif/helpers/vault',
  '@iiif/helpers/vault/store',
  '@iiif/parser',
  'typesafe-actions',
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@atlas-viewer/atlas',
  '@atlas-viewer/iiif-image-api',
];

/**
 * @param options {{ external: string[]; entry: string; name: string; globalName: string; outDir?: string; react?: boolean; globals: Record<string, string>; react18?: boolean; watch?: boolean }}
 */
export function defineConfig(options) {
  return {
    build: {
      sourcemap: true,
      outDir: options.outDir || `dist/${options.name}`,
      lib: {
        entry: options.entry,
        name: options.globalName,
        formats: options.globalName ? ['umd'] : ['es', 'cjs'],
        fileName: (format) => {
          if (format === 'umd') {
            return `index.umd.js`;
          }
          if (format === 'es') {
            return `esm/${options.name}.mjs`;
          }
          return `${format}/${options.name}.js`;
        },
      },
      watch: options.watch,
      plugins: [
        options.react
          ? options.react18
            ? react({ jsxRuntime: 'automatic', jsxPure: true })
            : react({ jsxRuntime: 'classic', jsxPure: true })
          : false,
      ].filter(Boolean),
      rollupOptions: {
        treeshake: true,
        external: options.react18 ? [...options.external, 'react-dom/client'] : options.external,
        output: {
          globals: options.globals,
          inlineDynamicImports: !!options.globalName,
        },
      },
    },
  };
}

export function buildMsg(name) {
  console.log(chalk.grey(`\n\nBuilding ${chalk.blue(name)}\n`));
}

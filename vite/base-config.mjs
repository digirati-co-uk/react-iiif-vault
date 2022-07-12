import react from '@vitejs/plugin-react';

export const defaultExternal = [
  '@iiif/vault',
  '@iiif/vault-helpers',
  '@iiif/parser',
  'redux',
  'typesafe-actions',
  'react',
  'react-dom',
  'react-use',
  'react-use-measure',
  '@atlas-viewer/atlas',
  '@atlas-viewer/iiif-image-api',
];

/**
 * @param options {{ external: string[]; entry: string; name: string; globalName: string; outDir?: string; react?: boolean; globals: Record<string, string> }}
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
      plugins: [
        options.react ? react({}) : false,
      ].filter(Boolean),
      rollupOptions: {
        treeshake: true,
        external: options.external,
        output: {
          globals: options.globals,
          inlineDynamicImports: !!options.globalName,
        },
      },
    },
  };
}

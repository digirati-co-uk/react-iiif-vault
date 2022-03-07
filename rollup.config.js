import { createRollupConfig, createTypeConfig } from 'rollup-library-template';
import replace from '@rollup/plugin-replace';

const baseConfig = {
  filesize: true,
  minify: true,
  extra: {
    treeshake: true,
  },
  esbuildOptions: {
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
  postProcess: (config) => {
    config.plugins = [
      replace({
        values: {
          'process.env.NODE_ENV': '"production"',
        },
        preventAssignment: false,
      }),
      ...config.plugins,
    ];

    return config;
  },
};

const external = [
  '@iiif/vault',
  '@iiif/vault-helpers',
  '@iiif/parser',
  'redux',
  'typesafe-actions',
  'react',
  'react-dom',
  'react-use',
  '@atlas-viewer/iiif-image-api',
];
const bundled = [];
const nodeExternal = ['node-fetch'];
const nodeCjsExternal = [
  'node:https',
  'node:buffer',
  'node:stream',
  'node:zlib',
  'node:http',
  'node:util',
  'node:url',
  'node:net',
  'node:path',
  'node:fs',
  'node:worker_threads',
];

// Roll up configs
export default [
  createTypeConfig({
    source: './.build/types/index.d.ts',
  }),

  // UMD bundle will have everything.
  createRollupConfig({
    ...baseConfig,
    inlineDynamicImports: true,
    input: './src/index.ts',
    output: {
      name: 'ReactIIIFVault',
      file: `dist/index.umd.js`,
      format: 'umd',
      globals: {
        react: 'React',
        '@iiif/vault': 'IIIFVault',
      },
    },
    external: ['react', 'react-dom', '@iiif/vault'],
    nodeResolve: {
      browser: true,
    },
    extra: {
      globals: {
        react: 'React',
      },
    },
  }),

  // import {} from '@iiif/vault';
  createRollupConfig({
    ...baseConfig,
    input: './src/index.ts',
    distPreset: 'esm',
    external,
  }),
  createRollupConfig({
    ...baseConfig,
    input: './src/index.ts',
    distPreset: 'cjs',
    external,
  }),
];

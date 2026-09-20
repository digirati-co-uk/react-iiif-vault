import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(resolve(tmpdir(), 'vault-compat-package-'));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
console.log(`Package consumers: ${temporary}`);
const archive = resolve(temporary, 'react-iiif-vault.tgz');
run('pnpm', ['pack', '--out', archive]);
for (const [react, reconciler, atlas] of [['19.2.0', '0.33.0', '3.2.1']]) {
  const consumer = resolve(temporary, `react-${react}`);
  run('mkdir', ['-p', consumer]);
  writeFileSync(resolve(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(
    'npm',
    [
      'install',
      '--legacy-peer-deps',
      '--no-audit',
      '--no-fund',
      archive,
      `react@${react}`,
      `react-dom@${react}`,
      `react-reconciler@${reconciler}`,
      `@atlas-viewer/atlas@${atlas}`,
      'typescript@5.4.5',
      '@types/react@18.2.75',
      '@types/react-dom@18.2.24',
      'vitest@1.6.0',
      'happy-dom@14.7.1',
      '@testing-library/react@15.0.2',
    ],
    consumer
  );
  const installed = resolve(consumer, 'node_modules/react-iiif-vault');
  const pkg = JSON.parse(readFileSync(resolve(installed, 'package.json'), 'utf8'));
  const dependencies = JSON.stringify(pkg.dependencies);
  for (const dependency of ['three', '@react-three/fiber', '@react-three/drei', 'wavesurfer.js']) {
    assert(!existsSync(resolve(consumer, 'node_modules', dependency)), `Unexpected dependency: ${dependency}`);
  }
  assert(!/link:|file:|\/Users\/|three|fiber|drei|wavesurfer/.test(dependencies));
  for (const [subpath, entry] of Object.entries(pkg.exports)) {
    const name = subpath === '.' ? pkg.name : pkg.name + subpath.slice(1);
    for (const [format, paths] of Object.entries(entry)) {
      for (const path of Object.values(paths)) assert(existsSync(resolve(installed, path)), path);
      run(
        process.execPath,
        format === 'import' ? ['--input-type=module', '-e', `await import('${name}')`] : ['-e', `require('${name}')`],
        consumer
      );
    }
  }
  const legacyExports = JSON.parse(readFileSync(resolve(root, '__tests__/fixtures/legacy-public-exports.json'), 'utf8'));
  for (const [entry, names] of Object.entries(legacyExports)) {
    const specifier = 'react-iiif-vault' + (entry === 'root' ? '' : entry === 'canvasPanel' ? '/canvas-panel' : '/utils');
    for (const format of ['import', 'require']) {
      const getModule = format === 'import' ? `await import('${specifier}')` : `require('${specifier}')`;
      const check = `const entry = ${getModule}; for (const name of ${JSON.stringify(names)}) { if (!(name in entry)) throw new Error('Missing legacy export: ' + name); }`;
      run(process.execPath, format === 'import' ? ['--input-type=module', '-e', check] : ['-e', check], consumer);
    }
  }
  const source = readdirSync(resolve(installed, 'dist'))
    .filter((f) => /\.(js|cjs)$/.test(f))
    .map((f) => readFileSync(resolve(installed, 'dist', f), 'utf8'))
    .join('\n');
  assert(!source.includes('react.production.min.js'), 'React implementation bundled');
  assert(!source.includes('react.development.js'), 'React implementation bundled');
  assert(!source.includes('react-reconciler.production'), 'Reconciler implementation bundled');
  assert(
    !source.includes('__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE'),
    'React 19 implementation bundled'
  );
  writeFileSync(
    resolve(consumer, 'types.ts'),
    `
import { Vault as Vault3, useManifest, useCanvas, useExternalCollection, useExistingVault, useCanvasSequence, createVaultHooks, CanvasPanel, ImageService, ResourceProvider } from 'react-iiif-vault';
import { Vault as Vault4, useManifest as useManifest4, usePaintingAnnotations, useVirtualAnnotationPage } from 'react-iiif-vault/presentation-4';
import type { ManifestNormalized as M3, CanvasNormalized as C3, CollectionNormalized as Collection3 } from 'react-iiif-vault';
import type { ManifestNormalized as M4, AnnotationNormalized as A4, AnnotationPageNormalized as P4 } from 'react-iiif-vault/presentation-4';
import { CanvasPanel as SubpathPanel } from 'react-iiif-vault/canvas-panel';
import { getRenderingStrategy } from 'react-iiif-vault/utils';
useExistingVault(undefined) satisfies Vault3;
useCanvasSequence({}).items satisfies { id: string; type: 'Canvas' }[];
void [ImageService, ResourceProvider];
useManifest() satisfies M3 | undefined;
useCanvas() satisfies C3 | undefined;
useManifest4() satisfies M4 | undefined;
usePaintingAnnotations() satisfies A4[];
useVirtualAnnotationPage()[0] satisfies P4 | null;
useExternalCollection('collection').manifest satisfies Collection3 | undefined;
createVaultHooks().useVault() satisfies Vault3;
createVaultHooks(3).useVault() satisfies Vault3;
createVaultHooks(4).useVault() satisfies Vault4;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const distinct: Equal<M3, M4> = false;
void [distinct, CanvasPanel, SubpathPanel, getRenderingStrategy];
`
  );
  const legacyTypes = readFileSync(resolve(root, '__tests__/legacy-public-types.ts'), 'utf8')
    .split('import * as root')[0].replaceAll("'../src'", "'react-iiif-vault'");
  writeFileSync(resolve(consumer, 'types.ts'), readFileSync(resolve(consumer, 'types.ts'), 'utf8') + legacyTypes);
  for (const extension of ['mts', 'cts']) {
    cpSync(resolve(consumer, 'types.ts'), resolve(consumer, `types.${extension}`));
    run(
      process.execPath,
      [
        'node_modules/typescript/bin/tsc',
        '--noEmit',
        '--strict',
        '--skipLibCheck',
        '--target',
        'ES2022',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        `types.${extension}`,
      ],
      consumer
    );
  }
  const atlasTest = readFileSync(resolve(root, '__tests__/atlas-compat.test.tsx'), 'utf8')
    .replaceAll("'../src'", "'react-iiif-vault'")
    .replaceAll("'../src/presentation-4'", "'react-iiif-vault/presentation-4'");
  writeFileSync(resolve(consumer, 'atlas.test.tsx'), atlasTest);
  writeFileSync(
    resolve(consumer, 'vitest.config.mjs'),
    `export default { esbuild: { jsx: 'automatic' }, test: { environment: 'happy-dom' } };`
  );
  writeFileSync(
    resolve(consumer, 'entrypoints.test.tsx'),
    `
import React from 'react';
import { createRequire } from 'node:module';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import * as root from 'react-iiif-vault';
import * as p4 from 'react-iiif-vault/presentation-4';
const require = createRequire(import.meta.url);
for (const [name, three, four] of [['ESM', root, p4], ['CJS', require('react-iiif-vault'), require('react-iiif-vault/presentation-4')]]) {
  test(name + ' entries share providers', () => {
    expect(three.ReactVaultContext).toBe(four.ReactVaultContext);
    expect(typeof three.ImageService).toBe('function');
    expect(typeof three.ResourceProvider).toBe('function');
    expect(three.ImageService).toBe(four.ImageService);
    expect(three.ResourceProvider).toBe(four.ResourceProvider);
    const vault = new four.Vault();
    vault.loadSync('https://example.org/manifest', { '@context': 'http://iiif.io/api/presentation/4/context.json', id: 'https://example.org/manifest', type: 'Manifest', label: { en: ['native'] }, items: [] });
    function Probe() { return <span>{four.useManifest()?.label?.en?.[0]}</span>; }
    const view = render(<three.VaultProvider vault={vault} resources={{ manifest: 'https://example.org/manifest' }}><Probe /></three.VaultProvider>);
    expect(view.container.textContent).toBe('native');
    view.unmount();
  });
}
`
  );
  console.log(run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run'], consumer));
  console.log(`React ${react} / reconciler ${reconciler}: imports, declarations, shared contexts, Atlas render passed`);
}

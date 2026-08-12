import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(resolve(tmpdir(), 'riv-scene-package-'));

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
}

try {
  const archive = resolve(temporary, 'react-iiif-vault.tgz');
  run('pnpm', ['pack', '--out', archive]);
  run('tar', ['-xzf', archive], temporary);

  const modules = resolve(temporary, 'node_modules');
  mkdirSync(modules);
  for (const entry of readdirSync(resolve(root, 'node_modules'))) {
    symlinkSync(resolve(root, 'node_modules', entry), resolve(modules, entry));
  }
  const installed = resolve(modules, 'react-iiif-vault');
  renameSync(resolve(temporary, 'package'), installed);
  const packedPackage = JSON.parse(readFileSync(resolve(installed, 'package.json'), 'utf8'));
  if (
    packedPackage.peerDependencies?.react !== '^19.0.0' ||
    packedPackage.peerDependencies?.['react-dom'] !== '^19.0.0'
  ) {
    throw new Error('The packed package must require React and ReactDOM 19 or newer within the React 19 major');
  }

  const entries = [
    ['ESM root', "await import('react-iiif-vault')", true],
    ['ESM helpers', "await import('react-iiif-vault/helpers')", true],
    ['ESM Presentation 4', "await import('react-iiif-vault/presentation-4')", true],
    ['ESM Presentation 4 helpers', "await import('react-iiif-vault/presentation-4/helpers')", true],
    ['ESM CanvasPanel', "await import('react-iiif-vault/canvas-panel')", true],
    ['ESM ScenePanel', "await import('react-iiif-vault/scene-panel')", true],
    ['ESM waveform', "await import('react-iiif-vault/waveform')", true],
    ['CJS root', "require('react-iiif-vault')", false],
    ['CJS helpers', "require('react-iiif-vault/helpers')", false],
    ['CJS Presentation 4', "require('react-iiif-vault/presentation-4')", false],
    ['CJS Presentation 4 helpers', "require('react-iiif-vault/presentation-4/helpers')", false],
    ['CJS CanvasPanel', "require('react-iiif-vault/canvas-panel')", false],
    ['CJS ScenePanel', "require('react-iiif-vault/scene-panel')", false],
    ['CJS waveform', "require('react-iiif-vault/waveform')", false],
  ];
  for (const [label, source, esm] of entries) {
    const result = spawnSync(process.execPath, [...(esm ? ['--input-type=module'] : []), '-e', source], {
      cwd: temporary,
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`${label} failed:\n${result.stderr || result.stdout}`);
  }

  writeFileSync(
    resolve(temporary, 'migration.ts'),
    `import { Vault as Vault3, useExternalCollection as useExternalCollection3, useManifest as useManifest3 } from 'react-iiif-vault';
import type { Collection as Collection3, CollectionNormalized as Collection3Normalized, Manifest as Manifest3, ManifestNormalized as Manifest3Normalized } from 'react-iiif-vault';
import { createPaintingAnnotationsHelper as createPaintingAnnotationsHelper3, createRangeHelper as createRangeHelper3, createThumbnailHelper as createThumbnailHelper3, decodeContentState as decodeContentState3, encodeContentState as encodeContentState3, fetch as fetch3, getAvailableLanguagesFromResource as getAvailableLanguagesFromResource3, getValue as getValue3, imageServiceLoader as imageServiceLoader3, parseSelector as parseSelector3, serialize as serialize3, Traverse as Traverse3, upgrade as upgrade3 } from 'react-iiif-vault/helpers';
import type { ParsedSelector as ParsedSelector3, RangeTableOfContentsNode as RangeTableOfContentsNode3, SupportedSelector as SupportedSelector3, SupportedTarget as SupportedTarget3 } from 'react-iiif-vault/helpers';
import { Vault, useExternalCollection as useExternalCollection4, useManifest as useManifest4 } from 'react-iiif-vault/presentation-4';
import type { Collection as Collection4, CollectionNormalized as Collection4Normalized, Manifest as Manifest4, ManifestNormalized as Manifest4Normalized, Scene } from 'react-iiif-vault/presentation-4';
import { createActivationsHelper, createPaintingAnnotationsHelper as createPaintingAnnotationsHelper4, createRangeHelper as createRangeHelper4, createSceneHelper, createThumbnailHelper as createThumbnailHelper4, decodeContentState as decodeContentState4, encodeContentState as encodeContentState4, fetch as fetch4, fetchPresentation4, getAvailableLanguagesFromResource as getAvailableLanguagesFromResource4, getValue as getValue4, imageServiceLoader as imageServiceLoader4, parseSelector as parseSelector4, serialize as serialize4, Traverse as Traverse4, upgrade as upgrade4 } from 'react-iiif-vault/presentation-4/helpers';
import type { ParsedSelector as ParsedSelector4, RangeTableOfContentsNode as RangeTableOfContentsNode4, SupportedSelector as SupportedSelector4, SupportedTarget as SupportedTarget4 } from 'react-iiif-vault/presentation-4/helpers';

declare const manifest3: Manifest3;
declare const manifest4: Manifest4;

useManifest3() satisfies Manifest3Normalized | undefined;
useManifest4() satisfies Manifest4Normalized | undefined;
useExternalCollection3('https://example.org/collection').collection satisfies Collection3Normalized | undefined;
useExternalCollection4('https://example.org/collection').collection satisfies Collection4Normalized | undefined;
fetch3('https://example.org/manifest') satisfies Promise<Manifest3 | Collection3>;
fetch4('https://example.org/manifest') satisfies Promise<Manifest4 | Collection4>;
fetchPresentation4('https://example.org/manifest') satisfies Promise<Manifest4 | Collection4>;
new Traverse3({ manifest: [(manifest) => manifest] }).traverseManifest(manifest3) satisfies Manifest3;
new Traverse4({ manifest: [(manifest) => manifest] }).traverseManifest(manifest4) satisfies Manifest4;
upgrade3({}) satisfies Manifest3 | Collection3;
upgrade4({}) satisfies Manifest4 | Collection4;
new Vault3();
new Vault();
const sceneType: Scene['type'] = 'Scene';
void sceneType;
void [createPaintingAnnotationsHelper3, createRangeHelper3, createThumbnailHelper3, decodeContentState3, encodeContentState3, getAvailableLanguagesFromResource3, getValue3, imageServiceLoader3, parseSelector3, serialize3];
void [createActivationsHelper, createPaintingAnnotationsHelper4, createRangeHelper4, createSceneHelper, createThumbnailHelper4, decodeContentState4, encodeContentState4, getAvailableLanguagesFromResource4, getValue4, imageServiceLoader4, parseSelector4, serialize4];
type HelperTypes3 = ParsedSelector3 | RangeTableOfContentsNode3 | SupportedSelector3 | SupportedTarget3;
type HelperTypes4 = ParsedSelector4 | RangeTableOfContentsNode4 | SupportedSelector4 | SupportedTarget4;
void (undefined as HelperTypes3 | HelperTypes4 | undefined);
`
  );
  run(
    process.execPath,
    [
      resolve(root, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      'migration.ts',
    ],
    temporary
  );

  function reachable(entry) {
    const pending = [resolve(installed, entry)];
    const seen = new Set();
    while (pending.length) {
      const file = pending.pop();
      if (!file || seen.has(file)) continue;
      seen.add(file);
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/(?:from|import)\s*["'](\.\.?\/[^"']+)["']/g)) {
        const dependency = resolve(dirname(file), match[1]);
        if (existsSync(dependency)) pending.push(dependency);
      }
    }
    return [...seen].map((file) => readFileSync(file, 'utf8')).join('\n');
  }

  for (const entry of ['dist/index.js', 'dist/canvas-panel.js']) {
    const source = reachable(entry);
    if (/from\s*["'](?:three|@react-three\/)|require\(["'](?:three|@react-three\/)/.test(source)) {
      throw new Error(`${entry} reaches a Three.js import`);
    }
  }

  if (!existsSync(resolve(installed, 'dist/scene-panel.css'))) throw new Error('ScenePanel stylesheet is missing');
  if (!existsSync(resolve(installed, 'dist/waveform.css'))) throw new Error('Waveform stylesheet is missing');
  console.log('Packed ESM/CJS entries and the Presentation 3-to-4 TypeScript migration are valid.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

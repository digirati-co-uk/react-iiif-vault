import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
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
    ['ESM CanvasPanel', "await import('react-iiif-vault/canvas-panel')", true],
    ['ESM ScenePanel', "await import('react-iiif-vault/scene-panel')", true],
    ['CJS root', "require('react-iiif-vault')", false],
    ['CJS CanvasPanel', "require('react-iiif-vault/canvas-panel')", false],
    ['CJS ScenePanel', "require('react-iiif-vault/scene-panel')", false],
  ];
  for (const [label, source, esm] of entries) {
    const result = spawnSync(process.execPath, [...(esm ? ['--input-type=module'] : []), '-e', source], {
      cwd: temporary,
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`${label} failed:\n${result.stderr || result.stdout}`);
  }

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
  console.log('Packed ESM/CJS entries are SSR-safe and non-Scene bundles are Three.js-free.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

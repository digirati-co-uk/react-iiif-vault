import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(process.argv[2] || dirname(fileURLToPath(import.meta.url)) + '/..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const require = createRequire(resolve(root, 'package.json'));
const forbidden = /^(?:react-dom|preact|@floating-ui|polygon-editor)(?:\/|$)|^@atlas-viewer\/atlas(?:$|\/(?!react(?:\/|$)))/;
const seen = new Set();
function inspect(file) {
  if (seen.has(file) || file.endsWith('.json')) return;
  seen.add(file);
  for (const { fileName: specifier } of ts.preProcessFile(readFileSync(file, 'utf8'), true, true).importedFiles) {
    if (['exports', 'require', 'module'].includes(specifier)) continue;
    assert(!forbidden.test(specifier), `${file} imports forbidden runtime ${specifier}`);
    if (!isBuiltin(specifier)) inspect(createRequire(file).resolve(specifier));
  }
}
for (const format of ['import', 'require']) {
  const entry = pkg.exports['./canvas-panel/scene'][format];
  inspect(resolve(root, entry.default));
  assert(existsSync(resolve(root, entry.types)));
  const scene = format === 'import' ? await import(pathToFileURL(resolve(root, entry.default))) : require(pkg.name + '/canvas-panel/scene');
  const coreEntry = pkg.exports['./core'][format];
  const core = format === 'import' ? await import(pathToFileURL(resolve(root, coreEntry.default))) : require(pkg.name + '/core');
  for (const name of ['RenderCanvasScene', 'RenderImage', 'CanvasWorldObject', 'RenderComplexTimelineScene', 'CanvasStrategyProvider']) assert(scene[name], name);
  for (const name of ['useStrategy', 'ComplexTimelineProvider', 'createComplexTimelineStore', 'ViewerPresetContext']) assert.equal(scene[name], core[name], `${format} duplicates ${name}`);
  for (const name of ['HTMLPortal', 'Viewer', 'CanvasPanel']) assert(!(name in scene), name);
}
console.log('Passed: scene ESM/CJS dependency graphs and shared context/controller identity.');

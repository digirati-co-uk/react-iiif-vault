import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const application = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositories = resolve(application, '../../../..');
const destination = join(application, 'public/fixtures');
const sources = [
  {
    group: 'Prototype',
    source: join(application, 'fixtures'),
    destination: join(destination, 'prototype'),
  },
  {
    group: 'Parser',
    source: join(repositories, 'iiif-commons/parser/fixtures/presentation-4'),
    destination: join(destination, 'parser'),
  },
  {
    group: 'Parser official 3D',
    source: join(repositories, 'iiif-commons/parser/__tests__/presentation-4/fixtures/official/3d'),
    destination: join(destination, 'parser-official-3d'),
  },
  {
    group: 'Helpers',
    source: join(repositories, 'iiif-commons/iiif-helpers/__tests__/presentation-4/fixtures/official-3d'),
    destination: join(destination, 'helpers'),
  },
];

const fixtures = [];
for (const source of sources) {
  mkdirSync(source.destination, { recursive: true });
  for (const filename of readdirSync(source.source)
    .filter((name) => name.endsWith('.json'))
    .sort()) {
    const input = join(source.source, filename);
    const output = join(source.destination, filename);
    cpSync(input, output);
    const manifest = JSON.parse(readFileSync(input, 'utf8'));
    const label = Object.values(manifest.label || {}).flat()[0] || filename.replace(/\.json$/, '');
    fixtures.push({
      group: source.group,
      label,
      path: `/${relative(join(application, 'public'), output)}`,
    });
  }
}

const hotlinkIndex = join(application, 'public/hotlink-3d/index.json');
for (const fixture of JSON.parse(readFileSync(hotlinkIndex, 'utf8'))) {
  fixtures.push({ group: 'Hotlink 3D', ...fixture });
}

fixtures.push({
  group: 'Chess',
  label: 'The Opera Game · Paul Morphy vs Duke Karl / Count Isouard',
  path: '/hotlink-3d/chess/opera-game/manifest.json',
});

writeFileSync(join(destination, 'index.json'), `${JSON.stringify(fixtures, null, 2)}\n`);
console.log(`Synced ${fixtures.length} Presentation 4 fixtures.`);

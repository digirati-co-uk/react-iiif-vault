import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const models = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
const manifests = join(root, 'manifests');
const context = 'http://iiif.io/api/presentation/4/context.json';
const idBase = 'https://example.org/iiif/presentation-4/hotlink-3d';
const environmentMap =
  'https://raw.githubusercontent.com/mrdoob/three.js/r184/examples/textures/equirectangular/venice_sunset_1k.hdr';

mkdirSync(manifests, { recursive: true });

const language = (value) => ({ en: [value] });
const upstreamPage = (asset) =>
  asset
    .replace('raw.githubusercontent.com', 'github.com')
    .replace('/KhronosGroup/glTF-Sample-Assets/', '/KhronosGroup/glTF-Sample-Assets/blob/')
    .replace('/mrdoob/three.js/', '/mrdoob/three.js/blob/')
    .replace('/resolve/', '/blob/');
const payloadBytes = (model) =>
  /^https?:/.test(model.asset) ? model.bytes : statSync(join(root, model.asset.replace(/^\/hotlink-3d\//, ''))).size;
const metadata = (model) => [
  { label: language('Asset features'), value: language(model.features.join(', ')) },
  { label: language('Model media type'), value: language(model.format) },
  {
    label: language('Remote payload'),
    value: language(
      `${payloadBytes(model).toLocaleString('en-GB')} bytes${model.features.some((feature) => feature.toLowerCase().includes('external')) ? ' plus dependencies' : ''}`
    ),
  },
  {
    label: language('Expected result'),
    value: language(
      model.expected === 'unsupported-format'
        ? 'Unsupported-model diagnostic until a custom renderer is supplied'
        : model.renderer === 'splat'
          ? 'Render with the built-in Gaussian splat renderer'
          : 'Render with the built-in glTF loader'
    ),
  },
];

for (const model of models) {
  const base = `${idBase}/${model.slug}`;
  const source = { id: model.asset, type: 'Model', format: model.format, label: language(model.label) };
  const body = model.animation
    ? { type: 'SpecificResource', source, selector: [{ type: 'AnimationSelector', value: model.animation }] }
    : source;
  const painting = [
    {
      id: `${base}/annotation/model`,
      type: 'Annotation',
      motivation: ['painting'],
      body,
      target: { id: `${base}/scene`, type: 'Scene' },
      ...(model.duration ? { timeMode: 'loop' } : {}),
    },
  ];

  if (model.environment) {
    painting.push({
      id: `${base}/annotation/environment`,
      type: 'Annotation',
      motivation: ['painting'],
      body: {
        id: `${base}/light/environment`,
        type: 'ImageBasedLight',
        intensity: 1,
        environmentMap: { id: environmentMap, type: 'Image', format: 'image/vnd.radiance' },
      },
      target: { id: `${base}/scene`, type: 'Scene' },
    });
  }

  const manifest = {
    '@context': context,
    id: `${base}/manifest`,
    type: 'Manifest',
    label: language(model.label),
    summary: language(model.summary),
    metadata: metadata(model),
    ...(model.rights ? { rights: model.rights } : {}),
    ...(/^https?:/.test(model.asset)
      ? {
          homepage: [
            {
              id: upstreamPage(model.asset),
              type: 'Text',
              label: language('Pinned upstream asset'),
              format: 'text/html',
            },
          ],
        }
      : {}),
    items: [
      {
        id: `${base}/scene`,
        type: 'Scene',
        label: language(model.label),
        backgroundColor: model.backgroundColor || '#20252b',
        ...(model.duration ? { duration: model.duration } : {}),
        items: [{ id: `${base}/page`, type: 'AnnotationPage', items: painting }],
      },
    ],
  };

  writeFileSync(join(manifests, `${model.slug}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
}

const items = models.map((model) => ({
  label: `Hotlink 3D · ${model.label}`,
  path: `/hotlink-3d/manifests/${model.slug}.json`,
  format: model.format,
  features: model.features,
  expected: model.expected || 'render',
  asset: model.asset,
}));
writeFileSync(join(root, 'index.json'), `${JSON.stringify(items, null, 2)}\n`);

const collection = {
  '@context': context,
  id: `${idBase}/collection`,
  type: 'Collection',
  label: language('Hot-linked 3D model fixtures'),
  summary: language(
    'Presentation 4 fixtures covering 3D asset formats, encodings, compression, animation, geometry, and material features.'
  ),
  items: models.map((model) => ({
    id: `${idBase}/${model.slug}/manifest`,
    type: 'Manifest',
    label: language(model.label),
  })),
};
writeFileSync(join(root, 'collection.json'), `${JSON.stringify(collection, null, 2)}\n`);

console.log(`Generated ${models.length} Presentation 4 manifests.`);

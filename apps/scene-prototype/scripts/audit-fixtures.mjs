import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSceneHelper } from '@iiif/helpers/scenes';
import { Vault4 } from '@iiif/helpers/vault-4';
import { validateAuthoredPresentation4 } from '@iiif/parser/presentation-4/validator';

const application = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = join(application, 'public');
const fixtures = JSON.parse(readFileSync(join(publicDirectory, 'fixtures/index.json'), 'utf8'));
const hotlinkDirectory = join(publicDirectory, 'hotlink-3d');
const catalog = JSON.parse(readFileSync(join(hotlinkDirectory, 'catalog.json'), 'utf8'));
const hotlinkIndex = JSON.parse(readFileSync(join(hotlinkDirectory, 'index.json'), 'utf8'));
const collection = JSON.parse(readFileSync(join(hotlinkDirectory, 'collection.json'), 'utf8'));
const expected = (model) => model.expected || 'render';

for (const filename of ['astronaut.json', 'scene.json']) {
  const validation = validateAuthoredPresentation4(JSON.parse(readFileSync(join(publicDirectory, filename), 'utf8')));
  if (!validation.valid) throw new Error(`${filename}: authored Presentation 4 validation failed`);
}

if (new Set(catalog.map(({ slug }) => slug)).size !== catalog.length)
  throw new Error('Hotlink catalogue has duplicate slugs');
if (hotlinkIndex.length !== catalog.length) throw new Error('Hotlink index is stale');
if (collection.items?.length !== catalog.length) throw new Error('Hotlink Collection is stale');

const generatedFiles = readdirSync(join(hotlinkDirectory, 'manifests'))
  .filter((name) => name.endsWith('.json'))
  .sort();
const expectedFiles = catalog.map(({ slug }) => `${slug}.json`).sort();
if (JSON.stringify(generatedFiles) !== JSON.stringify(expectedFiles))
  throw new Error('Generated hotlink manifest files do not match the catalogue');

for (const [index, model] of catalog.entries()) {
  const localPath = /^https?:/.test(model.asset) ? null : join(publicDirectory, model.asset.replace(/^\/+/, ''));
  const bytes = localPath ? statSync(localPath).size : model.bytes;
  if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new Error(`${model.slug}: invalid payload size`);
  if (
    /^https?:/.test(model.asset) &&
    !/raw\.githubusercontent\.com\/.+\/(?:[a-f0-9]{40}|r\d+)\//i.test(model.asset) &&
    !/huggingface\.co\/.+\/resolve\/[a-f0-9]{40}\//i.test(model.asset)
  ) {
    throw new Error(`${model.slug}: remote asset URL is not revision-pinned`);
  }

  const listing = hotlinkIndex[index];
  const expectedListing = {
    label: `Hotlink 3D · ${model.label}`,
    path: `/hotlink-3d/manifests/${model.slug}.json`,
    format: model.format,
    features: model.features,
    expected: expected(model),
    asset: model.asset,
  };
  if (JSON.stringify(listing) !== JSON.stringify(expectedListing))
    throw new Error(`${model.slug}: stale hotlink index entry`);

  const manifest = JSON.parse(readFileSync(join(hotlinkDirectory, 'manifests', `${model.slug}.json`), 'utf8'));
  const validation = validateAuthoredPresentation4(manifest);
  if (!validation.valid) {
    const errors = validation.issues.filter(({ severity }) => severity === 'error').map(({ message }) => message);
    throw new Error(`${model.slug}: authored Presentation 4 validation failed: ${errors.join('; ')}`);
  }
  const base = `https://example.org/iiif/presentation-4/hotlink-3d/${model.slug}`;
  if (manifest['@context'] !== 'http://iiif.io/api/presentation/4/context.json')
    throw new Error(`${model.slug}: wrong Presentation 4 context`);
  if (manifest.id !== `${base}/manifest` || manifest.type !== 'Manifest')
    throw new Error(`${model.slug}: wrong Manifest identity`);
  if (manifest.items?.length !== 1 || manifest.items[0].id !== `${base}/scene` || manifest.items[0].type !== 'Scene')
    throw new Error(`${model.slug}: expected one generated Scene`);
  const annotation = manifest.items[0].items?.[0]?.items?.find(({ id }) => id === `${base}/annotation/model`);
  const resource = annotation?.body?.type === 'SpecificResource' ? annotation.body.source : annotation?.body;
  if (
    annotation?.type !== 'Annotation' ||
    !annotation.motivation?.includes('painting') ||
    resource?.type !== 'Model' ||
    resource.id !== model.asset ||
    resource.format !== model.format ||
    annotation.target?.id !== `${base}/scene`
  ) {
    throw new Error(`${model.slug}: generated Model painting is stale or malformed`);
  }
  if (/^https?:/.test(model.asset)) {
    if (manifest.homepage?.[0]?.type !== 'Text' || manifest.homepage[0].format !== 'text/html')
      throw new Error(`${model.slug}: malformed upstream homepage`);
    if (!/\/(?:blob)\//.test(manifest.homepage[0].id))
      throw new Error(`${model.slug}: homepage points at a binary download rather than an HTML source page`);
  } else {
    if (model.renderer === 'splat') {
      const data = readFileSync(localPath);
      if (data.length % 32 || data.length / 32 < 1_000)
        throw new Error(`${model.slug}: malformed or trivial splat payload`);
      for (let offset = 0; offset < data.length; offset += 32) {
        const values = Array.from({ length: 6 }, (_, index) => data.readFloatLE(offset + index * 4));
        if (values.some((value) => !Number.isFinite(value)) || values.slice(3).some((scale) => scale <= 0))
          throw new Error(`${model.slug}: invalid splat position or scale`);
        if (!data[offset + 27]) throw new Error(`${model.slug}: transparent splat row`);
      }
    }
  }
  const remotePayload = manifest.metadata?.find(({ label }) => label?.en?.[0] === 'Remote payload')?.value?.en?.[0];
  if (
    remotePayload !==
    `${bytes.toLocaleString('en-GB')} bytes${model.features.some((feature) => feature.toLowerCase().includes('external')) ? ' plus dependencies' : ''}`
  )
    throw new Error(`${model.slug}: generated payload metadata is stale`);
  if (model.animation && annotation.body?.selector?.[0]?.value !== model.animation)
    throw new Error(`${model.slug}: AnimationSelector is stale`);
  if (collection.items[index]?.id !== manifest.id) throw new Error(`${model.slug}: stale Collection entry`);
}

for (const fixture of fixtures) {
  const json = JSON.parse(readFileSync(join(publicDirectory, fixture.path), 'utf8'));
  const vault = new Vault4();
  let scene;
  if (json.type === 'Manifest') {
    const manifest = vault.loadManifestSync(json.id, json);
    const scenes = (vault.get(manifest.items, { parent: manifest }) || []).filter((item) => item?.type === 'Scene');
    const start = manifest.start && vault.get(manifest.start, { skipSelfReturn: false });
    if (start?.type === 'Scene') scene = start;
    else if (scenes.length === 1) scene = scenes[0];
    else throw new Error(`${fixture.path}: expected one Scene or a Scene start, found ${scenes.length}`);
  } else {
    scene = vault.loadSync(json.id, json);
  }
  if (scene?.type !== 'Scene') throw new Error(`${fixture.path}: no renderable Scene`);

  const helper = createSceneHelper(vault);
  const paintables = helper.getPaintables(scene).items;
  if (!paintables.length) throw new Error(`${fixture.path}: no painting resources`);
  const unresolved = helper
    .getAllAnnotations(scene)
    .filter((annotation) => annotation.motivation.includes('painting'))
    .filter((annotation) => !paintables.some((item) => item.annotationId === annotation.id));
  if (unresolved.length)
    throw new Error(`${fixture.path}: unresolved painting annotations: ${unresolved.map(({ id }) => id).join(', ')}`);
  for (const item of paintables) {
    if (item.type === 'model' && fixture.expected !== 'unsupported-format') {
      const format = String(item.resource.format || '').toLowerCase();
      if (
        !['model/gltf+json', 'model/gltf-binary', 'model/vnd.usdz+zip'].includes(format) &&
        !/\.(gltf|glb|splat|usdz)(?:$|[?#])/i.test(item.resource.id)
      ) {
        throw new Error(`${fixture.path}: expected a built-in model format, found ${format || 'no format'}`);
      }
    }
  }
  console.log(`✓ ${fixture.group}: ${fixture.label} (${paintables.length})`);
}

console.log(`Audited ${fixtures.length} fixtures.`);

if (process.argv.includes('--network')) {
  const origin = 'http://localhost:4173';
  const checkRemote = async (url, label, bytes) => {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { Origin: origin, 'Accept-Encoding': 'identity' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${label}: remote request returned ${response.status}`);
    const allowOrigin = response.headers.get('access-control-allow-origin');
    if (allowOrigin !== '*' && allowOrigin !== origin)
      throw new Error(`${label}: remote response does not allow browser CORS`);
    const length = Number(response.headers.get('content-length'));
    if (bytes && length !== bytes)
      throw new Error(`${label}: expected ${bytes} bytes, received ${length || 'no length'}`);
  };

  const remoteModels = catalog.filter(({ asset }) => /^https?:/.test(asset));
  await Promise.all(remoteModels.map((model) => checkRemote(model.asset, model.slug, model.bytes)));
  const environmentMap = JSON.parse(
    readFileSync(join(hotlinkDirectory, 'manifests', '04-damaged-helmet-pbr-glb.json'), 'utf8')
  ).items[0].items[0].items.find(({ id }) => id.endsWith('/annotation/environment')).body.environmentMap.id;
  const prototypeResources = new Set([environmentMap]);
  const collectResources = (value) => {
    if (!value || typeof value !== 'object') return;
    if (
      ['Model', 'Image', 'Audio'].includes(value.type) &&
      /^https?:/.test(value.id) &&
      !value.id.includes('example.org')
    )
      prototypeResources.add(value.id);
    Object.values(value).forEach(collectResources);
  };
  for (const filename of readdirSync(join(application, 'fixtures')).filter((name) => name.endsWith('.json'))) {
    collectResources(JSON.parse(readFileSync(join(application, 'fixtures', filename), 'utf8')));
  }
  await Promise.all([...prototypeResources].map((url) => checkRemote(url, url)));
  const dependencies = new Set();
  const collectGltfDependencies = (gltf, base) => {
    for (const { uri } of [...(gltf.buffers || []), ...(gltf.images || [])]) {
      if (uri && !uri.startsWith('data:')) dependencies.add(new URL(uri, base).href);
    }
  };
  for (const model of catalog.filter(({ asset }) => /\.gltf(?:$|[?#])/i.test(asset))) {
    const response = await fetch(model.asset, { headers: { Origin: origin }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${model.slug}: could not inspect glTF dependencies`);
    collectGltfDependencies(await response.json(), model.asset);
  }
  const chessAssets = join(hotlinkDirectory, 'chess/opera-game/assets');
  for (const filename of readdirSync(chessAssets).filter((name) => name.endsWith('.gltf'))) {
    collectGltfDependencies(
      JSON.parse(readFileSync(join(chessAssets, filename), 'utf8')),
      `https://example.org/${filename}`
    );
  }
  await Promise.all([...dependencies].map((url) => checkRemote(url, url)));
  console.log(
    `Checked ${remoteModels.length + prototypeResources.size + dependencies.size} remote resources and glTF dependencies for reachability, size, and CORS.`
  );
}

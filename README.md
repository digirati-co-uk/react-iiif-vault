# React IIIF Vault

This library is a fully featured IIIF Library for reading and displaying IIIF Manifests, Collections and Annotations.

It is built on `@iiif/helpers` ([Repository](https://github.com/IIIF-Commons/iiif-helpers)) and uses the IIIF Vault to
request, parse, upgrade and store IIIF. It also contains the React implementation of [Canvas Panel](https://github.com/digirati-co-uk/iiif-canvas-panel) which is built on [Atlas Viewer](https://github.com/atlas-viewer/atlas).

```
npm i react-iiif-vault
```

The default entry point exports the Presentation 3 authored and normalized TypeScript types. The Presentation 4
entry point exports their Presentation 4 equivalents, so no separate parser installation is needed.

Presentation 4 applications can switch to the versioned entry point. It exports `Vault4` as `Vault`, defaults
`VaultProvider` to version 4, and binds the Vault hooks to the Presentation 4 type map.

```tsx
import { Vault, VaultProvider, useVault } from 'react-iiif-vault/presentation-4';

const vault = new Vault();
```

Frequently used IIIF helpers are available from matching versioned entry points. These are direct re-exports, so
they do not add another runtime layer.

```ts
import { fetch, getValue, serialize, Traverse, upgrade } from 'react-iiif-vault/helpers';
import {
  createSceneHelper,
  fetch as fetchPresentation4,
  serialize as serializePresentation4,
  Traverse as TraversePresentation4,
  upgrade as upgradeToPresentation4,
} from 'react-iiif-vault/presentation-4/helpers';
```

`fetchPresentation4` accepts Presentation 2, 3, or 4 JSON and returns a Presentation 4 `Manifest` or `Collection`.

For an application that needs both versions, create a separately named hook set instead:

```ts
import { createVaultHooks } from 'react-iiif-vault';

export const presentation4 = createVaultHooks(4);
```

## Migrating from Presentation 3 to Presentation 4

For applications using the Vault, resource hooks, IIIF types, and helpers, the migration is primarily an import-path
change. The versioned entry point changes `Vault`, `VaultProvider`, the Vault and resource hooks, authored types, and
normalized types to their Presentation 4 equivalents.

| Presentation 3 (default)   | Presentation 4                            |
| -------------------------- | ----------------------------------------- |
| `react-iiif-vault`         | `react-iiif-vault/presentation-4`         |
| `react-iiif-vault/helpers` | `react-iiif-vault/presentation-4/helpers` |

Before:

```tsx
import { useManifest, VaultProvider } from 'react-iiif-vault';
import type { Manifest } from 'react-iiif-vault';
import { fetch, getValue } from 'react-iiif-vault/helpers';
```

After:

```tsx
import { useManifest, VaultProvider } from 'react-iiif-vault/presentation-4';
import type { Manifest, Scene } from 'react-iiif-vault/presentation-4';
import { fetch, getValue } from 'react-iiif-vault/presentation-4/helpers';
```

The Presentation 4 `fetch` upgrades Presentation 2 or 3 responses before returning them, so existing manifest URLs
can continue to be used:

```ts
import { fetch } from 'react-iiif-vault/presentation-4/helpers';

const manifestOrCollection = await fetch(manifestUrl);
```

After changing the imports, TypeScript will identify genuine Presentation 3 assumptions in application code. Common
examples are code that needs to handle Presentation 4 `Timeline` and `Scene` containers, or selectors and transforms
that only exist in Presentation 4. The library does not require `@iiif/parser`, `@iiif/helpers`, or the old
`@iiif/presentation-*` packages to be installed directly when they were only used for the types and helpers re-exported
here.

One library-level breaking fix applies to both entries: `useExternalCollection()` now returns its loaded resource as
`collection`. Version 3.x incorrectly called that property `manifest`.

Canvas Panel accepts both Presentation 3 and 4 Canvases, including Presentation 4 painting targets, background colours,
and Canvas-valued `placeholderContainer` and `accompanyingContainer` references. It remains a Canvas renderer: Timeline
and Scene containers are left to their corresponding renderers, with Scene Panel providing the native Presentation 4
Scene implementation. Some older low-level rendering APIs still expose Presentation 3-shaped resource types.

Applications that need both versions should keep the default imports and create a separately named v4 hook set with
`createVaultHooks(4)`. The runtime version guard will report a hook set used under the wrong provider.

### Prefer one version in editor auto-imports

This cannot be configured in `tsconfig.json`: `exclude` controls project files, not import suggestions. With
TypeScript 5.6 or newer, VS Code can filter module specifiers through
[`typescript.preferences.autoImportSpecifierExcludeRegexes`](https://devblogs.microsoft.com/typescript/announcing-typescript-5-6/#exclude-patterns-for-auto-imports).

For a Presentation 4 application, add this to `.vscode/settings.json` to hide the default v3 entry points:

```json
{
  "typescript.preferences.autoImportSpecifierExcludeRegexes": ["^react-iiif-vault$", "^react-iiif-vault/helpers$"]
}
```

For a Presentation 3 application, hide all Presentation 4 entry points instead:

```json
{
  "typescript.preferences.autoImportSpecifierExcludeRegexes": ["^react-iiif-vault/presentation-4(?:/.*)?$"]
}
```

JavaScript projects can use the same patterns under `javascript.preferences.autoImportSpecifierExcludeRegexes`.

#### Zed

Zed users running `vtsls` can put the same preference in `.zed/settings.json`. For a Presentation 4 application:

```json
{
  "lsp": {
    "vtsls": {
      "settings": {
        "typescript": {
          "preferences": {
            "autoImportSpecifierExcludeRegexes": ["^react-iiif-vault$", "^react-iiif-vault/helpers$"]
          }
        }
      }
    }
  }
}
```

For a Presentation 3 application, use `["^react-iiif-vault/presentation-4(?:/.*)?$"]` instead.

## Canvas Panel

The easiest way to get a simple headless and extensible viewer is to use the Canvas Panel component. You can
use it as a single component, or you can build your own Viewer from it's part, deciding which types of Content you want to support (images, video, audio, 3D, HTML etc.).

```tsx
import { CanvasPanel } from 'react-iiif-vault';

function MyViewer() {
  return <CanvasPanel manifest="https://digirati-co-uk.github.io/wunder.json" />;
}
```

There are a lot of options you can pass to Canvas Panel to customise the way it renders IIIF and also
slots for inserting UI that will have access to the [Contexts](https://react.dev/learn/passing-data-deeply-with-context) provided by the library.

![](./images/canvas-panel.jpg)

For example, you can use the `useSimpleViewer()` hook to gain access to controls for moving forward and back and
also the `useManifest` or other resource hooks to get access to the IIIF.

```tsx
import { CanvasPanel, useSimpleViewer, useManifest, LocaleString } from 'react-iiif-vault';

function MyViewer() {
  return (
    <CanvasPanel header={<Label />} manifest="https://digirati-co-uk.github.io/wunder.json">
      <MyControls />
    </CanvasPanel>
  );
}

function MyControls() {
  const { previousCanvas, nextCanvas } = useSimpleViewer();
  return (
    <div>
      <button onClick={previousCanvas}>Prev</button>
      <button onClick={nextCanvas}>Next</button>
    </div>
  );
}

function Label() {
  const manifest = useManifest();

  if (!manifest) {
    return <div>Loading..</div>;
  }

  return (
    <LocaleString as="h2" className="text-2xl my-3">
      {manifest.label}
    </LocaleString>
  );
}
```

The `useSimpleViewer()` hook returns the following:

```ts
type SimpleViewerContext = {
  items: Reference<'Canvas'>[];
  sequence: number[][];
  hasNext: boolean;
  hasPrevious: boolean;
  setSequenceIndex: (newId: number) => void;
  setCurrentCanvasId: (newId: string) => void;
  setCurrentCanvasIndex: (newId: number) => void;
  currentSequenceIndex: number;
  nextCanvas: () => void;
  previousCanvas: () => void;
};
```

For paged items, `sequence` will be a list of indices into `items`. For example:

```ts
const sequence = [[0], [1, 2], [3, 4]];

const items = [{/* front page */}, {/* page 1v */}, {/* page 1r */}, {/* page 2v */}, {/* page 2r */}];
```

You can create a list of the sequence, grouped by "row" with a simple map:

```ts
const itemSequence = sequence.map((row) => row.map((idx) => items[idx]));
// [
//   [ {/* front page */} ],
//   [ {/* page 1v */}, {/* page 1r */} ]
//   [ {/* page 2v */}, {/* page 2r */} ]
// ]
```

The sequence is pre-generated, so paging forward and back is as simple as going to the next index in the sequence.
The items returned will be all the IIIF Canvases that should be rendered.

For continuous Manifests (e.g. a long Scroll), there will only be one item in the sequence:

```ts
const sequence = [
  [0, 1, 2, 3, 4 ...],
]
```

Indicating that all the canvases should be displayed in a single view.

You can disable paging by passing `pagingEnabled={false}` to `<CanvasPanel />`.

You can grab the [React ref](https://react.dev/learn/referencing-values-with-refs) from the `<CanvasPanel />` component to control it from outside of the component.

Example:

```tsx
function MyViewer() {
  const ref = useRef();


  return <>
    <CanvasPanel ref={ref} manifest={...} />
    <div>
      <button onClick={() => ref.current.previousCanvas()}>Prev</button>
      <button onClick={() => ref.current.nextCanvas()}>Next</button>
    </div>
  </>;
}
```

The ref is the same as what is returned from `useSimpleViewer()`.

### Optional waveform media controls

Audio Canvases can use the optional WaveSurfer controls instead of building a `MediaControls` component from the
media hooks. Install the optional peer and import the separate component and stylesheet entries:

```sh
pnpm add wavesurfer.js
```

```tsx
import { CanvasPanel } from 'react-iiif-vault';
import { MediaControls, type WaveformOptions } from 'react-iiif-vault/waveform';
import 'react-iiif-vault/waveform.css';

const waveformOptions: WaveformOptions = {
  waveColor: '#71d7cf',
  progressColor: '#ffcf70',
  cursorColor: '#fff4d6',
  barWidth: 3,
  barGap: 2,
  barRadius: 3,
};

function AudioControls() {
  return <MediaControls waveformOptions={waveformOptions} />;
}

export function AudioViewer({ manifest }: { manifest: string }) {
  return <CanvasPanel manifest={manifest} components={{ MediaControls: AudioControls }} />;
}
```

`MediaControls` owns the lazy import and Suspense boundary. It renders a waveform for audio and the same play, seek,
time, volume, and mute controls without a waveform for video. `loadingFallback`, `errorFallback`, `labels`,
`onWaveformReady`, and `onWaveformError` customise its behaviour; `waveformOptions` accepts the WaveSurfer options
other than `container` and `media`, which are supplied by React IIIF Vault.

The stylesheet only uses regular classes and CSS custom properties, so it can be imported and overridden or replaced.
The main selectors are `.riv-waveform-media-controls`, `.riv-waveform-visual`, `.riv-waveform-seek`,
`.riv-waveform-toolbar`, `.riv-waveform-button`, `.riv-waveform-time`, and `.riv-waveform-volume`. The supplied theme
variables are:

```css
.my-waveform-controls {
  --riv-waveform-background: #142b32e8;
  --riv-waveform-border: #71d7cf66;
  --riv-waveform-foreground: #fff4d6;
  --riv-waveform-muted: #b8d8d5;
  --riv-waveform-track: #071c22cc;
}
```

Pass that class with `<MediaControls className="my-waveform-controls" />`. Waveform colours are canvas values, so set
them through `waveformOptions` as in the example rather than through CSS.

CanvasPanel places media UI in `.atlas-portal`. To overlay controls at the bottom of the viewer while keeping other
content such as a thumbnail strip below it, put both viewer layers in the same grid area:

```css
.viewer {
  display: grid;
}

.viewer > .atlas-container,
.viewer > .atlas-portal {
  grid-area: 1 / 1;
}

.viewer > .atlas-portal {
  z-index: 2;
  align-self: end;
}
```

## 3D Scene Panel

Presentation 4 Scenes, including glTF/GLB models and streamed `.splat` Gaussian splats, can be rendered with the
separate Scene Panel entry point. Splats request a continuous Three.js frame loop while mounted, including when they
are inside a nested Scene.

```tsx
import { ScenePanel } from 'react-iiif-vault/scene-panel';

function SceneViewer() {
  return <ScenePanel manifest="https://example.org/scene-manifest.json" overlay={<MyFloatingControls />} />;
}
```

For application-owned layouts, compose `ScenePanel.Provider` and `ScenePanel.Viewer` as siblings with your toolbar or sidebar. `useSceneControls()` exposes playback, framing, camera, annotation, and view actions; ScenePanel does not add default chrome.

KTX2-compressed glTF textures use the Basis transcoder pinned to the installed Three.js version on jsDelivr by
default. Deployments with restricted network access or offline requirements should self-host those files and pass
their directory (including `basis_transcoder.js` and `basis_transcoder.wasm`). A strict Content Security Policy must
also allow the blob worker created by Three.js's `KTX2Loader`:

```tsx
<ScenePanel manifest={manifest} ktx2TranscoderPath="/three/basis/" />
```

Nested Scenes and Canvases currently need to be embedded in the loaded Manifest, or preloaded into the supplied
`Vault4`. Scene Panel does not yet follow a referenced Container's `partOf` link to fetch another Manifest.

## Simple Viewer Provider

One of the main components of this Library is the `<SimpleViewerProvider />`. This is a component you can
wrap around other IIIF components to load a IIIF Manifest and enable all the other hooks and components.

It takes the following properties:

```
manifest: string;
pagingEnabled?: boolean;
startCanvas?: string;
rangeId?: string;
```

Example:

```tsx
import { SimpleViewerProvider, useManifest, LocaleString } from 'react-iiif-vault';

function MyViewer() {
  return (
    <SimpleViewerProvider manifest="https://digirati-co-uk.github.io/wunder.json">
      <ManifestTitle />
    </SimpleViewerProvider>
  );
}

function ManifestTitle() {
  const manifest = useManifest();

  return <LocaleString as="h1">{manifest.label}</LocaleString>;
}
```

Will display:

> # Wunder der Vererbung / von Fritz Bolle.

Components inside this context can also use the `useSimpleViewer()` hook, similar to Canvas Panel.

## Vault provider

If you want to use the context manually, and not build a viewer specifically, you can wrap your application in a `VaultProvider`, passing a custom Vault instance if you want (This can be useful for server side rendering).

```tsx
function MyApp() {
  return (
    <VaultProvider>
      <App />
    </VaultProvider>
  );
}
```

From anywhere in your app, you will be able to access the Vault using:

```ts
const vault = useVault();
```

#### Example NextJS hydration of IIIF Manifest

For server side rendering, you can pass IIIF resources into Vault. You will need a client component
that wraps other components. Only client components can use the hooks, since they depend on the provider.

```tsx
// ManifestLoader.tsx
'use client';
import { SimpleViewerProvider, Vault, VaultProvider } from 'react-iiif-vault';
import type { Manifest } from 'react-iiif-vault';

export const vault = new Vault();

export function ManifestLoader(props: { manifest: Manifest; children: React.ReactNode }) {
  // On the client, use `vault.requestStatus()` to check if the Manifest already exists
  // if not, use `vault.loadSync()` to load it and ensure its loaded immediately from the JSON.
  if (props.manifest && props.manifest.id && !vault.requestStatus(props.manifest.id)) {
    vault.loadSync(props.manifest.id, props.manifest);
  }

  return (
    <SimpleViewerProvider manifest={props.manifest} vault={vault}>
      {props.children}
    </SimpleViewerProvider>
  );
}
```

You can then use this in a server component, passing down the Manifest JSON.

```ts
// app/page.tsx
import { readFile } from 'node:fs/promises';

export default async function Page() {
  const manifestJson = await readFile('./manifests/my-manifest.json').then(s => JSON.parse(s));

  return (
    <ManifestLoader manifest={manifestJson}>
      {/* ... Other server or client components ... */}
    </ManifestLoader>
  );
}
```

This will prevent the IIIF Resource being requested remotely, speeding up the initial rendering of pages.

## Providers + Hooks

Some hooks, like `use{RESOURCE}` require a context to be set. Some will be available from the `SimpleViewerProvider` and others may be required before using the hooks. The available providers are:

- `<AnnotationProvider annotation="..." />` - Single annotation context, enables:
  - `useAnnotation()`
  - `usePaintingAnnotation()`
- `<AnnotationPageProvider annotationPage="..." />` - Single annotation page context, enables `useAnnotationPage()`
- `<CanvasContext canvas="..." />` - Single canvas context, enables:
  - `useThumbnail()`
  - `useCanvas()`
  - `usePaintables()`
  - `useRenderingStrategy()`
  - `useLoadImageService()`
  - `useImageTile()`
  - `useImageService()`
- `<CollectionContext collection="..." />` - Single collection context, enables `useCollection()`
- `<ManifestContext manifest="..." />` - Single manifest context, enables:
  - `useManifest()`
  - `useThumbnail()`
  - `useSearchService()`
- `<RangeContext range="..." />` - Single range context, enables `useRange()`

## Components

Included are a few components that can be used within a Canvas Panel, Simple Viewer or Manifest provider.

### Image

This is a component that can render an Image from an image service or image service ID.

```tsx
<Image
  size={{ width: 256 }}
  src="https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen"
/>
```

It supports:

- `rotation`
- `region`
- `quality`
- `size`
- `format`

You can also pass `fetchImageService={true}` to enable it to fetch the image service. This can be useful if
you want some validation on the generated URLs (e.g. level0 services). In the future more validation will be
provided. You can also pass in an image service object in the `src={{ id: ..., profile: ... }}`.

If you only pass in the image service ID, then you have to ensure that you provide valid options supported
by the image service.

### Single Canvas Thumbnail

This will display a thumbnail using either a `canvasId` or the current canvas in the context.

```tsx
<SimpleViewerContext manifest="https://digirati-co-uk.github.io/wunder.json">
  <SingleCanvasThumbnail size={{ width: 128 }} />
</SimpleViewerContext>
```

It supports the following props:

```ts
interface SingleCanvasThumbnailProps {
  canvasId?: string;
  size?: Partial<SizeParameter>;
  visible?: boolean;
  alt?: string;
  dereference?: boolean;

  // Style
  figure?: boolean;
  showLabel?: boolean;
  classes?: {
    figure?: string;
    img?: string;
    label?: string;
    imageWrapper?: string;
  };

  // Slots.
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
}
```

### Sequence thumbnails

This wraps the `SingleCanvasThumbnail` but provides a list that is lazy-loaded based on the current sequence from the Simple Viewer Context.

![](./images/sequence.jpg)

Example:

```tsx
<SimpleViewerContext manifest="https://digirati-co-uk.github.io/wunder.json">
  <SequenceThumbnails
    classes={{
      container: 'flex gap-1 overflow-x-auto',
      row: 'flex gap-2 border border-gray-200 flex-none p-2 m-2',
      img: 'max-h-[128px] max-w-[128px] object-contain h-full w-full',
      selected: {
        row: 'flex gap-2 border border-blue-400 flex-none p-2 m-2 bg-blue-100',
      },
    }}
    fallback={
      <div className="flex items-center justify-center w-32 h-32 bg-gray-200 text-gray-400 select-none">No thumb</div>
    }
  />
</SimpleViewerContext>
```

The available props:

```ts
interface SequenceThumbnailsProps {
  flat?: boolean;
  size?: { width: number; height?: number };
  classes?: {
    container?: string;
    row?: string;
    item?: string;

    // SingleCanvasThumbnail
    figure?: string;
    imageWrapper?: string;
    img?: string;
    label?: string;

    selected?: {
      row?: string;
      item?: string;
      figure?: string;
      img?: string;
      label?: string;
      imageWrapper?: string;
    };
  };

  figure?: boolean;
  showLabel?: boolean;
  // Slots
  fallback?: React.ReactNode;
}
```

### Metadata components

These components will display metadata for different resources:

- `ManifestMetadata` - Displays only the metadata for the current Manifest
- `CombinedMetadata` - Displays the metadata for the current Manifest, Canvas and Range - combined
- `Metadata` - Has an extra `metadata={}` property, where you can pass down your own metadata.

![](./images/metadata.jpg)

Example:

```tsx
<CombinedMetadata
  allowHtml={true}
  classes={{
    container: 'm-4',
    row: 'border-b border-gray-200',
    label: 'font-bold p-2 text-slate-600',
    value: 'text-sm p-2 text-slate-800',
    empty: 'text-gray-400',
  }}
/>
```

These are provided without styles, and a `classes={}` prop for adding class names. The full list of options are available here:

```ts
export interface MetadataProps {
  config?: FacetConfig[];
  metadata?: Array<{ label: InternationalString; value: InternationalString } | null>;
  labelWidth?: number;
  allowHtml?: boolean;
  showEmptyMessage?: boolean;
  separator?: string;

  classes?: {
    container?: string;
    row?: string;
    label?: string;
    value?: string;
    empty?: string;
  };

  emptyMessage?: string;
  emptyValueFallback?: string;
  emptyLabelFallback?: string;

  // Slots.
  tableHeader?: React.ReactNode;
  tableFooter?: React.ReactNode;
  emptyFallback?: React.ReactNode;
}
```

The `facetConfig` options allows you to change the way the metadata is displayed. The types are:

```ts
type FacetConfig = {
  id: string;
  label: InternationalString;
  keys: string[];
  values?: FacetConfigValue[];
};

type FacetConfigValue = {
  id: string;
  label: InternationalString;
  values: string[];
  key: string;
};
```

Example:

```ts
const facetConfig = [
  {
    id: 'topics',
    label: { en: ['Topics'] },
    keys: ['Topic', 'Subject'],
  },
  {
    id: 'collections',
    label: { en: ['Collection'] },
    keys: ['Collection'],
    values: [
      {
        id: 'featured',
        label: { en: ['Featured collection'] },
        values: ['col_00001', 'col_00002'],
      },
      {
        id: 'paintings',
        label: { en: ['Paintings'] },
        values: ['col_00003'],
      },
    ],
  },
];
```

It's unlikely that this type of configuration would be created by hand, instead a tool would be used to clean up the Metadata or curated from multiple sources. In the example above, given the following metadata input:

```json
[
  {
    "label": { "none": ["Topic"] },
    "value": { "none": ["Some topic"] }
  },
  {
    "label": { "none": ["Subject"] },
    "value": { "none": ["Some subject", "Another subject"] }
  },
  {
    "label": { "none": ["Collection"] },
    "value": { "none": ["col_0003"] }
  },
  {
    "label": { "none": ["Object identifier"] },
    "value": { "none": ["123456"] }
  }
]
```

Would be transformed to:

```json
[
  {
    "label": { "en": ["Topics"] },
    "value": { "none": ["Some topic", "Some subject", "Another subject"] }
  },
  {
    "label": { "en": ["Collection"] },
    "value": { "en": ["Paintings"] }
  }
]
```

So the metadata that wasn't configured is skipped, values mapped and combined.

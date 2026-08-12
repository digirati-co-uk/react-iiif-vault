import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasPanel } from '../canvas-panel';
import { CanvasPanel as CanvasPanel4, VaultProvider as VaultProvider4 } from '../presentation-4';
import { CanvasAnnotations } from '../components/CanvasAnnotations';
import { CombinedMetadata } from '../components/CombinedMetadata';
import { SequenceThumbnails } from '../components/SequenceThumbnails';
import { RenderSvgEditorControls } from '../components/SvgEditorControls';
import { useViewerPreset } from '../context/ViewerPresetContext';
import { useCanvas } from '../hooks/useCanvas';
import { useCurrentAnnotationActions } from '../hooks/useCurrentAnnotationActions';
import { useCurrentAnnotationMetadata } from '../hooks/useCurrentAnnotationMetadata';
import { useManifest } from '../hooks/useManifest';
import { useRequestAnnotation } from '../hooks/useRequestAnnotation';
import { LocaleString } from '../utility/i18n-utils';
import { useSimpleViewer } from '../viewers/SimpleViewerContext';
import { MediaControls as WaveformMediaControls, type WaveformOptions } from '../waveform';
import './demo.css';
import './showcase.css';
import '../waveform/waveform.css';

const SceneShowcase = lazy(() => import('./scene-showcase'));

const routes = [
  { id: 'canvas', label: 'Version 3' },
  { id: 'v4', label: 'Version 4' },
  { id: 'annotations', label: 'Annotations' },
  { id: 'scenes', label: '3D scenes' },
  { id: 'chess', label: 'Chess lab' },
] as const;
type Route = (typeof routes)[number]['id'];

function routeFromHash(): Route {
  const route = location.hash.slice(1) as Route;
  return routes.some(({ id }) => id === route) ? route : 'canvas';
}

function App() {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    const update = () => setRoute(routeFromHash());
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);

  return (
    <div className="demo-app">
      <header className="site-header">
        <a className="wordmark" href="#canvas">
          <span aria-hidden="true">IIIF</span>
          <strong>React IIIF Vault</strong>
        </a>
        <nav aria-label="Demo sections">
          {routes.map(({ id, label }) => (
            <a key={id} href={`#${id}`} aria-current={route === id ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <a className="source-link" href="https://github.com/digirati-co-uk/react-iiif-vault">
          Source
        </a>
      </header>
      {route === 'scenes' || route === 'chess' ? (
        <Suspense fallback={<RouteLoading />}>
          <SceneShowcase page={route} />
        </Suspense>
      ) : null}
      {route === 'canvas' ? <CanvasPage /> : null}
      {route === 'v4' ? <Version4Page /> : null}
      {route === 'annotations' ? <AnnotationsPage /> : null}
    </div>
  );
}

function RouteLoading() {
  return (
    <main className="page route-loading" role="status">
      Loading 3D viewer…
    </main>
  );
}

const canvasExamples = [
  {
    label: 'Wunder der Vererbung',
    description: 'Paged image sequence with thumbnails and descriptive metadata.',
    url: 'https://digirati-co-uk.github.io/wunder.json',
  },
  {
    label: 'Metadata on any resource',
    description: 'Official IIIF Cookbook example with Manifest and Canvas metadata.',
    url: 'https://iiif.io/api/cookbook/recipe/0029-metadata-anywhere/manifest.json',
  },
  {
    label: 'Simple image',
    description: 'The smallest Presentation 3 image manifest.',
    url: 'https://iiif.io/api/cookbook/recipe/0001-mvm-image/manifest.json',
  },
  {
    label: 'Audio',
    description: 'The simplest Presentation 3 audio Manifest from the IIIF Cookbook.',
    url: 'https://iiif.io/api/cookbook/recipe/0002-mvm-audio/manifest.json',
  },
  {
    label: 'Video',
    description: 'The simplest Presentation 3 video Manifest from the IIIF Cookbook.',
    url: 'https://iiif.io/api/cookbook/recipe/0003-mvm-video/manifest.json',
  },
];

function CanvasPage() {
  const [manifest, setManifest] = useState(canvasExamples[0].url);
  const [draft, setDraft] = useState(canvasExamples[0].url);

  const load = (url: string) => {
    const next = url.trim();
    if (!next) return;
    setDraft(next);
    setManifest(next);
  };

  const selectExample = (next: Example) => {
    load(next.url);
  };

  return (
    <main className="page">
      <PageHeading
        title="Version 3"
        description="Presentation 3 images, audio and video through the default CanvasPanel API, with paging, viewport controls and metadata."
      />
      <ExampleTabs examples={canvasExamples} selected={manifest} onSelect={selectExample} />
      <form
        className="item-url-form"
        onSubmit={(event) => {
          event.preventDefault();
          load(draft);
        }}
      >
        <label htmlFor="canvas-manifest-url">Manifest URL</label>
        <input
          id="canvas-manifest-url"
          type="url"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder="https://example.org/manifest.json"
        />
        <button type="submit">View item</button>
      </form>
      <div className="viewer-shell canvas-showcase">
        <CanvasPanel
          key={manifest}
          manifest={manifest}
          height={560}
          spacing={24}
          reuseAtlas
          runtimeOptions={{ maxOverZoom: 5 }}
          components={{ ViewerControls: CanvasViewerControls, MediaControls: ShowcaseMediaControls }}
        >
          <section className="thumbnail-panel">
            <h2>Canvases</h2>
            <SequenceThumbnails
              dereference
              figure
              showLabel
              scrollBehaviour="smooth"
              classes={{
                container: 'thumbnail-strip',
                row: 'thumbnail-row',
                item: 'thumbnail-item',
                figure: 'thumbnail-figure',
                img: 'thumbnail-image',
                label: 'thumbnail-label',
                selected: { row: 'thumbnail-row thumbnail-row-selected' },
              }}
              fallback={<span className="thumbnail-fallback">No thumbnail</span>}
            />
          </section>
          <aside className="metadata-panel">
            <h2>Combined metadata</h2>
            <CombinedMetadata
              allowHtml
              classes={{
                container: 'metadata-table',
                row: 'metadata-row',
                label: 'metadata-label',
                value: 'metadata-value',
                empty: 'metadata-empty',
              }}
              emptyFallback={<p className="metadata-empty">No metadata on this resource.</p>}
            />
          </aside>
        </CanvasPanel>
      </div>
    </main>
  );
}

const version4Examples = [
  {
    label: 'Image',
    description: 'The IIIF Cookbook image recipe expressed as Presentation 4.',
    url: 'https://preview.iiif.io/cookbook/v4/recipe/0001-mvm-image/v4/manifest.json',
  },
  {
    label: 'Audio',
    description: 'Presentation 4 audio painted onto a Timeline.',
    url: 'https://preview.iiif.io/cookbook/v4/recipe/0002-mvm-audio/v4/manifest.json',
  },
  {
    label: 'Video',
    description: 'Presentation 4 video painted onto a dimensional Canvas.',
    url: 'https://preview.iiif.io/cookbook/v4/recipe/0003-mvm-video/v4/manifest.json',
  },
];

function Version4Page() {
  const [example, setExample] = useState(version4Examples[0]);
  return (
    <main className="page">
      <PageHeading
        title="Version 4"
        description="The same CanvasPanel composition backed by Vault4, including Presentation 4 Canvas and Timeline resources."
      />
      <ExampleTabs examples={version4Examples} selected={example.url} onSelect={setExample} />
      <div className="viewer-shell av-showcase">
        <VaultProvider4>
          <CanvasPanel4
            key={example.url}
            manifest={example.url}
            height={560}
            pagingEnabled={false}
            reuseAtlas
            components={{ ViewerControls: CanvasViewerControls, MediaControls: ShowcaseMediaControls }}
            header={<ManifestHeading />}
          />
        </VaultProvider4>
      </div>
    </main>
  );
}

function CanvasViewerControls() {
  const viewer = useSimpleViewer();
  const preset = useViewerPreset();
  return (
    <div className="canvas-controls" role="group" aria-label="Canvas navigation">
      <button type="button" disabled={!viewer.hasPrevious} onClick={viewer.previousCanvas}>
        Previous
      </button>
      <span>
        {viewer.currentSequenceIndex + 1} / {viewer.sequence.length}
      </span>
      <button type="button" disabled={!viewer.hasNext} onClick={viewer.nextCanvas}>
        Next
      </button>
      <span className="control-divider" aria-hidden="true" />
      <button type="button" aria-label="Zoom out" onClick={() => preset?.runtime.world.zoomOut()}>
        −
      </button>
      <button type="button" aria-label="Zoom in" onClick={() => preset?.runtime.world.zoomIn()}>
        +
      </button>
      <button type="button" onClick={() => preset?.runtime.world.goHome()}>
        Fit
      </button>
    </div>
  );
}

const annotationManifest =
  'https://gist.githubusercontent.com/stephenwf/57cc5024144c53d48cc3c07cc522eb94/raw/a87a5d9a8f949bfb11cebd4f011a204abe8a932b/manifest.json';

function AnnotationsPage() {
  return (
    <main className="page">
      <PageHeading
        title="Annotation tools"
        description="Create boxes, polygons, freehand regions and comments, or reopen the example shapes from the original demo."
      />
      <div className="viewer-shell annotation-showcase">
        <CanvasPanel
          manifest={annotationManifest}
          height={620}
          mode="sketch"
          reuseAtlas
          runtimeOptions={{ maxOverZoom: 5 }}
          components={{ ViewerControls: CanvasViewerControls }}
          annotationPopup={<AnnotationEditor />}
          annotations={<CanvasAnnotations />}
        >
          <AnnotationTools />
        </CanvasPanel>
      </div>
    </main>
  );
}

function AnnotationTools() {
  const canvas = useCanvas();
  const { requestAnnotation, isPending } = useRequestAnnotation();
  const bounds = canvas ? { x: 0, y: 0, width: canvas.width, height: canvas.height } : null;

  if (isPending) {
    return (
      <div className="annotation-toolbar" aria-label="Drawing tools">
        <strong>Drawing</strong>
        <RenderSvgEditorControls classNames={{ button: 'annotation-tool-button' }} />
      </div>
    );
  }

  return (
    <div className="annotation-toolbar" aria-label="Annotation examples">
      <strong>Create annotation</strong>
      <button type="button" onClick={() => requestAnnotation({ type: 'box', bounds })}>
        Box
      </button>
      <button type="button" onClick={() => requestAnnotation({ type: 'polygon' })}>
        Polygon
      </button>
      <button type="button" onClick={() => requestAnnotation({ type: 'draw' })}>
        Freehand
      </button>
      <button
        type="button"
        onClick={() => requestAnnotation({ type: 'target', selector: { x: 100, y: 100, width: 130, height: 200 } })}
      >
        Fixed region
      </button>
      <button type="button" onClick={() => requestAnnotation({ type: 'box', annotationPopup: <CommentEditor /> })}>
        Comment
      </button>
      <button
        type="button"
        onClick={() =>
          requestAnnotation({
            type: 'polygon',
            points: [
              [282, 630],
              [337, 579],
              [915, 1158],
              [878, 1260],
              [806, 1211],
            ],
          })
        }
      >
        Edit polygon
      </button>
      <button
        type="button"
        onClick={() =>
          requestAnnotation({
            type: 'polygon',
            points: [
              [250, 960],
              [250, 1251],
              [695, 1251],
              [695, 960],
            ],
          })
        }
      >
        Edit box
      </button>
    </div>
  );
}

function AnnotationEditor() {
  const { saveAnnotation, cancelRequest } = useCurrentAnnotationActions();
  const [metadata, setMetadata] = useCurrentAnnotationMetadata();
  return (
    <div className="annotation-editor">
      <label>
        <span>Annotation body</span>
        <input
          value={metadata.body || ''}
          onChange={(event) => setMetadata({ body: event.currentTarget.value })}
          placeholder="Add a value…"
        />
      </label>
      <div className="button-row">
        <button type="button" className="secondary" onClick={() => cancelRequest()}>
          Cancel
        </button>
        <button type="button" onClick={saveAnnotation}>
          Save
        </button>
      </div>
    </div>
  );
}

function CommentEditor() {
  const { saveAnnotation, cancelRequest } = useCurrentAnnotationActions();
  const [metadata, setMetadata] = useCurrentAnnotationMetadata();
  return (
    <div className="annotation-editor">
      <label>
        <span>Comment</span>
        <textarea
          rows={4}
          value={metadata.comment || ''}
          onChange={(event) => setMetadata({ comment: event.currentTarget.value })}
          placeholder="Write a comment…"
        />
      </label>
      <div className="button-row">
        <button type="button" className="secondary" onClick={() => cancelRequest()}>
          Cancel
        </button>
        <button type="button" onClick={saveAnnotation}>
          Save comment
        </button>
      </div>
    </div>
  );
}

const showcaseWaveform: WaveformOptions = {
  height: 142,
  waveColor: '#71d7cf',
  progressColor: '#ffcf70',
  cursorColor: '#fff4d6',
  barWidth: 3,
  barGap: 2,
  barRadius: 3,
};

function ShowcaseMediaControls() {
  return <WaveformMediaControls className="demo-waveform-controls" waveformOptions={showcaseWaveform} />;
}

function ManifestHeading() {
  const manifest = useManifest();
  return (
    <h2 className="manifest-heading">
      {manifest?.label ? <LocaleString>{manifest.label}</LocaleString> : 'Loading manifest…'}
    </h2>
  );
}

type Example = { label: string; description: string; url: string };

function ExampleTabs({
  examples,
  selected,
  onSelect,
}: {
  examples: Example[];
  selected: string;
  onSelect(example: Example): void;
}) {
  return (
    <div className="example-tabs" role="tablist" aria-label="Examples">
      {examples.map((example) => (
        <button
          key={example.url}
          type="button"
          role="tab"
          aria-selected={selected === example.url}
          onClick={() => onSelect(example)}
        >
          <strong>{example.label}</strong>
          <span>{example.description}</span>
        </button>
      ))}
    </div>
  );
}

function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="page-heading">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

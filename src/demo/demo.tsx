import type { InputShape } from 'polygon-editor';
import qs from 'query-string';
import { startTransition, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasPanel } from '../canvas-panel';
import { SearchHighlights } from '../canvas-panel/render/SearchHighlights';
import { CombinedMetadata } from '../components/CombinedMetadata';
import { Authenticate } from '../components/future/Authenticate';
import { SearchAutocomplete } from '../components/future/SearchAutocomplete';
import { SearchResults } from '../components/future/SearchResults';
import { ViewChoices } from '../components/future/ViewChoices';
import { Image } from '../components/Image';
import { SequenceThumbnails } from '../components/SequenceThumbnails';
import { RenderSvgEditorControls } from '../components/SvgEditorControls';
import { useAnnotationPageManager } from '../hooks/useAnnotationPageManager';
import { useCanvas } from '../hooks/useCanvas';
// import { render, version } from 'react-dom-16';
// import { render, version } from 'react-dom-17';
import { useManifest } from '../hooks/useManifest';
import { useVault } from '../hooks/useVault';
import { LocaleString } from '../utility/i18n-utils';
import type { SimpleViewerContext } from '../viewers/SimpleViewerContext.types';
import { MediaControls } from './media-controls';
import { SimpleViewerControls, ViewerControls } from './viewer-controls';
import './demo.css';
import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';
import { ImageService } from '../components/ImageService';
import { useCurrentAnnotationActions } from '../hooks/useCurrentAnnotationActions';
import { useCurrentAnnotationArguments } from '../hooks/useCurrentAnnotationArguments';
import { useCurrentAnnotationMetadata } from '../hooks/useCurrentAnnotationMetadata';
import { useCurrentAnnotationTransition } from '../hooks/useCurrentAnnotationTransition';
import { useRequestAnnotation } from '../hooks/useRequestAnnotation';
import { SimpleViewerProvider } from '../viewers/SimpleViewerContext';
import { ComplexTimelineControls } from './complex-timeline-controls';

const runtimeOptions = { maxOverZoom: 5 };
const defaultPreset = ['default-preset', { runtimeOptions }] as any;

function CanvasAnnotations() {
  const canvas = useCanvas();
  const pm = useAnnotationPageManager(canvas?.id);
  const vault = useVault();

  if (!canvas || pm.enabledPageIds.length === 0) {
    return null;
  }

  return (
    <>
      {pm.enabledPageIds.map((id) => (
        <CanvasPanel.RenderAnnotationPage key={id} page={vault.get(id)} />
      ))}
    </>
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

const demo = document.getElementById('root')!;

const components = {
  MediaControls,
  ViewerControls,
  ComplexTimelineControls,
};

const App = () => {
  const [queryString, setQueryString] = useState<{ manifest?: string; range?: string; canvas?: string }>(() =>
    qs.parse(window.location.hash.slice(1)),
  );
  const [enablePolygon, setEnablePolygon] = useState(false);
  const { manifest, range, canvas } = queryString;
  const ref = useRef<SimpleViewerContext>(null);
  const [pagingEnabled, setPagingEnabled] = useState(true);

  useEffect(() => {
    const hashChange = () => {
      setQueryString(qs.parse(window.location.hash.slice(1)));
    };
    window.addEventListener('hashchange', hashChange);

    return () => window.removeEventListener('hashchange', hashChange);
  });

  const [shape, setShape] = useState<InputShape>({ id: 'example', points: [], open: true });

  return (
    <>
      <style>
        {`
            [data-textual-content="true"] {
              background: #fff;
              font-size: 1.2em;
              font-family: system-ui, sans-serif;
              padding: 1em;
              margin-top: 1em;
            }
            * { box-sizing: border-box; }
            .atlas-container { background: #000; }

            body { padding: 0.5em }
        `}
      </style>
      <CanvasPanel
        key={`${manifest}-${range}-${canvas}`}
        ref={ref}
        spacing={20}
        height={800}
        header={<Label />}
        reuseAtlas={true}
        mode={enablePolygon ? 'sketch' : 'explore'}
        pagingEnabled={pagingEnabled}
        // renderPreset={defaultPreset}
        runtimeOptions={runtimeOptions}
        manifest={
          manifest ||
          'https://gist.githubusercontent.com/stephenwf/57cc5024144c53d48cc3c07cc522eb94/raw/a87a5d9a8f949bfb11cebd4f011a204abe8a932b/manifest.json'
        }
        annotationPopup={<AnnotationEditingDemo />}
        startCanvas={canvas}
        components={components}
        annotations={
          <>
            <CanvasAnnotations />
            <SearchHighlights />
          </>
        }
        renderAnnotationContextMenu={() => {
          return <div>This is indeed an annotation</div>;
        }}
        renderContextMenu={({ position }) => {
          return (
            <div className="bg-white p-3 rounded drop-shadow-xl">
              x: {~~position.x}, y: {~~position.y}
            </div>
          );
        }}
      >
        <Authenticate />

        <PolygonRequestAnnotation />

        <div className="flex gap-2 my-4">
          <button
            className="p-2 bg-blue-500 text-white hover:bg-blue-400"
            onClick={() => setPagingEnabled((prev) => !prev)}
          >
            toggle paging
          </button>
          <button
            className="p-2 bg-blue-500 text-white hover:bg-blue-400"
            onClick={() => ref.current?.previousCanvas()}
          >
            prev
          </button>
          <button className="p-2 bg-blue-500 text-white hover:bg-blue-400" onClick={() => ref.current?.nextCanvas()}>
            next
          </button>
        </div>

        <ViewChoices />

        <SequenceThumbnails
          classes={{
            // Grid
            // container: 'grid grid-cols-1 gap-2 overflow-y-auto min-h-0 h-full',
            // row: 'flex gap-2 border border-gray-200 flex-none p-2 m-2',
            // selected: {
            //   row: 'flex gap-2 border border-blue-400 flex-none p-2 m-2 bg-blue-100',
            // },

            // Row
            container: 'flex gap-1 overflow-x-auto',
            row: 'flex gap-2 border border-gray-200 flex-none p-2 m-2',
            img: 'max-h-[128px] max-w-[128px] object-contain h-full w-full',
            selected: {
              row: 'flex gap-2 border border-blue-400 flex-none p-2 m-2 bg-blue-100',
            },
          }}
          fallback={
            <div className="flex items-center justify-center w-32 h-32 bg-gray-200 text-gray-400 select-none">
              No thumb
            </div>
          }
        />

        <SearchAutocomplete />
        <SearchResults />

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
      </CanvasPanel>

      {/* <div>
        <Image
          size={{ width: 256 }}
          src="https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen"
        />
      </div>

      <div style={{ width: 500, position: 'relative' }}>
        <ImageService
          src="https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen/info.json"
          renderViewerControls={SimpleViewerControls}
        />
      </div> */}
    </>
  );
};

function TestA() {
  return (
    <SimpleViewerProvider manifest="https://iiif.archive.org/iiif/3/bim_early-english-books-1641-1700_a-voyage-into-tartary_lepy-heliogenes-de_1689/manifest.json">
      <SequenceThumbnails
        dereference
        classes={{
          // Grid
          // container: 'grid grid-cols-1 gap-2 overflow-y-auto min-h-0 h-full',
          // row: 'flex gap-2 border border-gray-200 flex-none p-2 m-2',
          // selected: {
          //   row: 'flex gap-2 border border-blue-400 flex-none p-2 m-2 bg-blue-100',
          // },

          // Row
          container: 'flex gap-1 overflow-x-auto',
          row: 'flex gap-2 border border-gray-200 flex-none p-2 m-2',
          img: 'max-h-[128px] max-w-[128px] object-contain h-full w-full',
          selected: {
            row: 'flex gap-2 border border-blue-400 flex-none p-2 m-2 bg-blue-100',
          },
        }}
        fallback={
          <div className="flex items-center justify-center w-32 h-32 bg-gray-200 text-gray-400 select-none">
            No thumb
          </div>
        }
      />
    </SimpleViewerProvider>
  );
}

function AnnotationEditingDemo() {
  const { saveAnnotation } = useCurrentAnnotationActions();
  const [metadata, setMetadata] = useCurrentAnnotationMetadata();
  const { customData } = useCurrentAnnotationArguments();

  return (
    <div className="bg-white rounded drop-shadow-md p-4">
      <h3>Annotation editing demo (arg: {customData})</h3>
      <input
        className="p-2 border border-gray-300 rounded"
        type="text"
        placeholder="Add a value..."
        value={metadata.body}
        onChange={(e) => setMetadata({ body: e.target.value })}
      />
      <button
        className="p-2 bg-blue-500 text-white hover:bg-blue-400 data-[active=true]:bg-blue-700"
        onClick={saveAnnotation}
      >
        Save
      </button>
    </div>
  );
}

function PolygonRequestAnnotation() {
  const { requestAnnotation, isPending } = useRequestAnnotation({
    onSuccess: (annotation) => {
      console.log('annotation created!', annotation);
    },
  });
  if (isPending) {
    return (
      <RenderSvgEditorControls
        classNames={{
          button: 'p-2 bg-blue-500 text-white hover:bg-blue-400 data-[active=true]:bg-blue-700',
        }}
      />
    );
  }

  return (
    <div className="flex flex-row gap-2">
      <button
        className="p-2 bg-blue-500 text-white hover:bg-blue-400"
        onClick={() => requestAnnotation({ type: 'box', arguments: { customData: 'Box' } })}
      >
        Create box
      </button>
      <button
        className="p-2 bg-blue-500 text-white hover:bg-blue-400"
        onClick={() => requestAnnotation({ type: 'polygon', arguments: { customData: 'Polygon' } })}
      >
        Create polygon
      </button>
      <button
        className="p-2 bg-blue-500 text-white hover:bg-blue-400"
        onClick={() => requestAnnotation({ type: 'draw', arguments: { customData: 'Polygon' } })}
      >
        Draw
      </button>
      <button
        className="p-2 bg-blue-500 text-white hover:bg-blue-400"
        onClick={() =>
          requestAnnotation({
            type: 'target',
            selector: { x: 100, y: 100, width: 130, height: 200 },
            arguments: { customData: 'Polygon' },
            annotationPopup: <DemoTransitionTracking />,
          })
        }
      >
        Aspect ratio box
      </button>

      <button
        className="p-2 bg-blue-500 text-white hover:bg-blue-400"
        onClick={() =>
          requestAnnotation({
            type: 'box',
            annotationPopup: <CommentUI />,
            svgTheme: {
              shapeFill: '#4E80EE99',
              shapeStroke: '#4E80EE',
              boundingBoxDottedStroke: '#4E80EE',
              boundingBoxStroke: 'none',
              activeLineStroke: '#4E80EE',
              lineStroke: '#4E80EE',
            },
          })
        }
      >
        Comment
      </button>

      <button
        className="p-2 bg-blue-500 text-white hover:bg-blue-400"
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
        Edit existing
      </button>
    </div>
  );
}

function DemoTransitionTracking() {
  useCurrentAnnotationTransition({
    onStart: (type) => console.log('start', type),
    onEnd: (type) => console.log('end', type),
    onTransition: (type) => console.log('transition', type),
  });
  return null;
}

function CommentUI() {
  const { saveAnnotation, cancelRequest } = useCurrentAnnotationActions();
  const [metadata, setMetadata] = useCurrentAnnotationMetadata();

  return (
    <div className="bg-white rounded drop-shadow-md p-4 w-96">
      <h3 className="text-lg font-bold mb-2">Write a comment</h3>
      <textarea
        className="p-2 border border-gray-300 rounded w-full mb-2"
        rows={4}
        placeholder="Write a comment"
        value={metadata.comment}
        onChange={(e) => setMetadata({ comment: e.target.value })}
      />
      <div className="flex gap-2 justify-end">
        <button
          className="px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-400 data-[active=true]:bg-blue-700"
          onClick={() => cancelRequest()}
        >
          Cancel
        </button>
        <button
          className="px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-400 data-[active=true]:bg-blue-700"
          onClick={saveAnnotation}
        >
          Save comment
        </button>
      </div>
    </div>
  );
}

// React 18 testing
const root = createRoot(demo);
root.render(<App />);

// React 16/17 testing
// render(toRender, demo);

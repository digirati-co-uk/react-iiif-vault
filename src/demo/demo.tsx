import { createRoot } from 'react-dom/client';
// import { render, version } from 'react-dom-16';
// import { render, version } from 'react-dom-17';
import { useManifest } from '../hooks/useManifest';
import { LocaleString } from '../utility/i18n-utils';
import { CanvasPanel } from '../canvas-panel';
import { MediaControls } from './media-controls';
import { ViewerControls } from './viewer-controls';
import { useEffect, useRef, useState } from 'react';
import qs from 'query-string';
import { useCanvas } from '../hooks/useCanvas';
import { useAnnotationPageManager } from '../hooks/useAnnotationPageManager';
import { useVault } from '../hooks/useVault';
import { SimpleViewerContext } from '../viewers/SimpleViewerContext.types';
import { CombinedMetadata } from '../components/CombinedMetadata';
import { Image } from '../components/Image';
import { SequenceThumbnails } from '../components/SequenceThumbnails';
import { SingleCanvasThumbnail } from '../components/SingleCanvasThumbnail';
import { Authenticate } from '../components/future/Authenticate';
import { SearchAutocomplete } from '../components/future/SearchAutocomplete';
import { SearchResults } from '../components/future/SearchResults';
import { SearchHighlights } from '../canvas-panel/render/SearchHighlights';
import { RenderSvgEditorControls } from '../components/SvgEditorControls';
import { InputShape } from 'polygon-editor';
import './demo.css';
import { PolygonSelector } from '../components/annotations/PolygonSelector';

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
};

const App = () => {
  const [queryString, setQueryString] = useState<{ manifest?: string; range?: string; canvas?: string }>(() =>
    qs.parse(window.location.hash.slice(1))
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
        header={<Label />}
        reuseAtlas={true}
        mode={enablePolygon ? 'sketch' : 'explore'}
        pagingEnabled={pagingEnabled}
        manifest={
          manifest ||
          'https://gist.githubusercontent.com/stephenwf/57cc5024144c53d48cc3c07cc522eb94/raw/a87a5d9a8f949bfb11cebd4f011a204abe8a932b/manifest.json'
        }
        startCanvas={canvas}
        components={components}
        annotations={
          <>
            <CanvasAnnotations />
            <SearchHighlights />
            <PolygonSelector
              id="example"
              polygon={shape}
              updatePolygon={setShape}
              readOnly={!enablePolygon}
              annotationBucket="default"
              renderControls={(helper, state, showShapes) => (
                <div className="flex gap-2">
                  <RenderSvgEditorControls
                    classNames={{
                      button: 'p-2 bg-blue-500 text-white hover:bg-blue-400',
                    }}
                    helper={helper}
                    state={state}
                    showShapes={showShapes}
                  />
                </div>
              )}
            />
          </>
        }
      >
        <Authenticate />

        <button
          className="p-2 bg-blue-500 text-white hover:bg-blue-400"
          onClick={() => setEnablePolygon((prev) => !prev)}
        >
          {enablePolygon ? 'Disable' : 'Enable'} Polygon
        </button>

        {enablePolygon ? <div id="atlas-controls"></div> : null}

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

      <div>
        <Image
          size={{ width: 256 }}
          src="https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen"
        />
      </div>
    </>
  );
};

// React 18 testing
const root = createRoot(demo);
root.render(<App />);

// React 16/17 testing
// render(toRender, demo);

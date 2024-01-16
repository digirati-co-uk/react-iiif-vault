import { createRoot } from 'react-dom/client';
// import { render, version } from 'react-dom-16';
// import { render, version } from 'react-dom-17';
import { VaultProvider } from '../context/VaultContext';
import { SimpleViewerProvider, useSimpleViewer } from '../viewers/SimpleViewerContext';
import { useManifest } from '../hooks/useManifest';
import { LocaleString } from '@iiif/vault-helpers/react-i18next';
import { CanvasPanel } from '../canvas-panel';
import { CanvasContext } from '../context/CanvasContext';
import { MediaControls } from './media-controls';
import { ViewerControls } from './viewer-controls';
import { useVisibleCanvases } from '../context/VisibleCanvasContext';
import { useEffect, useMemo, useState } from 'react';
import { parse } from 'query-string';
import { useLoadImageService } from '../hooks/useLoadImageService';

function Demo() {
  const manifest = useManifest();
  const canvases = useVisibleCanvases();
  const { nextCanvas, previousCanvas } = useSimpleViewer();

  if (!manifest) {
    return <div>Loading..</div>;
  }

  let accumulator = 0;

  return (
    <>
      <LocaleString as="h2">{manifest.label}</LocaleString>
      <CanvasPanel.Viewer height={600}>
        {canvases.map((canvas, idx) => {
          const margin = accumulator;
          accumulator += canvas.width;
          return (
            <CanvasContext canvas={canvas.id} key={canvas.id}>
              <CanvasPanel.RenderCanvas
                key={canvas.id}
                strategies={['3d-model', 'media', 'images']}
                renderViewerControls={idx === 0 ? () => <ViewerControls /> : undefined}
                renderMediaControls={idx === 0 ? () => <MediaControls /> : undefined}
                x={margin}
              />
            </CanvasContext>
          );
        })}
      </CanvasPanel.Viewer>
      <div style={{ display: 'flex' }}>
        <button onClick={previousCanvas}>prev</button>
        <button onClick={nextCanvas}>next</button>
      </div>
    </>
  );
}

const demo = document.getElementById('root')!;

function TestService({ src }: { src: string }) {
  const [loadImageService, status] = useLoadImageService();

  const image = useMemo(() => {
    return loadImageService({ id: src } as any, {} as any);
  }, [loadImageService, src, status]);

  return (
    <div>
      <pre>{JSON.stringify(image)}</pre>
    </div>
  );
}

const App = () => {
  const [queryString, setQueryString] = useState<{ manifest?: string; range?: string; canvas?: string }>(() =>
    parse(window.location.hash.slice(1))
  );
  const { manifest, range, canvas } = queryString;

  useEffect(() => {
    const hashChange = () => {
      setQueryString(parse(window.location.hash.slice(1)));
    };
    window.addEventListener('hashchange', hashChange);

    return () => window.removeEventListener('hashchange', hashChange);
  });

  return (
    <VaultProvider>
      <SimpleViewerProvider
        pagingEnabled={true}
        startCanvas={canvas}
        rangeId={range}
        manifest={
          manifest ||
          'https://gist.githubusercontent.com/stephenwf/57cc5024144c53d48cc3c07cc522eb94/raw/a87a5d9a8f949bfb11cebd4f011a204abe8a932b/manifest.json'
        }
      >
        <Demo />
      </SimpleViewerProvider>
      <div>
        <TestService src="https://media.getty.edu/iiif/image/d915e1a9-8dab-49de-8be1-c29b2228e0bf" />
        <TestService src="https://media.getty.edu/iiif/image/2efd825f-41fe-4f93-b928-f25644c67b23" />
        <TestService src="https://media.getty.edu/iiif/image/90049c0d-bfd0-4ee9-8b32-70e45597bf5c" />
        <TestService src="https://media.getty.edu/iiif/image/f21dbf12-d3b0-4019-814a-61962df5ca77" />
      </div>
    </VaultProvider>
  );
};

// React 18 testing
const root = createRoot(demo);
root.render(<App />);

// React 16/17 testing
// render(toRender, demo);

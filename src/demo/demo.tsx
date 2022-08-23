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
import { useEffect, useState } from 'react';
import { parse } from 'query-string';

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
    </VaultProvider>
  );
};

// React 18 testing
const root = createRoot(demo);
root.render(<App />);

// React 16/17 testing
// render(toRender, demo);

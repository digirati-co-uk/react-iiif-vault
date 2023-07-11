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
import { useEffect, useRef, useState } from 'react';
import { parse } from 'query-string';
import { SimpleViewerContext } from '../viewers/SimpleViewerContext.types';

function Label() {
  const manifest = useManifest();

  if (!manifest) {
    return <div>Loading..</div>;
  }

  return <LocaleString as="h2">{manifest.label}</LocaleString>;
}

const demo = document.getElementById('root')!;

const components = {
  MediaControls,
  ViewerControls,
};

const App = () => {
  const [queryString, setQueryString] = useState<{ manifest?: string; range?: string; canvas?: string }>(() =>
    parse(window.location.hash.slice(1))
  );
  const { manifest, range, canvas } = queryString;
  const ref = useRef<SimpleViewerContext>(null);

  useEffect(() => {
    const hashChange = () => {
      setQueryString(parse(window.location.hash.slice(1)));
    };
    window.addEventListener('hashchange', hashChange);

    return () => window.removeEventListener('hashchange', hashChange);
  });

  return (
    <CanvasPanel
      key={`${manifest}-${range}-${canvas}`}
      ref={ref}
      spacing={20}
      header={<Label />}
      manifest={
        manifest ||
        'https://gist.githubusercontent.com/stephenwf/57cc5024144c53d48cc3c07cc522eb94/raw/a87a5d9a8f949bfb11cebd4f011a204abe8a932b/manifest.json'
      }
      components={components}
    >
      <div style={{ display: 'flex' }}>
        <button onClick={() => ref.current?.previousCanvas()}>prev</button>
        <button onClick={() => ref.current?.nextCanvas()}>next</button>
      </div>
    </CanvasPanel>
  );
};

// React 18 testing
const root = createRoot(demo);
root.render(<App />);

// React 16/17 testing
// render(toRender, demo);

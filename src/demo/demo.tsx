import { createRoot } from 'react-dom/client';
// import { render, version } from 'react-dom-16';
// import { render, version } from 'react-dom-17';
import { VaultProvider } from '../context/VaultContext';
import { SimpleViewerProvider, useSimpleViewer } from '../viewers/SimpleViewerContext';
import { useManifest } from '../hooks/useManifest';
import { LocaleString } from '../utility/i18n-utils';
import { CanvasPanel } from '../canvas-panel';
import { CanvasContext } from '../context/CanvasContext';
import { MediaControls } from './media-controls';
import { ViewerControls } from './viewer-controls';
import { useVisibleCanvases } from '../context/VisibleCanvasContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parse } from 'query-string';
import { useCanvas } from '../hooks/useCanvas';
import { useAnnotationPageManager } from '../hooks/useAnnotationPageManager';
import { useVault } from '../hooks/useVault';
import { useMode, HTMLPortal } from '@atlas-viewer/atlas';
import { SimpleViewerContext } from '../viewers/SimpleViewerContext.types';

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
        `}
      </style>
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
        annotations={<CanvasAnnotations />}
      >
        <div style={{ display: 'flex' }}>
          <button onClick={() => ref.current?.previousCanvas()}>prev</button>
          <button onClick={() => ref.current?.nextCanvas()}>next</button>
        </div>
      </CanvasPanel>
    </>
  );
};

// React 18 testing
const root = createRoot(demo);
root.render(<App />);

// React 16/17 testing
// render(toRender, demo);

import { createRoot } from 'react-dom/client';
// import { render, version } from 'react-dom-16';
// import { render, version } from 'react-dom-17';
import { VaultProvider } from '../context/VaultContext';
import { SimpleViewerProvider, useSimpleViewer } from '../viewers/SimpleViewerContext';
import { useManifest } from '../hooks/useManifest';
import { LocaleString } from '@iiif/vault-helpers/react-i18next';
import { CanvasPanel } from '../canvas-panel';
import { useCanvas } from '../hooks/useCanvas';
import { CanvasContext } from '../context/CanvasContext';
import { MediaControls } from './media-controls';
import { ViewerControls } from './viewer-controls';

function Demo() {
  const manifest = useManifest();
  const canvas = useCanvas();
  const { nextCanvas, previousCanvas } = useSimpleViewer();

  if (!manifest) {
    return <div>Loading..</div>;
  }

  return (
    <>
      <LocaleString as="h2">{manifest.label}</LocaleString>
      {canvas ? (
        <CanvasPanel.Viewer height={600}>
          <CanvasContext canvas={canvas.id} key={canvas.id}>
            <CanvasPanel.RenderCanvas
              strategies={['3d-model', 'media', 'images']}
              renderViewerControls={() => <ViewerControls />}
              renderMediaControls={() => <MediaControls />}
            />
          </CanvasContext>
        </CanvasPanel.Viewer>
      ) : null}
      <div style={{ display: 'flex' }}>
        <button onClick={previousCanvas}>prev</button>
        <button onClick={nextCanvas}>next</button>
      </div>
    </>
  );
}

const demo = document.getElementById('root')!;
const toRender = (
  <VaultProvider>
    <SimpleViewerProvider
      manifest={
        'https://gist.githubusercontent.com/stephenwf/57cc5024144c53d48cc3c07cc522eb94/raw/a87a5d9a8f949bfb11cebd4f011a204abe8a932b/manifest.json'
      }
    >
      <Demo />
    </SimpleViewerProvider>
  </VaultProvider>
);

// React 18 testing
const root = createRoot(demo);
root.render(toRender);

// React 16/17 testing
// render(toRender, demo);

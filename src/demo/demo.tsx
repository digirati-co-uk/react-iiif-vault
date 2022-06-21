import { createRoot } from 'react-dom/client';
import { VaultProvider } from '../context/VaultContext';
import { SimpleViewerProvider, useSimpleViewer } from '../viewers/SimpleViewerContext';
import { useManifest } from '../hooks/useManifest';
import { getValue } from '@iiif/vault-helpers';
import { CanvasPanel } from '../canvas-panel';
import { useCanvas } from '../hooks/useCanvas';
import { CanvasContext } from '../context/CanvasContext';
import { MediaControls } from './media-controls';

function Demo() {
  const manifest = useManifest();
  const canvas = useCanvas();
  const { nextCanvas, previousCanvas } = useSimpleViewer();

  if (!manifest) {
    return <div>Loading..</div>;
  }

  return (
    <>
      <h2>{getValue(manifest.label)}</h2>
      {canvas ? (
        <CanvasPanel.Viewer height={600}>
          <CanvasContext canvas={canvas.id} key={canvas.id}>
            <CanvasPanel.RenderCanvas renderMediaControls={() => <MediaControls />} />
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
const root = createRoot(demo);

root.render(
  <VaultProvider>
    <SimpleViewerProvider
      manifest={
        // 'https://gist.githubusercontent.com/stephenwf/57cc5024144c53d48cc3c07cc522eb94/raw/a87a5d9a8f949bfb11cebd4f011a204abe8a932b/manifest.json'
        'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/manifest.json'
      }
    >
      <Demo />
    </SimpleViewerProvider>
  </VaultProvider>
);

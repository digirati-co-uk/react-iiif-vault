import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasPanel } from '../canvas-panel';
import { RegionHighlight } from '../canvas-panel/components/RegionHighlight';
import { AtlasStoreProvider } from '../canvas-panel/context/atlas-store-provider';
import { VaultProvider } from '../context/VaultContext';
import { useAnnotationViewportTour } from '../hooks/useAnnotationViewportTour';
import { useVault } from '../hooks/useVault';
import type { Transition } from '../utility/viewport';
import type { SimpleViewerContext } from '../viewers/SimpleViewerContext.types';

const RegionHighlightAny = RegionHighlight as any;

export function FullPage() {
  const vault = useVault();
  const ref = useRef<SimpleViewerContext>(null);
  const [viewer, setViewer] = useState<SimpleViewerContext | null>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);

  const state = useRef({ viewportHeight: 0 });

  const canvas = useMemo(() => {
    if (!viewer) return null;

    const seq = viewer.sequence[viewer.currentSequenceIndex];
    return vault.get(viewer.items[seq[0]]);
  }, [viewer]);

  const annotations = useMemo(() => {
    const pageRef = canvas?.annotations[0];
    const page = pageRef ? vault.get(pageRef) : null;
    return page ? vault.get(page.items) : [];
  }, [canvas]);

  const initial = useMemo(() => ({ x: 0, y: 0, width: canvas?.width || 0, height: canvas?.height || 0 }), [canvas]);

  const { regions, tour } = useAnnotationViewportTour({
    initial,
    annotations,
    containerRef: container,
    enabled: !!canvas,
    padding: 40,
  });

  return (
    <div>
      <div className="relative snap-proximity snap-y" ref={container} style={{ maxHeight: '100vh', overflowY: 'auto' }}>
        <div className="relative z-20 top-0">
          <div className="h-[100vh] snap-center" />
          {regions.map((region, n) => {
            return (
              <div
                className="z-20 snap-center border-red border flex items-center p-8"
                key={n}
                style={{ height: `100vh` }}
              >
                <div className="bg-white w-[400px] h-[400px] rounded-lg shadow-xl p-4">
                  <h1>Testing {n}</h1>
                  <p>testing testing</p>
                  <p>testing testing</p>
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="fixed top-0 left-0 w-full h-full right-0 pointer-events-none flex z-10"
          style={{ height: '100vh' }}
        >
          <CanvasPanel
            ref={setViewer}
            spacing={20}
            height={window.innerHeight}
            reuseAtlas={true}
            padding={{ left: 420 }}
            // manifest={'https://iiif.vam.ac.uk/collections/O134051/manifest.json'}
            manifest="https://stephenwf.github.io/ocean-liners.json"
            annotations={
              <>
                {tour.currentTransition?.to && (
                  <RegionHighlightAny
                    isEditing={false}
                    id="highlight"
                    region={tour.currentTransition.to as any}
                    style={{ border: '3px solid red' }}
                  />
                )}
                {tour.currentTransition?.from && (
                  <RegionHighlightAny
                    isEditing={false}
                    id="highlight-from"
                    region={tour.currentTransition.from as any}
                    style={{ border: '3px solid green' }}
                  />
                )}
              </>
            }
          >
            {/* ...  */}
          </CanvasPanel>
        </div>
      </div>
      <h1>Something under that you can still read</h1>
      <p>test test test</p>
      <p>test test test</p>
      <p>test test test</p>
      <p>test test test</p>
      <p>test test test</p>
      <p>test test test</p>
      <p>test test test</p>
      <p>test test test</p>
    </div>
  );
}

const demo = document.getElementById('root')!;
// React 18 testing
const root = createRoot(demo);
root.render(
  <VaultProvider>
    <AtlasStoreProvider>
      <FullPage />
    </AtlasStoreProvider>
  </VaultProvider>,
);

import { expandTarget } from '@iiif/helpers';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasPanel } from '../canvas-panel';
import { RegionHighlight } from '../canvas-panel/components/RegionHighlight';
import { AtlasStoreProvider } from '../canvas-panel/context/atlas-store-provider';
import { VaultProvider } from '../context/VaultContext';
import { useVault } from '../hooks/useVault';
import { useViewportPoints } from '../hooks/useViewportPoints';
import type { SimpleViewerContext } from '../viewers/SimpleViewerContext.types';

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

  const targets = useMemo(() => {
    return annotations.map((annotation) => {
      const supportedTarget = expandTarget(annotation.target as any);

      return {
        id: annotation.id,
        ...(supportedTarget.selector?.spatial || {}),
      };
    });
  }, [annotations]);

  const { current, regions } = useViewportPoints({
    enabled: !!canvas,
    getProgress: () => {
      if (!state.current.viewportHeight) return 0;

      return (container.current?.scrollTop || 0) / state.current.viewportHeight;
    },
    initial: {
      height: canvas?.width || 0,
      width: canvas?.height || 0,
    },
    regions: targets as any,
  });

  useLayoutEffect(() => {
    state.current.viewportHeight = document.documentElement.clientHeight;
  }, []);

  return (
    <div>
      <div className="relative" ref={container} style={{ maxHeight: '100vh', overflowY: 'auto' }}>
        <div
          className="absolute top-0 left-0 w-full h-full right-0 pointer-events-none flex sticky"
          style={{ height: '100vh' }}
        >
          <CanvasPanel
            ref={setViewer}
            spacing={20}
            height={document.documentElement.clientHeight}
            reuseAtlas={true}
            manifest={'https://iiif.vam.ac.uk/collections/O134051/manifest.json'}
            // manifest="https://stephenwf.github.io/ocean-liners.json"
            annotations={
              <>
                {current?.to && (
                  <RegionHighlight id="highlight" region={current?.to} style={{ border: '3px solid red' }} />
                )}
                {current?.from && (
                  <RegionHighlight id="highlight-from" region={current?.from} style={{ border: '3px solid green' }} />
                )}
              </>
            }
          >
            {/* ...  */}
          </CanvasPanel>
        </div>
        <div style={{ height: `${regions.length * 100}vh` }} />
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

function AnnotationsTour() {
  return (
    <>
      {current?.to && <RegionHighlight id="highlight" region={current?.to} style={{ border: '3px solid red' }} />}
      {current?.from && (
        <RegionHighlight id="highlight-from" region={current?.from} style={{ border: '3px solid green' }} />
      )}
    </>
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

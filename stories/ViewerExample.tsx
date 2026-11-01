import mitt from 'mitt';
import { EventEmitterProvider } from '../src/hooks/useEvent';
import type { AtlasStoreEvents } from '../src/canvas-panel/context/atlas-store';
import { HTMLPortal } from '@atlas-viewer/atlas';
import type { InputShape } from 'polygon-editor';
import { useStore } from 'zustand';
import { useAtlasStore } from '../src/canvas-panel/context/atlas-store-provider';
import { useVisibleCanvases } from '../src/context/VisibleCanvasContext';
import { PolygonPreview } from '../src/components/annotations/PolygonPreview';
import { useSvgEditorControls } from '../src/hooks/useSvgEditorControls';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Vault } from '@iiif/helpers/vault';
import { CanvasPanel } from '../src/canvas-panel';
import { VaultProvider } from '../src/context/VaultContext';
import { SequenceThumbnails } from '../src/components/SequenceThumbnails';
import { ManifestMetadata } from '../src/components/ManifestMetadata';
import { useCanvas } from '../src/hooks/useCanvas';
import { useVault } from '../src/hooks/useVault';
import { useAnnotationPageManager } from '../src/hooks/useAnnotationPageManager';
import { useRequestAnnotation } from '../src/hooks/useRequestAnnotation';
import { RenderSvgEditorControls } from '../src/components/SvgEditorControls';
import { ViewerControls } from '../src/demo/viewer-controls';
import { MediaControls } from '../src/demo/media-controls';
import type { SimpleViewerContext } from '../src/viewers/SimpleViewerContext.types';
import { readingManifest } from './fixtures';

function Notes() {
  const canvas = useCanvas();
  const vault = useVault();
  const pages = useAnnotationPageManager(canvas?.id);
  useEffect(() => {
    for (const id of pages.availablePageIds) pages.setPageEnabled(id, { deselectOthers: false });
  }, [canvas?.id]);
  return (
    <>
      {pages.enabledPageIds.map((id) => (
        <CanvasPanel.RenderAnnotationPage key={id} page={vault.get(id)} />
      ))}
    </>
  );
}
type SavedDrawing = { canvasId: string; shape: InputShape };
function SavedDrawingOverlay({ drawing, onUpdate }: { drawing: SavedDrawing; onUpdate: (shape: InputShape) => void }) {
  const canvas = useCanvas();
  const { requestAnnotation } = useRequestAnnotation();
  const editing = useStore(useAtlasStore(), (s) => s.tool.enabled);
  if (!canvas || canvas.id !== drawing.canvasId || editing) return null;
  const edit = async () => {
    const result = await requestAnnotation(
      { type: 'polygon', noBox: true, ...drawing.shape },
      { canvasId: canvas.id, toolId: 'pointer' }
    );
    if (result?.polygon && !result.cancelled) onUpdate(result.polygon);
  };
  return (
    <HTMLPortal relative interactive>
      <PolygonPreview shape={drawing.shape} image={canvas} onClick={() => void edit()} className="saved-drawing" />
    </HTMLPortal>
  );
}
function DrawingTools({ onSave }: { onSave: (drawing: SavedDrawing) => void }) {
  const canvas = useVisibleCanvases()[0];
  const { requestAnnotation, isActive, busy, requestId } = useRequestAnnotation();
  const editing = useStore(useAtlasStore(), (s) => s.tool.enabled);
  const controls = useSvgEditorControls();
  return (
    <div className="toolbar">
      <button
        disabled={!requestId || !canvas || isActive || busy}
        onClick={() =>
          void requestAnnotation(
            { type: 'polygon', noBox: true, open: true, points: [] },
            { canvasId: canvas?.id }
          ).then((result) => {
            if (result?.polygon && !result.cancelled && canvas) onSave({ canvasId: canvas.id, shape: result.polygon });
          })
        }
      >
        Draw an annotation
      </button>
      <RenderSvgEditorControls
        editing={{
          history: true,
          finish: true,
          curves: true,
          snapping: true,
          selection: true,
          boxPlacement: true,
          status: true,
        }}
      />
      <button disabled={!editing} onClick={() => controls.cancelRequest()}>
        Discard drawing
      </button>
    </div>
  );
}

export interface ViewerExampleProps {
  kind?: 'images' | 'text' | 'audio';
  direction?: 'left-to-right' | 'right-to-left';
  paging?: boolean;
  metadata?: boolean;
  annotations?: boolean;
  editing?: boolean;
  rotation?: number;
  manifestUrl?: string;
}
export function ViewerExample({
  kind = 'images',
  direction = 'left-to-right',
  paging = false,
  metadata,
  annotations,
  editing,
  rotation = 0,
  manifestUrl,
}: ViewerExampleProps) {
  const viewer = useRef<SimpleViewerContext>(null);
  const [drawings, setDrawings] = useState<SavedDrawing[]>([]);
  const { vault, id, events } = useMemo(() => {
    const vault = new Vault();
    const manifest = readingManifest(window.location.origin, kind, direction);
    vault.loadSync(manifest.id, manifest as any);
    return { vault, id: manifest.id, events: mitt<AtlasStoreEvents>() };
  }, [kind, direction]);
  return (
    <section className="vault-story">
      <h1>
        {kind === 'audio' ? 'Listen to a recording' : kind === 'text' ? 'Read textual content' : 'Explore the notebook'}
      </h1>
      <p>
        {kind === 'audio'
          ? 'Play the quiet six-second tone, pause, seek, and adjust the volume. This media fixture is served locally.'
          : kind === 'text'
            ? 'The viewer chooses a text renderer for a canvas painted with a TextualBody.'
            : 'Zoom into the page, use Home to return, and browse pages using the navigation or thumbnails.'}
        {editing
          ? ' Draw and save a region, then hover to highlight it or click it to edit again. Regions stay in this demo until the story reloads.'
          : ''}
        {manifestUrl ? ' This Live example needs an internet connection.' : ''}
      </p>
      <EventEmitterProvider emitter={events}>
        <VaultProvider vault={vault}>
          <CanvasPanel
            ref={viewer}
            manifest={manifestUrl || id}
            height={480}
            spacing={20}
            pagingEnabled={paging}
            rotation={rotation}
            reuseAtlas={false}
            components={{ ViewerControls, MediaControls }}
            annotations={
              <>
                {annotations && <Notes />}
                {drawings.map((drawing, index) => (
                  <SavedDrawingOverlay
                    key={index}
                    drawing={drawing}
                    onUpdate={(shape) =>
                      setDrawings((items) => items.map((item, i) => (i === index ? { ...item, shape } : item)))
                    }
                  />
                ))}
              </>
            }
          >
            {editing && <DrawingTools onSave={(drawing) => setDrawings((items) => [...items, drawing])} />}
            <div className="toolbar">
              <button onClick={() => viewer.current?.previousCanvas()}>Previous page</button>
              <button onClick={() => viewer.current?.nextCanvas()}>Next page</button>
            </div>
            <SequenceThumbnails showLabel size={{ width: 130 }} classes={{ container: 'thumbs' }} />
            {metadata && <ManifestMetadata />}
          </CanvasPanel>
        </VaultProvider>
      </EventEmitterProvider>
    </section>
  );
}

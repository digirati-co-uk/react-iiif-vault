import mitt from 'mitt';
import { EventEmitterProvider } from '../src/hooks/useEvent';
import type { AtlasStoreEvents } from '../src/canvas-panel/context/atlas-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Vault } from '@iiif/helpers/vault';
import { HTMLPortal } from '@atlas-viewer/atlas';
import type { InputShape } from 'polygon-editor';
import { useStore } from 'zustand';
import { CanvasPanel } from '../src/canvas-panel';
import { VaultProvider } from '../src/context/VaultContext';
import { useVisibleCanvases } from '../src/context/VisibleCanvasContext';
import { useCanvas } from '../src/hooks/useCanvas';
import { useRequestAnnotation } from '../src/hooks/useRequestAnnotation';
import { useSvgEditorControls } from '../src/hooks/useSvgEditorControls';
import { useAtlasStore, AtlasStoreProvider } from '../src/canvas-panel/context/atlas-store-provider';
import { RenderSvgEditorControls } from '../src/components/SvgEditorControls';
import { PolygonPreview } from '../src/components/annotations/PolygonPreview';
import { ViewerControls } from '../src/demo/viewer-controls';
import { readingManifest } from './fixtures';
import type { EditorExampleProps } from './EditorExample';
import type { LiveExample } from './iiif-examples';

export interface AtlasEditorExampleProps extends EditorExampleProps {
  source?: LiveExample;
}

// Sample regions are authored on a 600 × 400 reference page; controls are relative vectors.
function fitShape(shape: InputShape, width: number, height: number): InputShape {
  return {
    ...shape,
    points: shape.points.map(
      (point) => point.map((value, i) => value * (i % 2 ? height / 400 : width / 600)) as typeof point
    ),
  };
}
function SavedRegion({ shape, canvasId }: { shape: InputShape | null; canvasId?: string }) {
  const canvas = useCanvas();
  if (!canvas || !shape || (canvasId && canvas.id !== canvasId)) return null;
  return (
    <HTMLPortal relative interactive={false}>
      <PolygonPreview shape={shape} image={canvas} />
    </HTMLPortal>
  );
}
function EditingTools({
  onSaved,
  ...props
}: AtlasEditorExampleProps & { onSaved: (shape: InputShape | null) => void }) {
  const canvases = useVisibleCanvases();
  const canvas = canvases.find((item) => item.id === props.source?.canvas) || canvases[0];
  const store = useAtlasStore();
  const shape = useStore(store, (s) => s.polygon);
  const ready = useStore(store, (s) => !!canvas && !!s.canvasRelativePositions[canvas.id]);
  const { requestAnnotation, requestId, isActive, data } = useRequestAnnotation();
  const controls = useSvgEditorControls();
  const started = useRef(false);
  const [saved, setSaved] = useState<InputShape | null>(null);
  function begin() {
    if (!canvas) return;
    onSaved(null);
    const initial = saved || fitShape(props.shape || { open: true, points: [] }, canvas.width, canvas.height);
    const editor = {
      ...props.options,
      snap: props.options?.snap
        ? {
            ...props.options.snap,
            sources: props.options.snap.sources?.map((source) => fitShape(source, canvas.width, canvas.height)),
          }
        : undefined,
    };
    void requestAnnotation(
      {
        type: 'polygon',
        noBox: true,
        ...initial,
        bounds: props.bounded === false ? null : { x: 0, y: 0, width: canvas.width, height: canvas.height },
        editor,
        svgOptions: props.svgOptions,
        svgTheme: props.theme,
        annotationPopup: <></>,
      },
      { canvasId: canvas.id, toolId: props.tool || 'pen' }
    ).then((result) => {
      if (result && !result.cancelled && result.polygon) {
        setSaved(result.polygon);
        onSaved(result.polygon);
      }
    });
    if (!initial.open) store.getState().polygons.tools.clearSelection();
    store.getState().polygons.clock.flush();
  }
  useEffect(() => {
    if (!requestId || !ready || started.current) return;
    const frame = requestAnimationFrame(() => {
      started.current = true;
      begin();
    });
    return () => cancelAnimationFrame(frame);
  }, [requestId, ready]);

  return (
    <>
      <div className="toolbar" aria-label="Editing tools">
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
        <button disabled={!isActive} onClick={() => controls.completeRequest()}>
          Save annotation
        </button>
        <button disabled={!isActive} onClick={() => controls.cancelRequest()}>
          Discard
        </button>
        <button disabled={isActive || !requestId} onClick={begin}>
          Start again
        </button>
      </div>
      <p className="status" role="status">
        {isActive
          ? 'Changes stay editable until you save. Use Hand to pan and zoom; return to a drawing tool to edit.'
          : data
            ? 'Editing finished. Start again to make another change.'
            : 'Loading the IIIF canvas…'}
      </p>
      <details>
        <summary>Geometry and saved annotation</summary>
        <pre data-testid="geometry">{JSON.stringify({ current: shape, saved }, null, 2)}</pre>
      </details>
    </>
  );
}

export function AtlasEditorExample(props: AtlasEditorExampleProps) {
  const [saved, setSaved] = useState<InputShape | null>(null);
  const { vault, id, events } = useMemo(() => {
    const vault = new Vault();
    const manifest = readingManifest(window.location.origin, 'images', 'left-to-right');
    vault.loadSync(manifest.id, manifest as any);
    return { vault, id: manifest.id, events: mitt<AtlasStoreEvents>() };
  }, []);
  return (
    <section className="vault-story" style={{ maxWidth: props.width || 1120 }}>
      <h1>{props.title || 'Annotate a IIIF canvas'}</h1>
      <p>{props.instructions || 'Place points on the page, finish the shape, then save the annotation.'}</p>
      {props.source && (
        <p>
          Live IIIF: {props.source.label} — {props.source.credit}.{' '}
          <a href={props.source.manifest}>Institutional manifest</a>
          {props.source.rights && (
            <>
              {' '}
              · <a href={props.source.rights}>Rights and reuse</a>
            </>
          )}
          . Requires an internet connection. Drawings are local demonstrations and are not saved to the institution.
        </p>
      )}
      <EventEmitterProvider emitter={events}>
        <VaultProvider vault={vault}>
          <AtlasStoreProvider name="" atlasStoreConfig={{ polygonOptions: props.options }}>
            <CanvasPanel
              manifest={props.source?.manifest || id}
              startCanvas={props.source?.canvas}
              height={480}
              reuseAtlas={false}
              components={{ ViewerControls }}
              annotations={<SavedRegion shape={saved} canvasId={props.source?.canvas} />}
            >
              <EditingTools {...props} onSaved={setSaved} />
            </CanvasPanel>
          </AtlasStoreProvider>
        </VaultProvider>
      </EventEmitterProvider>
    </section>
  );
}

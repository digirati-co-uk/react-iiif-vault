import mitt from 'mitt';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useStore } from 'zustand';
import type { InputShape } from 'polygon-editor';
import { createAtlasStore, type AtlasStoreEvents, type AtlasStore } from '../src/canvas-panel/context/atlas-store';
import { AtlasStoreProvider } from '../src/canvas-panel/context/atlas-store-provider';
import { EventEmitterProvider } from '../src/hooks/useEvent';
import { useSvgEditor, type SvgEditorOptions, type SVGTheme } from '../src/hooks/useSvgEditor';
import { useSvgEditorControls } from '../src/hooks/useSvgEditorControls';
import { usePolygonInput } from '../src/hooks/usePolygonInput';
import { RenderSvgEditorControls } from '../src/components/SvgEditorControls';
import { polygonPath } from '../src/utility/polygon-path';
import type { PolygonEditorDefaults } from '../src/utility/polygon-editor-options';

export const triangle: InputShape = {
  open: false,
  points: [
    [100, 100],
    [440, 120],
    [270, 320],
  ],
};
export const curved: InputShape = {
  open: false,
  points: [
    [100, 200, 20, -180, 300, -180],
    [450, 200],
    [300, 330],
  ],
};
const empty: InputShape = { open: true, points: [] };
export interface EditorExampleProps {
  title?: string;
  instructions?: string;
  shape?: InputShape;
  tool?: keyof AtlasStore['switchTool'];
  options?: PolygonEditorDefaults;
  svgOptions?: Omit<SvgEditorOptions, 'image' | 'onChange'>;
  theme?: Partial<SVGTheme>;
  bounded?: boolean;
  width?: number;
}

export function EditorExample(props: EditorExampleProps) {
  const bundle = useMemo(() => {
    const events = mitt<AtlasStoreEvents>();
    return {
      events,
      store: createAtlasStore({ events, polygonOptions: props.options, keyboardShortcutsEnabled: true }),
    };
  }, []);
  return (
    <EventEmitterProvider emitter={bundle.events}>
      <AtlasStoreProvider existing={bundle.store} name="">
        <EditorSession {...props} store={bundle.store} />
      </AtlasStoreProvider>
    </EventEmitterProvider>
  );
}

function EditorSession({
  store,
  shape = empty,
  tool = 'pen',
  title = 'Draw a region',
  instructions = 'Place points on the page, finish the shape, then save the annotation.',
  options,
  svgOptions,
  theme,
  bounded = true,
  width,
}: EditorExampleProps & { store: ReturnType<typeof createAtlasStore> }) {
  const svg = useRef<SVGSVGElement>(null);
  const request = useRef<ReturnType<AtlasStore['getRequestId']>>();
  const [saved, setSaved] = useState<InputShape | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);
  const active = useStore(store, (s) => s.tool.enabled);
  const mode = useStore(store, (s) => s.mode);
  const { helper, editor, defs, state, currentShape } = useSvgEditor({
    image: { width: 600, height: 400 },
    theme,
    ...svgOptions,
  });
  const controls = useSvgEditorControls();
  const input = usePolygonInput<PointerEvent<SVGSVGElement>>({
    helper,
    element: svg,
    enabled: active && mode === 'sketch',
    toWorld: (event) => {
      const matrix = svg.current!.getScreenCTM()!;
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      return [p.x, p.y];
    },
  });
  function begin(nextShape = shape) {
    request.current?.clear();
    request.current = store.getState().getRequestId();
    void store
      .getState()
      .requestAnnotation(
        {
          type: 'polygon',
          noBox: true,
          ...nextShape,
          bounds: bounded ? { x: 0, y: 0, width: 600, height: 400 } : null,
          editor: options,
        },
        { requestId: request.current.requestId, toolId: tool }
      )
      .then((result) => {
        if (result?.polygon) setSaved(result.polygon);
      });
    if (!nextShape.open) helper.tools.clearSelection();
    helper.clock.flush();
  }
  useEffect(() => {
    begin();
    return () => request.current?.clear();
  }, []);
  useEffect(() => {
    const resize = () => {
      const matrix = svg.current?.getScreenCTM();
      if (matrix) helper.setScale(1 / Math.hypot(matrix.a, matrix.b));
      helper.clock.flush();
    };
    const observer = new ResizeObserver(resize);
    if (svg.current) observer.observe(svg.current);
    resize();
    return () => observer.disconnect();
  }, [helper, zoom]);

  return (
    <section className="vault-story" style={{ maxWidth: width || 1000 }}>
      <h1>{title}</h1>
      <p>{instructions}</p>
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
      </div>
      <div className="toolbar">
        <button onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}>Zoom {zoom === 1 ? 'in' : 'out'}</button>
        <button onClick={() => setOffset((x) => x + 40)}>Move view right</button>

        <button disabled={!active} onClick={() => controls.nudge(1, 0, { screenPixels: true })}>
          Nudge right
        </button>
        <button disabled={!active} onClick={() => controls.completeRequest()}>
          Save annotation
        </button>
        <button disabled={!active} onClick={() => controls.cancelRequest()}>
          Discard
        </button>
        <button onClick={() => begin(saved || shape)}>Start again</button>
      </div>
      <p className="status" role="status">
        {!active
          ? 'Editing finished. Start again to make another change.'
          : state.transitioning
            ? 'Editing a draft. Release to apply; Escape cancels.'
            : 'Changes stay editable until you save.'}
      </p>
      <svg
        ref={svg}
        className="stage"
        aria-label="Drawing canvas"
        viewBox={`${offset} 0 ${600 / zoom} ${400 / zoom}`}
        tabIndex={0}
        onPointerDown={input.pointerDown}
        onPointerMove={input.pointerMove}
        onPointerUp={input.pointerUp}
        onPointerCancel={input.pointerCancel}
        onLostPointerCapture={input.lostPointerCapture}
        onPointerLeave={input.pointerLeave}
        onDoubleClick={(event) => input.doubleClick(event as unknown as PointerEvent<SVGSVGElement>)}
      >
        <defs>{defs}</defs>
        <image href="/fixtures/page.svg" x="0" y="0" width="600" height="400" opacity="0.5" pointerEvents="none" />
        {active
          ? editor
          : saved && (
              <path
                d={polygonPath(saved.points, saved.open)}
                fill={saved.open ? 'none' : '#0d948833'}
                stroke="#0d9488"
                vectorEffect="non-scaling-stroke"
              />
            )}
      </svg>
      <details>
        <summary>Geometry and saved annotation</summary>
        <pre data-testid="geometry">{JSON.stringify({ current: currentShape, saved }, null, 2)}</pre>
      </details>
    </section>
  );
}

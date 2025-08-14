import type { Runtime, ViewerMode } from '@atlas-viewer/atlas';
import type { FragmentSelector, SvgSelector } from '@iiif/presentation-3';
import type { Emitter, Handler } from 'mitt';
import {
  createHelper,
  type InputShape,
  isRectangle,
  type RenderState,
  type SlowState,
  type ValidTools,
} from 'polygon-editor';
import { createStore } from 'zustand/vanilla';
import type { SVGTheme } from '../../hooks/useSvgEditor';
import { polygonToBoundingBox } from '../../utility/polygon-to-bounding-box';

type Polygons = ReturnType<typeof createHelper>;
type Point = [number, number] | [number, number, number, number, number, number];

export type AnnotationRequest = {
  annotationPopup?: React.ReactNode;
  arguments?: Record<string, any>;
  svgTheme?: Partial<SVGTheme>;
  selectByDefault?: boolean;
  bounds?: null | { x: number; y: number; width: number; height: number };
} & (
  | {
      type: 'polygon' | 'draw';
      noBox?: boolean;
      points?: Array<Point>;
      open?: boolean;
      selector?: undefined;
    }
  | {
      type: 'target';
      selector: null | { x: number; y: number; width: number; height: number };
    }
  | {
      type: 'box';
      selector?: null | { x: number; y: number; width: number; height: number };
    }
);

export type AnnotationRequestOptions = {
  requestId: string;
  canvasId?: string | null;
  toolId?: keyof AtlasStore['switchTool'];
};

export interface AtlasStore {
  mode: ViewerMode;
  tool: {
    enabled: boolean;
    requestId: string | null;
    canvasId: string | null;
  };
  requestType: null | 'polygon' | 'target' | 'box' | 'draw';
  metadata: Record<string, any>;
  requests: Record<string, AnnotationRequest>;

  switchTool: {
    draw(): void;
    pen(): void;
    line(): void;
    lineBox(): void;
    box(): void;
    triangle(): void;
    hexagon(): void;
    circle(): void;
    remove(): void;
    hand(): void;
    pointer(): void;
  };

  history: {
    canUndo: boolean;
    canRedo: boolean;
    undo(): void;
    redo(): void;
  };

  stableViewport: null | {
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
  };

  canvasRelativePositions: Record<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
    }
  >;

  canvasViewports: Record<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      zoom?: number;
    }
  >;

  validRequestIds: string[];

  polygon: InputShape | null;
  polygons: Polygons;
  polygonState: SlowState;
  setPolygonState: (state: SlowState | ((prev: SlowState) => SlowState)) => void;
  setToolCanvasId: (canvasId: string) => void;

  setMetadata(data: Record<string, any>, requestId?: string): void;

  getRequestId(): { requestId: string; clear: () => void };
  requestAnnotation(req: AnnotationRequest, options: AnnotationRequestOptions): Promise<AnnotationResponse | null>;
  setAtlasRuntime(runtime: Runtime): void;
  setCanvasRelativePosition(canvasId: string, position: { x: number; y: number; width: number; height: number }): void;
  clearCanvasRelativePosition(canvasId: string): void;
  clearAtlasRuntime(): void;
  completeRequest(requestId?: string): void;
  cancelRequest(requestId?: string): void;
  reset(): void;

  // Controls.
  changeMode(mode: ViewerMode): void;
  nudgeLeft(): void;
  nudgeRight(): void;
  nudgeUp(): void;
  nudgeDown(): void;
  zoomIn(): void;
  zoomOut(): void;
  goHome(): void;
}

function polygonToTarget(polygon: InputShape): FragmentSelector | SvgSelector | null {
  if (!polygon || !polygon.points.length) return null;

  const filteredPoints = [];
  let prevPoint = polygon.points[polygon.points.length - 1];
  for (let x = 0; x < polygon.points.length - 1; x++) {
    const point = polygon.points[x];
    if (prevPoint[0] === point[0] && prevPoint[1] === point[1]) continue;
    filteredPoints.push(point);
    prevPoint = point;
  }

  console.log('isRectangle', isRectangle(filteredPoints));

  if (isRectangle(filteredPoints)) {
    const xPoints = filteredPoints.map((point) => point[0]);
    const yPoints = filteredPoints.map((point) => point[1]);
    const x = Math.min(...xPoints);
    const y = Math.min(...yPoints);
    const width = Math.max(...xPoints) - x;
    const height = Math.max(...yPoints) - y;

    if (width > 0 && height > 0) {
      return {
        type: 'FragmentSelector',
        value: `#xywh=${~~x},${~~y},${~~width},${~~height}`,
      };
    }
  }

  return {
    type: 'SvgSelector',
    value: `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><g><path d='M${polygon.points
      .map((p) => p.join(','))
      .join(' ')}${polygon.open ? '' : ' Z'}' /></g></svg>`,
  };
}

export function requestToAnnotationResponse(request: AnnotationRequest): Omit<AnnotationResponse, 'id'> {
  if (request.type === 'polygon' && !request.noBox) {
    if (request.points && isRectangle(request.points)) {
      const bb = polygonToBoundingBox({ open: false, points: request.points || [] });
      return requestToAnnotationResponse({ ...request, type: 'box', selector: bb });
    }
  }

  if (request.type === 'polygon' || request.type === 'draw') {
    return {
      polygon: {
        points: request.points || [],
        open: request.open || false,
      },
      requestType: request.type,
      boundingBox: polygonToBoundingBox({
        points: request.points || [],
        open: false,
      }),
      metadata: {},
      arguments: request.arguments || {},
      target: polygonToTarget({ points: request.points || [], open: false }),
    };
  }

  const box = request.selector;
  if (box) {
    const points = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x + box.width, box.y + box.height],
      [box.x, box.y + box.height],
    ] as Array<Point>;
    return {
      polygon: {
        points,
        open: false,
      },
      requestType: request.type,
      boundingBox: box,
      metadata: {},
      target: polygonToTarget({ points, open: false }),
      arguments: request.arguments || {},
    };
  }

  return {
    polygon: { points: [] as Array<Point>, open: false },
    requestType: request.type,
    boundingBox: null,
    target: null,
    metadata: {},
    arguments: request.arguments || {},
  };
}

export type AnnotationResponse = {
  id: string;
  canvasId?: string | null;
  polygon: InputShape | null;
  cancelled?: boolean;
  requestType: 'draw' | 'polygon' | 'target' | 'box';
  target: FragmentSelector | SvgSelector | null;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  metadata: Record<string, any>;
  arguments: Record<string, any>;
};

export type AtlasStoreEvents = {
  'atlas.canvas-click': {
    canvasId: string;
    target: { x: number; y: number };
    worldTarget: { x: number; y: number };
  };
  'atlas.viewport-change': {
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
  };
  'atlas.ready': { runtime: Runtime };
  'atlas.annotation-completed': AnnotationResponse;
  'atlas.annotation-request': { id: string };
  'atlas.request-cancelled': { id: string };
  'atlas.polygon-render': {
    state: RenderState;
    slowState: SlowState;
    dt: number;
  };
  'atlas.polygon-update': {
    id?: string;
    points: Array<Point>;
    open: boolean;
  };
};

export interface CreateAtlasStoreProps {
  events: Emitter<AtlasStoreEvents>;
  keyboardShortcutsEnabled?: boolean;
  keyboardShortcutMapping?: Record<string, string>;
  enabledTools?: Array<ValidTools>;
  debug?: boolean;
}

const defaultSlowState: SlowState = {
  shapeId: null,
  noShape: true,
  transitioning: false,
  actionIntentType: null,
  transitionIntentType: null,
  selectedPoints: [],
  hasClosestLine: false,
  lastCreationTool: null,
  modifiers: {
    Alt: false,
    Shift: false,
    Meta: false,
    proximity: 0, // default value.
  },
  bounds: null,
  showBoundingBox: false,
  currentModifiers: {},
  validIntentKeys: {},
  pointerInsideShape: false,
  closestPoint: null,
  transitionModifiers: null,
  selectedStamp: null,
  bezierLines: [],
  boxMode: false,
  fixedAspectRatio: false,
  cursor: '',
  enabledTools: ['pointer', 'pen', 'box', 'lineBox', 'stamp', 'hand', 'line', 'pencil'],
  canDelete: true,
  canDeselect: true,
  isToolSwitchingLocked: false,
  currentTool: 'box',
  snapEnabled: false,
  snapToPoints: false,
  snapToLines: false,
  snapToIntersections: false,
  snapToGrid: false,
  snapToParallel: false,
};

export function createAtlasStore({
  events,
  enabledTools,
  keyboardShortcutMapping,
  keyboardShortcutsEnabled = false,
  debug,
}: CreateAtlasStoreProps) {
  const store = createStore<AtlasStore>((set, get) => {
    let runtime: Runtime | null = null;

    const onSave = (input: { id?: string; open: boolean; points: Array<Point> }) => {
      set((s) =>
        s.tool.requestId
          ? { polygon: { ...input, id: s.tool.requestId } }
          : {
              polygon: { id: undefined, points: [], open: true },
            },
      );
      events.emit('atlas.polygon-update', input);
    };

    const polygons = createHelper(
      {
        emitter: events as any,
        keyboardShortcutsEnabled,
        keyboardShortcutMapping,
        enabledTools,
        customSetState: (partial) => {
          if (debug) {
            console.log('partial state', partial);
          }
          set((prev) => ({
            polygonState: {
              ...prev.polygonState,
              ...partial,
            },
          }));
        },
      },
      onSave,
    );

    return {
      mode: 'explore',
      tool: {
        enabled: false,
        requestId: null,
        canvasId: null,
      },
      requestType: null,
      requests: {},
      history: polygons.history,

      polygon: null,

      validRequestIds: [],
      metadata: {},
      stableViewport: null,
      canvasRelativePositions: {},
      canvasViewports: {},

      polygons: polygons,
      polygonState: defaultSlowState,

      setMetadata: (data, requestId) => {
        const actualRequestId = requestId || get().tool.requestId;
        if (actualRequestId) {
          set((state) => ({
            metadata: {
              ...state.metadata,
              [actualRequestId]: {
                ...(state.metadata[actualRequestId] || {}),
                ...data,
              },
            },
          }));
        }
      },

      setToolCanvasId: (canvasId) => {
        set((state) => ({ tool: { ...state.tool, canvasId } }));
      },

      switchTool: {
        pointer() {
          set({ mode: 'sketch' });
          helper.tools.setTool('pointer');
        },
        hand() {
          set({ mode: 'explore' });
          helper.tools.setTool('hand');
        },
        draw() {
          set({ mode: 'sketch' });
          helper.tools.setTool('pencil');
        },
        pen() {
          set({ mode: 'sketch' });
          helper.tools.setTool('pen');
        },
        line() {
          set({ mode: 'sketch' });
          helper.tools.setTool('line');
        },
        lineBox() {
          set({ mode: 'sketch' });
          helper.tools.setTool('lineBox');
        },
        box() {
          set({ mode: 'sketch' });
          helper.tools.setTool('box');
        },
        triangle() {
          set({ mode: 'sketch' });
          helper.tools.setTool('stamp');
          helper.stamps.triangle();
        },
        hexagon() {
          set({ mode: 'sketch' });
          helper.tools.setTool('stamp');
          helper.stamps.hexagon();
        },
        circle() {
          set({ mode: 'sketch' });
          helper.tools.setTool('stamp');
          helper.stamps.circle();
        },
        remove() {
          const state = get();
          if (state.tool.requestId) {
            // Remove points?
            polygons.setShape({ points: [], open: true });
            state.cancelRequest(state.tool.requestId);
          }
        },
      },

      reset: () => {
        const state = get();
        if (state.tool.requestId) {
          state.cancelRequest(state.tool.requestId);
        }
      },

      setPolygonState: (state) =>
        set({
          polygonState: typeof state === 'function' ? state(get().polygonState) : state,
        }),

      getRequestId: () => {
        const requestId = Math.random().toString(36).slice(2);
        set((state) => ({
          validRequestIds: [...state.validRequestIds, requestId],
        }));
        return {
          requestId,
          clear: () => {
            if (get().tool.requestId === requestId) {
              // dispatch event to cancel.
            }
            set((state) => ({
              tool:
                state.tool.requestId === requestId ? { enabled: false, requestId: null, canvasId: null } : state.tool,
              validRequestIds: state.validRequestIds.filter((id) => id !== requestId),
            }));
          },
        };
      },

      cancelRequest: (inputRequestId) => {
        const requestId = inputRequestId || get().tool.requestId;
        if (requestId) {
          set((state) => ({
            mode: 'explore',
            tool: state.tool.requestId === requestId ? { enabled: false, requestId: null, canvasId: null } : state.tool,
            validRequestIds: state.validRequestIds.filter((id) => id !== requestId),
          }));

          events.emit('atlas.request-cancelled', { id: requestId });
        }
      },

      requestAnnotation: async (request, options) => {
        const requests = get().requests;
        const newRequests = {
          ...requests,
          [options.requestId]: request,
        };
        const response = requestToAnnotationResponse(request);

        if (debug) {
          console.log('requestAnnotation', {
            response,
            request,
          });
        }

        try {
          const { points = [], open = true } = response.polygon || {};
          const { requestId, canvasId = null, toolId: chosenToolId } = options;

          let toolId = chosenToolId;

          const state = get();
          const isValid = state.validRequestIds.includes(requestId);
          const requestType = response.requestType;

          if (debug) {
            console.log('setting points', { requestType, points, open });
          }
          if (!isValid) return null;
          if (state.tool.enabled) return null;

          // polygons.state.selectedPoints = []; // @TODO this is an upstream bug.
          polygons.setShape({ id: requestId, points, open });
          if (requestType === 'polygon') {
            toolId = toolId || 'pen';
            polygons.tools.setTool('pen');
          }
          if (requestType === 'draw') {
            toolId = toolId || 'draw';
            polygons.tools.setTool('pencil');
          }
          if (requestType === 'box') {
            toolId = toolId || 'box';
            polygons.tools.setTool('box');
          }
          if (requestType === 'target') {
            toolId = toolId || 'box';
            polygons.tools.setTool('box');
            polygons.lockAspectRatio();
            polygons.tools.lockToolSwitching();
            polygons.tools.setCanDeselect(false);
            polygons.tools.setCanDelete(false);
          } else {
            // Not target.
            polygons.tools.unlockToolSwitching();
            polygons.tools.setCanDeselect(true);
            polygons.tools.setCanDelete(true);
          }

          // Set bounds?
          if (request.bounds) {
            polygons.setBounds(request.bounds);
          }

          events.emit('atlas.annotation-request', { id: requestId });
          set({
            polygon: { id: requestId, points, open },
            mode: 'sketch',
            requestType: requestType,
            tool: {
              enabled: true,
              requestId,
              canvasId,
            },
            requests: newRequests,
          });
          if (toolId) {
            state.switchTool[toolId]?.();
          } else if (points.length === 0) {
            // Default to square.
            state.switchTool.box();
          }

          if (
            (typeof request.selectByDefault === 'undefined' && points.length && requestType === 'box') ||
            request.selectByDefault
          ) {
            state.switchTool.pointer();
          }

          return new Promise<AnnotationResponse | null>((resolve) => {
            const cancelHandler: Handler<AtlasStoreEvents['atlas.request-cancelled']> = (e) => {
              if (e.id !== requestId) return;
              set((existing) => ({
                mode: 'explore',
                tool: {
                  requestId: null,
                  enabled: false,
                  canvasId: null,
                },
                requests: Object.fromEntries(Object.entries(existing.requests).filter(([key]) => key !== requestId)),
              }));
              events.off('atlas.request-cancelled', cancelHandler);
              events.off('atlas.annotation-completed', handler);
              resolve(null);
            };

            const handler: Handler<AtlasStoreEvents['atlas.annotation-completed']> = (e) => {
              if (e.id !== requestId) return;
              set((existing) => ({
                mode: 'explore',
                tool: {
                  requestId: null,
                  enabled: false,
                  canvasId: null,
                },
                requests: Object.fromEntries(Object.entries(existing.requests).filter(([key]) => key !== requestId)),
              }));
              events.off('atlas.annotation-completed', handler);
              events.off('atlas.request-cancelled', cancelHandler);
              resolve(e);
            };
            events.on('atlas.request-cancelled', cancelHandler);
            events.on('atlas.annotation-completed', handler);
          });
        } catch (err) {
          console.error(err);
          return null;
        }
      },

      completeRequest: (requestId?: string) => {
        const currentRequestId = get().tool.requestId;
        if (typeof requestId === 'string' && requestId) {
          if (requestId !== currentRequestId) {
            return;
          }
        }
        const args = currentRequestId ? get().requests[currentRequestId]?.arguments || {} : {};
        const metadata = currentRequestId ? get().metadata[currentRequestId] || {} : {};
        const polygon = get().polygon;
        if (!polygon) return;
        events.emit('atlas.annotation-completed', {
          id: polygon.id!,
          polygon,
          requestType: get().requestType as any,
          target: polygonToTarget(polygon),
          canvasId: get().tool.canvasId,
          boundingBox: polygonToBoundingBox(polygon),
          metadata,
          arguments: { ...args },
        });
        polygons.setShape(null);
      },

      setAtlasRuntime: (newRuntime: Runtime) => {
        runtime = newRuntime;
        events.emit('atlas.ready', { runtime: newRuntime });
        helper.setScale(1 / runtime._lastGoodScale);

        runtime.world.addLayoutSubscriber((ev, data) => {
          if (ev === 'event-activation' || ev === 'zoom-to' || ev === 'go-home') {
            if (runtime?._lastGoodScale && !Number.isNaN(runtime._lastGoodScale)) {
              helper.setScale(1 / runtime._lastGoodScale);
            }
          }
        });

        // @todo set up events etc.
      },

      clearAtlasRuntime: () => {
        runtime = null;
        set({ stableViewport: null });
      },

      setCanvasRelativePosition: (canvasId: string, position) => {
        set((state) => ({
          canvasRelativePositions: {
            ...state.canvasRelativePositions,
            [canvasId]: position,
          },
        }));
      },

      clearCanvasRelativePosition: (canvasId: string) => {
        set((state) => {
          const newPositions = { ...state.canvasRelativePositions };
          delete newPositions[canvasId];
          return { canvasRelativePositions: newPositions };
        });
      },

      changeMode: (mode) => {
        set({ mode });
      },

      // Navigation controls
      nudgeLeft: () => {
        // @todo
      },

      nudgeRight: () => {
        // @todo
      },

      nudgeUp: () => {
        // @todo
      },

      nudgeDown: () => {
        // @todo
      },

      zoomIn: () => {
        runtime?.world?.zoomIn();
      },

      zoomOut: () => {
        runtime?.world?.zoomOut();
      },

      goHome: () => {
        runtime?.world?.goHome();
      },
    };
  });

  // Reset when sequence changes.
  // events.on("sequence.change", () => {
  //   store.getState().reset();
  // });

  const helper = store.getState().polygons;
  events.on('atlas.annotation-request', () => {
    helper.clock.start((state, slowState, dt) => {
      events.emit('atlas.polygon-render', { state, slowState, dt });
    });
  });

  events.on('atlas.annotation-completed', () => {
    helper.clock.stop();
  });

  events.on('atlas.request-cancelled', () => {
    helper.clock.stop();
  });

  return store;
}

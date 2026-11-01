import type { BoxPlacement, CreateHelperInput, InputShape, SnapGrid, createHelper } from 'polygon-editor';

export interface PolygonSnapOptions {
  enabled?: boolean;
  threshold?: number;
  points?: boolean;
  lines?: boolean;
  curves?: boolean;
  intersections?: boolean;
  parallel?: boolean;
  grid?: SnapGrid | false;
  sources?: InputShape[];
}

/** Runtime settings. Requests inherit store defaults; omitted settings reset for the next request. */
export interface PolygonEditorOptions {
  snap?: PolygonSnapOptions;
  /** `drag` draws a box by dragging, `tap` by tapping two opposite corners (better on touch screens). */
  boxPlacement?: BoxPlacement;
  /** Lifts a dragged handle above the finger, in CSS pixels, e.g. `[0, -48]`. */
  dragOffset?: [number, number];
}

export type PolygonEditorDefaults = PolygonEditorOptions &
  Pick<CreateHelperInput, 'proximity' | 'touchProximity' | 'dragThreshold' | 'historyLimit'>;

type Helper = ReturnType<typeof createHelper>;

export function configurePolygonHelper(helper: Helper, options: PolygonEditorOptions) {
  if (options.boxPlacement !== undefined) helper.setBoxPlacement(options.boxPlacement);
  if (options.dragOffset !== undefined) helper.setDragOffset(options.dragOffset);
  const snap = options.snap;
  if (!snap) return;
  if (snap.enabled !== undefined) snap.enabled ? helper.snap.enable() : helper.snap.disable();
  if (snap.threshold !== undefined) helper.snap.setThreshold(snap.threshold);
  if (snap.sources !== undefined) helper.snap.setSources(snap.sources);
  if (snap.grid !== undefined) {
    if (snap.grid) {
      helper.snap.setGrid(snap.grid);
      helper.snap.enableGrid();
    } else helper.snap.disableGrid();
  }
  for (const [key, name] of [
    ['points', 'Points'],
    ['lines', 'Lines'],
    ['curves', 'Curves'],
    ['intersections', 'Intersections'],
    ['parallel', 'Parallel'],
  ] as const) {
    if (snap[key] !== undefined) snap[key] ? helper.snap[`enable${name}`]() : helper.snap[`disable${name}`]();
  }
}

/** Copy only the defined keys, so an explicit `undefined` never hides a lower-priority value. */
function defined<T extends object>(value: T | undefined): Partial<T> {
  return Object.fromEntries(Object.entries(value || {}).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Resolve one request's settings: built-in defaults, then store defaults, then the request itself. */
export function polygonRequestOptions(
  defaults: PolygonEditorOptions = {},
  request: PolygonEditorOptions = {}
): PolygonEditorOptions {
  return {
    boxPlacement: request.boxPlacement ?? defaults.boxPlacement ?? 'drag',
    dragOffset: request.dragOffset ?? defaults.dragOffset ?? [0, 0],
    snap: {
      enabled: false,
      threshold: 15,
      points: true,
      lines: true,
      curves: true,
      intersections: false,
      parallel: true,
      grid: false,
      sources: [],
      ...defined(defaults.snap),
      ...defined(request.snap),
    },
  };
}

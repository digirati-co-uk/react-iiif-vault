import type { CreateHelperInput, InputShape, SnapGrid, createHelper } from 'polygon-editor';

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
}

export type PolygonEditorDefaults = PolygonEditorOptions &
  Pick<CreateHelperInput, 'proximity' | 'touchProximity' | 'dragThreshold' | 'historyLimit'>;

export function configurePolygonHelper(helper: ReturnType<typeof createHelper>, options: PolygonEditorOptions) {
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

export function polygonRequestOptions(
  defaults: PolygonEditorOptions = {},
  request: PolygonEditorOptions = {}
): PolygonEditorOptions {
  return {
    ...defaults,
    ...request,
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
      ...defaults.snap,
      ...request.snap,
    },
  };
}

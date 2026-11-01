import { useCallback, useMemo } from 'react';
import type { Point } from 'polygon-editor';
import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';
import type { PolygonEditorOptions, PolygonSnapOptions } from '../utility/polygon-editor-options';

/** Drawing completion changes geometry; completeRequest saves the annotation. */
export function useSvgEditorControls() {
  const store = useAtlasStore();
  const helper = useStore(store, (s) => s.polygons);
  const state = useStore(store, (s) => s.polygonState);
  const shape = useStore(store, (s) => s.polygon);
  const completeRequest = useStore(store, (s) => s.completeRequest);
  const cancelRequest = useStore(store, (s) => s.cancelRequest);
  const switchTool = useStore(store, (s) => s.switchTool);
  const configure = useStore(store, (s) => s.configurePolygonEditor);
  const run = useCallback(
    <T>(action: () => T): T => {
      const result = action();
      helper.clock.flush();
      return result;
    },
    [helper]
  );
  const actions = useMemo(
    () => ({
      undo: () => run(() => helper.history.undo()),
      redo: () => run(() => helper.history.redo()),
      finishShape: (options?: { close?: boolean }) => run(() => helper.finishShape(options)),
      finishOpenShape: () => run(() => helper.finishShape({ close: false })),
      undoLastPoint: () => run(() => helper.undoLastPoint()),
      cancelGesture: () => run(() => helper.cancelGesture('toolbar')),
      nudge: (dx: number, dy: number, options?: { screenPixels?: boolean }) => run(() => helper.nudge(dx, dy, options)),
      addPointAt: (point: Point) => run(() => helper.addPointAt(point)),
      moveSelectedPointTo: (point: Point) => run(() => helper.moveSelectedPointTo(point)),
      setCurve: (enabled: boolean) => run(() => helper.setCurveAt(helper.state.selectedPoints, enabled)),
      smoothen: () => run(() => helper.smoothen()),
      setSnapping: (snap: PolygonSnapOptions) => configure({ snap }),
      configureEditor: (options: PolygonEditorOptions) => configure(options),
    }),
    [helper, run, configure]
  );
  return {
    completeRequest,
    cancelRequest,
    switchTool,
    currentTool: state.currentTool,
    selectedStamp: state.selectedStamp,
    selectedPoints: state.selectedPoints,
    canUndo: state.canUndo ?? helper.history.canUndo,
    canRedo: state.canRedo ?? helper.history.canRedo,
    canFinish: !!shape?.open && shape.points.length >= (state.currentTool === 'line' ? 2 : 3),
    canFinishOpen: !!shape?.open && shape.points.length >= 2,
    snapping: state.snapEnabled,
    curve: helper.curveState(state.selectedPoints),
    canSmoothen: helper.canSmoothen(state.selectedPoints),
    ...actions,
  };
}

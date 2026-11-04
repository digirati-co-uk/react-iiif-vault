import { useCallback, useMemo } from 'react';
import type { BoxPlacement, InputShape, Point } from 'polygon-editor';
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
  const selectStamp = useStore(store, (s) => s.selectStamp);
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
      /** Move one cubic handle of an anchor to an absolute world position. */
      setBezierControl: (pointIndex: number, control: 0 | 1, target: Point) =>
        run(() => helper.setBezierControl(pointIndex, control, target)),
      smoothen: () => run(() => helper.smoothen()),
      selectAll: () => run(() => helper.selectAllPoints()),
      clearSelection: () => run(() => helper.tools.clearSelection()),
      /** Place a custom template shape. Use switchTool.square/triangle/pentagon/hexagon/circle for built-ins. */
      stamp: (shape: InputShape) => selectStamp(shape),
      setBoxPlacement: (placement: BoxPlacement) => configure({ boxPlacement: placement }),
      setDragOffset: (offset: [number, number]) => configure({ dragOffset: offset }),
      setSnapping: (snap: PolygonSnapOptions) => configure({ snap }),
      configureEditor: (options: PolygonEditorOptions) => configure(options),
    }),
    [helper, run, configure, selectStamp]
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
    boxPlacement: state.boxPlacement ?? 'drag',
    /** True between the two taps of a tap-placed box; prompt for the second corner. */
    boxPending: !!state.boxPending,
    /** Human-readable label of what the next click or drag will do, for status lines and screen readers. */
    intentLabel: helper.label(state.transitionIntentType ?? state.actionIntentType),
    curve: helper.curveState(state.selectedPoints),
    canSmoothen: helper.canSmoothen(state.selectedPoints),
    ...actions,
  };
}

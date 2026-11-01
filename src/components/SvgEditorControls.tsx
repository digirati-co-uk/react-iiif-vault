import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';
import { useSvgEditorControls } from '../hooks/useSvgEditorControls';

interface RenderSvgEditorControlsProps {
  showShapes?: boolean;
  editing?: {
    history?: boolean;
    finish?: boolean;
    curves?: boolean;
    snapping?: boolean;
    /** Select all / clear selection. */
    selection?: boolean;
    /** Switch between drag and two-tap box placement. */
    boxPlacement?: boolean;
    /** A polite status line describing the next action, e.g. "Tap the second corner". */
    status?: boolean;
  };
  classNames?: Partial<{
    button: string;
  }>;
  enabled?: {
    draw?: boolean;
    pen?: boolean;
    line?: boolean;
    lineBox?: boolean;
    box?: boolean;
    square?: boolean;
    triangle?: boolean;
    pentagon?: boolean;
    hexagon?: boolean;
    circle?: boolean;
    delete?: boolean;
  };
  icons?: Partial<{
    DrawIcon: ReactNode;
    PenIcon: ReactNode;
    LineIcon: ReactNode;
    LineBoxIcon: ReactNode;
    ShapesIcon: ReactNode;
    BoxIcon: ReactNode;
    SquareIcon: ReactNode;
    TriangleIcon: ReactNode;
    PentagonIcon: ReactNode;
    HexagonIcon: ReactNode;
    CircleIcon: ReactNode;
    DeleteForeverIcon: ReactNode;
    PointerIcon: ReactNode;
    HandIcon: ReactNode;
  }>;
}

const defaultEnabled = {
  draw: true,
  polygon: true,
  line: true,
  lineBox: true,
  box: true,
  triangle: true,
  hexagon: true,
  circle: true,
  delete: true,
  pen: true,
};

export function RenderSvgEditorControls({
  // helper,
  showShapes = true,
  // state,
  enabled = defaultEnabled,
  classNames = {},
  icons = {},
  editing = {},
}: RenderSvgEditorControlsProps) {
  const controls = useSvgEditorControls();
  const { currentTool, switchTool, selectedStamp } = controls;

  return (
    <>
      {editing.history && (
        <>
          <button type="button" className={classNames.button} disabled={!controls.canUndo} onClick={controls.undo}>
            Undo
          </button>
          <button type="button" className={classNames.button} disabled={!controls.canRedo} onClick={controls.redo}>
            Redo
          </button>
        </>
      )}
      {editing.finish && (
        <>
          <button
            type="button"
            className={classNames.button}
            disabled={!controls.canFinish}
            onClick={() => controls.finishShape()}
          >
            Finish shape
          </button>
          <button
            type="button"
            className={classNames.button}
            disabled={!controls.canFinishOpen}
            onClick={controls.finishOpenShape}
          >
            Finish line
          </button>
          <button type="button" className={classNames.button} onClick={controls.undoLastPoint}>
            Remove last point
          </button>
          <button type="button" className={classNames.button} onClick={controls.cancelGesture}>
            Cancel gesture
          </button>
        </>
      )}
      {editing.curves && (
        <>
          <button
            className={classNames.button}
            disabled={!controls.curve.available}
            aria-pressed={controls.curve.curved}
            onClick={() => controls.setCurve(!controls.curve.curved)}
          >
            Curve
          </button>
          <button
            type="button"
            className={classNames.button}
            disabled={!controls.canSmoothen}
            onClick={controls.smoothen}
          >
            Smooth
          </button>
        </>
      )}
      {editing.selection && (
        <>
          <button type="button" className={classNames.button} onClick={controls.selectAll}>
            Select all
          </button>
          <button
            type="button"
            className={classNames.button}
            disabled={!controls.selectedPoints?.length}
            onClick={controls.clearSelection}
          >
            Clear selection
          </button>
        </>
      )}
      {editing.boxPlacement && (
        <button
          type="button"
          className={classNames.button}
          aria-pressed={controls.boxPlacement === 'tap'}
          onClick={() => controls.setBoxPlacement(controls.boxPlacement === 'tap' ? 'drag' : 'tap')}
        >
          Tap corners
        </button>
      )}
      {editing.status && (
        <span role="status" aria-live="polite">
          {controls.boxPending ? 'Tap the second corner' : controls.intentLabel}
        </span>
      )}
      {editing.snapping && (
        <button
          className={classNames.button}
          aria-pressed={controls.snapping}
          onClick={() => controls.setSnapping({ enabled: !controls.snapping })}
        >
          Snap
        </button>
      )}
      {currentTool}
      <button
        type="button"
        className={classNames.button}
        onClick={switchTool.pointer}
        data-active={currentTool === 'pointer'}
        aria-pressed={currentTool === 'pointer'}
      >
        {icons.PointerIcon || 'Pointer'}
      </button>
      <button
        type="button"
        className={classNames.button}
        onClick={switchTool.hand}
        data-active={currentTool === 'hand'}
        aria-pressed={currentTool === 'hand'}
      >
        {icons.HandIcon || 'Hand'}
      </button>
      {showShapes ? (
        <>
          {enabled.box && (
            <button
              type="button"
              className={classNames.button}
              onClick={switchTool.box}
              data-active={currentTool === 'box'}
              aria-pressed={currentTool === 'box'}
            >
              {icons.BoxIcon || 'Box'}
            </button>
          )}
          {enabled.pen && (
            <button
              type="button"
              className={classNames.button}
              onClick={switchTool.pen}
              data-active={currentTool === 'pen'}
              aria-pressed={currentTool === 'pen'}
            >
              {icons.PenIcon || 'Pen'}
            </button>
          )}
          {enabled.draw && (
            <button
              type="button"
              className={classNames.button}
              onClick={switchTool.draw}
              data-active={currentTool === 'pencil'}
              aria-pressed={currentTool === 'pencil'}
            >
              {icons.DrawIcon || 'Draw'}
            </button>
          )}
          {enabled.line && (
            <button
              type="button"
              className={classNames.button}
              onClick={switchTool.line}
              data-active={currentTool === 'line'}
              aria-pressed={currentTool === 'line'}
            >
              {icons.LineIcon || 'Line'}
            </button>
          )}
          {enabled.lineBox && (
            <button
              type="button"
              className={classNames.button}
              onClick={switchTool.lineBox}
              data-active={currentTool === 'lineBox'}
              aria-pressed={currentTool === 'lineBox'}
            >
              {icons.LineBoxIcon || 'LineBox'}
            </button>
          )}

          {enabled.square && (
            <button
              type="button"
              className={classNames.button}
              onClick={switchTool.square}
              data-active={currentTool === 'stamp' && selectedStamp?.id === 'square'}
              aria-pressed={currentTool === 'stamp' && selectedStamp?.id === 'square'}
            >
              {icons.SquareIcon || 'Square'}
            </button>
          )}

          {enabled.triangle && (
            <button
              className={classNames.button}
              onClick={switchTool.triangle}
              data-active={currentTool === 'stamp' && selectedStamp?.id === 'triangle'}
              aria-pressed={currentTool === 'stamp' && selectedStamp?.id === 'triangle'}
            >
              {icons.TriangleIcon || 'Triangle'}
            </button>
          )}

          {enabled.pentagon && (
            <button
              type="button"
              className={classNames.button}
              onClick={switchTool.pentagon}
              data-active={currentTool === 'stamp' && selectedStamp?.id === 'pentagon'}
              aria-pressed={currentTool === 'stamp' && selectedStamp?.id === 'pentagon'}
            >
              {icons.PentagonIcon || 'Pentagon'}
            </button>
          )}

          {enabled.hexagon && (
            <button
              className={classNames.button}
              onClick={switchTool.hexagon}
              data-active={currentTool === 'stamp' && selectedStamp?.id === 'hexagon'}
              aria-pressed={currentTool === 'stamp' && selectedStamp?.id === 'hexagon'}
            >
              {icons.HexagonIcon || 'Hexagon'}
            </button>
          )}

          {enabled.circle && (
            <button
              className={classNames.button}
              data-active={currentTool === 'stamp' && selectedStamp?.id === 'circle'}
              aria-pressed={currentTool === 'stamp' && selectedStamp?.id === 'circle'}
              onClick={switchTool.circle}
            >
              {icons.CircleIcon || 'Circle'}
            </button>
          )}
        </>
      ) : null}
      {enabled.delete && (
        <button type="button" className={classNames.button} onClick={switchTool.remove}>
          {icons.DeleteForeverIcon || 'Delete'}
        </button>
      )}
    </>
  );
}

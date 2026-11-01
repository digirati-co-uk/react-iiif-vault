import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';
import { useSvgEditorControls } from '../hooks/useSvgEditorControls';

interface RenderSvgEditorControlsProps {
  showShapes?: boolean;
  editing?: { history?: boolean; finish?: boolean; curves?: boolean; snapping?: boolean };
  classNames?: Partial<{
    button: string;
  }>;
  enabled?: {
    draw?: boolean;
    pen?: boolean;
    line?: boolean;
    lineBox?: boolean;
    box?: boolean;
    triangle?: boolean;
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
    TriangleIcon: ReactNode;
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
          <button className={classNames.button} disabled={!controls.canUndo} onClick={controls.undo}>
            Undo
          </button>
          <button className={classNames.button} disabled={!controls.canRedo} onClick={controls.redo}>
            Redo
          </button>
        </>
      )}
      {editing.finish && (
        <>
          <button className={classNames.button} disabled={!controls.canFinish} onClick={() => controls.finishShape()}>
            Finish shape
          </button>
          <button className={classNames.button} disabled={!controls.canFinishOpen} onClick={controls.finishOpenShape}>
            Finish line
          </button>
          <button className={classNames.button} onClick={controls.undoLastPoint}>
            Remove last point
          </button>
          <button className={classNames.button} onClick={controls.cancelGesture}>
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
          <button className={classNames.button} disabled={!controls.canSmoothen} onClick={controls.smoothen}>
            Smooth
          </button>
        </>
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
      <button className={classNames.button} onClick={switchTool.pointer} data-active={currentTool === 'pointer'}>
        {icons.PointerIcon || 'Pointer'}
      </button>
      <button className={classNames.button} onClick={switchTool.hand} data-active={currentTool === 'hand'}>
        {icons.HandIcon || 'Hand'}
      </button>
      {showShapes ? (
        <>
          {enabled.box && (
            <button className={classNames.button} onClick={switchTool.box} data-active={currentTool === 'box'}>
              {icons.BoxIcon || 'Box'}
            </button>
          )}
          {enabled.pen && (
            <button className={classNames.button} onClick={switchTool.pen} data-active={currentTool === 'pen'}>
              {icons.PenIcon || 'Pen'}
            </button>
          )}
          {enabled.draw && (
            <button className={classNames.button} onClick={switchTool.draw} data-active={currentTool === 'pencil'}>
              {icons.DrawIcon || 'Draw'}
            </button>
          )}
          {enabled.line && (
            <button className={classNames.button} onClick={switchTool.line} data-active={currentTool === 'line'}>
              {icons.LineIcon || 'Line'}
            </button>
          )}
          {enabled.lineBox && (
            <button className={classNames.button} onClick={switchTool.lineBox} data-active={currentTool === 'lineBox'}>
              {icons.LineBoxIcon || 'LineBox'}
            </button>
          )}

          {enabled.triangle && (
            <button
              className={classNames.button}
              onClick={switchTool.triangle}
              data-active={currentTool === 'stamp' && selectedStamp?.id === 'triangle'}
            >
              {icons.TriangleIcon || 'Triangle'}
            </button>
          )}

          {enabled.hexagon && (
            <button
              className={classNames.button}
              onClick={switchTool.hexagon}
              data-active={currentTool === 'stamp' && selectedStamp?.id === 'hexagon'}
            >
              {icons.HexagonIcon || 'Hexagon'}
            </button>
          )}

          {enabled.circle && (
            <button
              className={classNames.button}
              data-active={currentTool === 'stamp' && selectedStamp?.id === 'circle'}
              onClick={switchTool.circle}
            >
              {icons.CircleIcon || 'Circle'}
            </button>
          )}
        </>
      ) : null}
      {enabled.delete && (
        <button className={classNames.button} onClick={switchTool.remove}>
          {icons.DeleteForeverIcon || 'Delete'}
        </button>
      )}
    </>
  );
}

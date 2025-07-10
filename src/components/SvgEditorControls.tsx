import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';

interface RenderSvgEditorControlsProps {
  showShapes?: boolean;
  classNames?: Partial<{
    button: string;
  }>;
  enabled?: {
    draw?: boolean;
    polygon?: boolean;
    line?: boolean;
    lineBox?: boolean;
    square?: boolean;
    triangle?: boolean;
    hexagon?: boolean;
    circle?: boolean;
    delete?: boolean;
  };
  icons?: Partial<{
    DrawIcon: ReactNode;
    PolygonIcon: ReactNode;
    LineIcon: ReactNode;
    LineBoxIcon: ReactNode;
    ShapesIcon: ReactNode;
    SquareIcon: ReactNode;
    TriangleIcon: ReactNode;
    HexagonIcon: ReactNode;
    CircleIcon: ReactNode;
    DeleteForeverIcon: ReactNode;
  }>;
}

const defaultEnabled = {
  draw: true,
  polygon: true,
  line: true,
  lineBox: true,
  square: true,
  triangle: true,
  hexagon: true,
  circle: true,
  delete: true,
};

export function RenderSvgEditorControls({
  // helper,
  showShapes = true,
  // state,
  enabled = defaultEnabled,
  classNames = {},
  icons = {},
}: RenderSvgEditorControlsProps) {
  const store = useAtlasStore();
  const allStore = useStore(store);
  const helper = allStore.polygons;
  const state = helper.state.slowState;

  console.log(allStore.tool);

  return (
    <>
      {showShapes ? (
        <>
          {enabled.draw && (
            <button
              className={classNames.button}
              onClick={() => helper.tools.setTool('pencil')}
              data-active={helper.state.slowState.currentTool === 'pencil'}
            >
              {icons.DrawIcon || 'Draw'}
            </button>
          )}
          {enabled.polygon && (
            <button
              className={classNames.button}
              onClick={() => helper.tools.setTool('pen')}
              data-active={helper.state.slowState.currentTool === 'pen'}
            >
              {icons.PolygonIcon || 'Polygon'}
            </button>
          )}
          {enabled.line && (
            <button
              className={classNames.button}
              onClick={() => helper.tools.setTool('line')}
              data-active={helper.state.slowState.currentTool === 'line'}
            >
              {icons.LineIcon || 'Line'}
            </button>
          )}
          {enabled.lineBox && (
            <button
              className={classNames.button}
              onClick={() => helper.tools.setTool('lineBox')}
              data-active={helper.state.slowState.currentTool === 'lineBox'}
            >
              {icons.LineBoxIcon || 'LineBox'}
            </button>
          )}

          {enabled.square && (
            <button
              className={classNames.button}
              onClick={() => helper.tools.setTool('box')}
              data-active={helper.state.slowState.currentTool === 'box'}
            >
              {icons.SquareIcon || 'Square'}
            </button>
          )}

          {enabled.triangle && (
            <button
              className={classNames.button}
              onClick={() => {
                helper.tools.setTool('stamp');
                helper.stamps.triangle();
              }}
              data-active={helper.state.slowState.currentTool === 'stamp' && state.selectedStamp?.id === 'triangle'}
            >
              {icons.TriangleIcon || 'Triangle'}
            </button>
          )}

          {enabled.hexagon && (
            <button
              className={classNames.button}
              onClick={() => {
                helper.tools.setTool('stamp');
                helper.stamps.hexagon();
              }}
              data-active={helper.state.slowState.currentTool === 'stamp' && state.selectedStamp?.id === 'hexagon'}
            >
              {icons.HexagonIcon || 'Hexagon'}
            </button>
          )}

          {enabled.circle && (
            <button
              className={classNames.button}
              data-active={helper.state.slowState.currentTool === 'stamp' && state.selectedStamp?.id === 'circle'}
              onClick={() => {
                helper.tools.setTool('stamp');
                helper.stamps.circle();
              }}
            >
              {icons.CircleIcon || 'Circle'}
            </button>
          )}
        </>
      ) : null}
      {state.showBoundingBox && enabled.delete && (
        <button className={classNames.button} onClick={() => helper.key.down('Backspace')}>
          {icons.DeleteForeverIcon || 'Delete'}
        </button>
      )}
    </>
  );
}

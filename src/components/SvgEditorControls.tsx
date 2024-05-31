import { ReactNode } from 'react';
import { useSvgEditor } from '../hooks/useSvgEditor';

type HelperType = ReturnType<typeof useSvgEditor>['helper'];
type StateType = ReturnType<typeof useSvgEditor>['state'];

interface RenderSvgEditorControlsProps {
  helper: HelperType;
  state: StateType;
  showShapes: boolean;
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
  helper,
  showShapes,
  state,
  enabled = defaultEnabled,
  classNames = {},
  icons = {},
}: RenderSvgEditorControlsProps) {
  return (
    <>
      {showShapes ? (
        <>
          {enabled.draw && (
            <button
              className={classNames.button}
              onClick={() => {
                helper.stamps.clear();
                helper.draw.enable();
              }}
              data-active={!state.lineMode && !state.selectedStamp && showShapes && state.drawMode}
            >
              {icons.DrawIcon || 'Draw'}
            </button>
          )}
          {enabled.polygon && (
            <button
              className={classNames.button}
              data-active={!state.lineMode && !state.selectedStamp && showShapes && !state.drawMode}
              onClick={() => {
                helper.stamps.clear();
                helper.draw.disable();
                helper.modes.disableLineBoxMode();
                helper.modes.disableLineMode();
              }}
            >
              {icons.PolygonIcon || 'Polygon'}
            </button>
          )}
          {enabled.line && (
            <button
              className={classNames.button}
              data-active={state.lineMode && !state.lineBoxMode}
              onClick={() => {
                helper.modes.enableLineMode();
              }}
            >
              {icons.LineIcon || 'Line'}
            </button>
          )}
          {enabled.lineBox && (
            <button
              className={classNames.button}
              data-active={state.lineBoxMode}
              onClick={() => {
                helper.modes.enableLineBoxMode();
              }}
            >
              {icons.LineBoxIcon || 'LineBox'}
            </button>
          )}

          {enabled.square && (
            <button
              className={classNames.button}
              data-active={state.selectedStamp?.id === 'square'}
              onClick={() => {
                helper.stamps.square();
              }}
            >
              {icons.SquareIcon || 'Square'}
            </button>
          )}

          {enabled.triangle && (
            <button
              className={classNames.button}
              data-active={state.selectedStamp?.id === 'triangle'}
              onClick={() => {
                helper.stamps.triangle();
              }}
            >
              {icons.TriangleIcon || 'Triangle'}
            </button>
          )}

          {enabled.hexagon && (
            <button
              className={classNames.button}
              data-active={state.selectedStamp?.id === 'hexagon'}
              onClick={() => {
                helper.stamps.hexagon();
              }}
            >
              {icons.HexagonIcon || 'Hexagon'}
            </button>
          )}

          {/* {enabled.circle && (
            <button 
              data-active={state.selectedStamp?.id === 'circle'}
              onClick={() => {
                helper.stamps.circle();
              }}
            >
              {icons.CircleIcon || 'Circle'}
            </button>
          )} */}
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

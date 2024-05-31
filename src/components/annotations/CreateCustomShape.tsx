import { BoxStyle, HTMLPortal, useAtlas } from '@atlas-viewer/atlas';
import { useSvgEditor } from '../../hooks/useSvgEditor';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export const svgThemes = [
  {
    name: 'Default',
    outer: { borderWidth: 4, borderColor: 'rgba(255, 255, 255, .4)' },
    inner: { borderWidth: 2, borderColor: '#000' },
  },
  {
    name: 'High contrast',
    outer: { borderWidth: 3, borderColor: '#fff' },
    inner: { borderWidth: 1, borderColor: '#000' },
  },
  {
    name: 'Lightsaber',
    outer: { borderWidth: '4', borderColor: 'rgba(56,68,255,0.64)' },
    inner: { borderWidth: '2', borderColor: '#fff' },
  },
  {
    name: 'Bright',
    outer: { borderWidth: '6', borderColor: '#25d527' },
    inner: { borderWidth: '3', borderColor: '#a916ff' },
  },
  {
    name: 'pink',
    outer: { borderWidth: '4', borderColor: '#ff00ff' },
    inner: { borderWidth: '2', borderColor: '#ffffff' },
  },
  {
    name: 'fine (dark)',
    outer: { borderWidth: '1', borderColor: '#000000' },
    inner: {},
  },
  {
    name: 'fine (light)',
    outer: { borderWidth: '1', borderColor: '#FFF' },
    inner: {},
  },
];

type HelperType = ReturnType<typeof useSvgEditor>['helper'];
type StateType = ReturnType<typeof useSvgEditor>['state'];

export type SvgTheme = { name?: string; outer: BoxStyle; inner: BoxStyle };

export interface CreateCustomShapeProps {
  image: { width: number; height: number };
  shape?: any;
  updateShape: any;
  theme?: { name?: string; outer: BoxStyle; inner: BoxStyle };
  controlsHtmlId?: string;
  renderControls?: (helper: HelperType, state: StateType, showShapes: boolean) => any;
}

export function CreateCustomShape(props: CreateCustomShapeProps) {
  const theme = props.theme || svgThemes[0];
  const atlas = useAtlas();
  const { image } = props;
  const {
    helper,
    defs,
    editor,
    state,
    transitionDirection,
    isSplitting,
    transitionRotate,
    isHoveringPoint,
    isAddingPoint,
    isStamping,
  } = useSvgEditor(
    {
      currentShape: props.shape || null,
      onChange: props.updateShape,
      image: props.image,
      hideShapeLines: true,
    },
    []
  );

  const mouseMove = (e: any) => {
    helper.pointer([[~~e.atlas.x, ~~e.atlas.y]]);
  };

  useEffect(() => {
    const handler = (e: any) => {
      helper.key.up(e.key);
    };

    document.addEventListener('keyup', handler);
    return () => {
      document.removeEventListener('keyup', handler);
    };
  }, []);
  useEffect(() => {
    const handler = (e: any) => {
      helper.key.down(e.key);
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, []);

  useEffect(() => {
    const wrapperClasses: Array<`atlas-cursor-${string}`> = [];
    if (transitionDirection) {
      wrapperClasses.push(`atlas-cursor-${transitionDirection}`);
    }
    if (state.actionIntentType === 'cut-line' && state.modifiers?.Shift) {
      wrapperClasses.push('atlas-cursor-cut');
    }
    if (isHoveringPoint || state.transitionIntentType === 'move-shape' || state.transitionIntentType === 'move-point') {
      wrapperClasses.push('atlas-cursor-move');
    }
    if (isAddingPoint) {
      wrapperClasses.push('atlas-cursor-crosshair');
    }
    if (isSplitting) {
      wrapperClasses.push('atlas-cursor-copy');
    }
    if (transitionRotate) {
      wrapperClasses.push('atlas-cursor-rotate');
    }
    if (state.transitionIntentType === 'draw-shape') {
      wrapperClasses.push('atlas-cursor-draw');
    }

    if (atlas?.canvas) {
      atlas.canvas.classList.add(...wrapperClasses);
    }
    return () => {
      if (atlas?.canvas) {
        atlas.canvas.classList.remove(...wrapperClasses);
      }
    };
  }, [
    atlas?.canvas,
    isAddingPoint,
    isHoveringPoint,
    isSplitting,
    state.modifiers?.Shift,
    state.actionIntentType,
    state.transitionIntentType,
    transitionDirection,
    transitionRotate,
  ]);

  const showShapes = props.shape && props.shape?.points.length === 0;
  const controlsComponent = props.renderControls ? props.renderControls(helper, state, showShapes) : null;

  const controls = document.getElementById(props.controlsHtmlId || 'atlas-controls');
  const Shape = 'shape' as any;

  return (
    <>
      <world-object
        height={image.height}
        width={image.width}
        onMouseMove={mouseMove}
        onMouseDown={helper.pointerDown}
        onMouseUp={helper.pointerUp}
        onMouseLeave={helper.blur}
      >
        {props.shape ? (
          <>
            <Shape
              open={props.shape.open}
              points={props.shape.points as any}
              relativeStyle={true}
              style={isStamping ? {} : (theme.outer as any)}
            />
            <Shape
              open={props.shape.open}
              points={props.shape.points as any}
              relativeStyle={true}
              style={isStamping ? {} : (theme.inner as any)}
            />
          </>
        ) : null}
        <HTMLPortal relative={true} interactive={false}>
          <div style={{ position: 'absolute', top: 0, right: 0, left: 0, bottom: 0 }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${image.width} ${image.height}`} tabIndex={-1}>
              <defs>{defs}</defs>
              {editor}
            </svg>
          </div>
          {controls ? createPortal(controlsComponent, controls, 'controls') : null}
        </HTMLPortal>
      </world-object>
    </>
  );
}

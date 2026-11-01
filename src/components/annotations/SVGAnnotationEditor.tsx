import { usePolygonInput } from '../../hooks/usePolygonInput';
import { HTMLPortal, useAtlas } from '@atlas-viewer/atlas';
import { useEffect, useRef } from 'react';
import { type SVGTheme, type SvgEditorOptions, useSvgEditor } from '../../hooks/useSvgEditor';

export interface CreateCustomShapeProps {
  image: { width: number; height: number };
  theme?: Partial<SVGTheme>;
  svgOptions?: Omit<SvgEditorOptions, 'image' | 'theme' | 'onChange'>;
  onContextMenu?: (e: any) => void;
}

export function SVGAnnotationEditor(props: CreateCustomShapeProps) {
  const atlas = useAtlas();
  const editorElement = useRef<SVGSVGElement>(null);
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
  } = useSvgEditor({
    image: props.image,
    theme: props.theme,
    ...props.svgOptions,
  });

  const input = usePolygonInput<PointerEvent>({
    helper,
    element: editorElement,
    capturePointer: false,
    // The portal transform includes the canvas position, viewer zoom and rotation.
    toWorld: (event) => {
      const matrix = editorElement.current?.getScreenCTM();
      if (!matrix) return null;
      helper.setScale(1 / Math.hypot(matrix.a, matrix.b));
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      return [point.x, point.y];
    },
  });
  const latestInput = useRef(input);
  latestInput.current = input;

  useEffect(() => {
    const canvas = atlas?.canvas;
    if (!canvas) return;
    const previousTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic or already-released pointers cannot be captured; drags still work while over the canvas.
      }
      latestInput.current.pointerDown(event);
    };
    const move = (event: PointerEvent) => latestInput.current.pointerMove(event);
    const up = (event: PointerEvent) => {
      latestInput.current.pointerUp(event);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const cancel = (event: PointerEvent) => latestInput.current.pointerCancel(event);
    const lost = () => latestInput.current.lostPointerCapture();
    const leave = () => latestInput.current.pointerLeave();
    const doubleClick = (event: MouseEvent) => latestInput.current.doubleClick(event as PointerEvent);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('lostpointercapture', lost);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('dblclick', doubleClick);
    return () => {
      canvas.style.touchAction = previousTouchAction;
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', lost);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('dblclick', doubleClick);
    };
  }, [atlas?.canvas]);

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

    const canvas = atlas?.canvas;
    const previousCursor = canvas?.style.cursor || '';
    if (canvas) {
      canvas.classList.add(...wrapperClasses);
      // Cursor feedback must work without the legacy demo stylesheet. Retain
      // host-provided cursor classes, including custom rotate/draw icons.
      const suppliedCursor = getComputedStyle(canvas).cursor;
      if (!suppliedCursor || suppliedCursor === 'auto' || suppliedCursor === 'default') {
        const closing = ['close-shape', 'close-shape-line'].includes(state.actionIntentType || '');
        canvas.style.cursor = closing
          ? 'pointer'
          : transitionRotate
            ? 'grab'
            : isSplitting
              ? 'copy'
              : isHoveringPoint || ['move-shape', 'move-point'].includes(state.transitionIntentType || '')
                ? 'move'
                : transitionDirection
                  ? `${transitionDirection}-resize`
                  : ['pen', 'line', 'box', 'pencil', 'lineBox', 'stamp'].includes(state.currentTool)
                    ? 'crosshair'
                    : 'default';
      }
    }
    return () => {
      if (atlas?.canvas) {
        atlas.canvas.classList.remove(...wrapperClasses);
        atlas.canvas.style.cursor = previousCursor;
      }
    };
  }, [
    atlas?.canvas,
    isAddingPoint,
    isHoveringPoint,
    isSplitting,
    state.modifiers?.Shift,
    state.currentTool,
    state.actionIntentType,
    state.transitionIntentType,
    transitionDirection,
    transitionRotate,
  ]);

  return (
    <world-object height={image.height} width={image.width}>
      <HTMLPortal relative={true} interactive={false}>
        <div className="absolute top-0 right-0 left-0 bottom-0">
          <svg
            ref={editorElement}
            width="100%"
            height="100%"
            viewBox={`0 0 ${image.width} ${image.height}`}
            tabIndex={-1}
            aria-label="Drawing canvas"
          >
            <title>Annotation Editor</title>
            <defs>{defs}</defs>
            {editor}
          </svg>
        </div>
      </HTMLPortal>
    </world-object>
  );
}

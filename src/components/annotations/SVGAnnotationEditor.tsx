import { HTMLPortal, useAtlas } from '@atlas-viewer/atlas';
import { useEffect } from 'react';
import { type SVGTheme, useSvgEditor } from '../../hooks/useSvgEditor';

export interface CreateCustomShapeProps {
  image: { width: number; height: number };
  theme?: Partial<SVGTheme>;
}

export function SVGAnnotationEditor(props: CreateCustomShapeProps) {
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
  } = useSvgEditor({
    image: props.image,
    theme: props.theme,
  });

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
  }, [helper]);

  useEffect(() => {
    const handler = (e: any) => {
      // Check if the target is input, textarea or something else
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        return;
      }

      helper.key.down(e.key);
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [helper]);

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

  return (
    <world-object
      height={image.height}
      width={image.width}
      onMouseMove={mouseMove}
      onMouseDown={helper.pointerDown}
      onMouseUp={helper.pointerUp}
      onMouseLeave={helper.blur}
    >
      <HTMLPortal relative={true} interactive={false}>
        <div className="absolute top-0 right-0 left-0 bottom-0">
          <svg width="100%" height="100%" viewBox={`0 0 ${image.width} ${image.height}`} tabIndex={-1}>
            <title>Annotation Editor</title>
            <defs>{defs}</defs>
            {editor}
          </svg>
        </div>
      </HTMLPortal>
    </world-object>
  );
}

import { createSvgHelpers, type InputShape, type RenderState, type SlowState } from 'polygon-editor';
import { useEffect, useRef, useState } from 'react';
import { usePolygonHelper } from './usePolygonHelper';

const svgHelpers = createSvgHelpers();

interface SvgEditorOptions {
  image: { height: number; width: number };
  hideShapeLines?: boolean;
  onChange?: (shape: InputShape) => void;
}

export function useSvgEditor(options: SvgEditorOptions) {
  const { image } = options;
  const boundingBox = useRef<any>();
  const transitionBoundingBox = useRef<any>();
  const selectBox = useRef<any>();
  const hint = useRef<any>();
  const transitionDraw = useRef<any>();
  const transitionShape = useRef<any>();
  const pointLine = useRef<any>();
  const lineBox = useRef<any>();
  const closestLine = useRef<any>();
  const [transitionDirection, setTransitionDirection] = useState<string | null>(null);
  const [transitionRotate, setTransitionRotate] = useState<boolean>(false);
  const { helper, state, currentShape } = usePolygonHelper((renderState: RenderState, slowState: SlowState) => {
    renderState.closestLineIndex;
    svgHelpers.updateTransitionBoundingBox(transitionBoundingBox.current, renderState, slowState);
    svgHelpers.updateBoundingBoxPolygon(boundingBox.current, renderState, slowState);
    svgHelpers.updateTransitionShape(transitionShape.current, renderState, slowState);
    svgHelpers.updateClosestLinePointTransform(hint.current, renderState, slowState);
    svgHelpers.updateSelectBox(selectBox.current, renderState, slowState);
    svgHelpers.updatePointLine(pointLine.current, renderState, slowState);
    svgHelpers.updateDrawPreview(transitionDraw.current, renderState, slowState, 3);
    svgHelpers.updateLineBox(lineBox.current, renderState);
    setTransitionDirection(renderState.transitionDirection);
    setTransitionRotate(renderState.transitionRotate);

    // Update closestLine
    if (renderState.closestLineIndex !== -1 && closestLine.current) {
      const shape = renderState.polygon;
      const linePointA = shape.points[renderState.closestLineIndex];
      const linePointB = shape.points[(renderState.closestLineIndex + 1) % shape.points.length];
      if (linePointA && linePointB) {
        closestLine.current.setAttribute(
          'points',
          `${linePointA[0]},${linePointA[1]} ${linePointB[0]},${linePointB[1]}`,
        );
      }
    }
  });

  useEffect(() => {
    const windowBlur = () => {
      helper.modifiers.reset();
    };
    document.addEventListener('mouseleave', windowBlur);
    return () => {
      document.removeEventListener('mouseleave', windowBlur);
    };
  }, []);

  // @todo Paste
  // useEffect(() => {
  //   const onPaste = async (e: any) => {
  //     e.preventDefault();
  //     e.stopPropagation();
  //
  //     const paste = (e.clipboardData || (window as any).clipboardData).getData('text');
  //
  //     const parsed = parseSelector({
  //       type: 'SvgSelector',
  //       value: paste,
  //     });
  //     try {
  //       if (parsed.selector && parsed.selector.type === 'SvgSelector') {
  //         const points = parsed.selector.points;
  //         if (points) {
  //           // 1. We need to translate all the points to 0,0
  //           let x = Math.min(...points.map(p => p[0]));
  //           let y = Math.min(...points.map(p => p[1]));
  //           const maxX = Math.max(...points.map(p => p[0]));
  //           const maxY = Math.max(...points.map(p => p[1]));
  //           const width = maxX - x;
  //           const height = maxY - y;
  //
  //           if (helper.state.pointer) {
  //             x -= helper.state.pointer[0] - width / 2;
  //             y -= helper.state.pointer[1] - height / 2;
  //           }
  //           const newPoints: [number, number][] = points.map(p => [p[0] - x, p[1] - y]);
  //
  //           helper.setShape({
  //             points: newPoints,
  //             open: false,
  //           });
  //         }
  //       }
  //     } catch (e) {
  //       console.log('Error parsing pasted svg');
  //       console.error(e);
  //     }
  //   };
  //
  //   window.addEventListener('paste', onPaste);
  //   return () => {
  //     window.removeEventListener('paste', onPaste);
  //   };
  // }, []);

  // @todo Copy
  // useEffect(() => {
  //   const onCopy = async (e: any) => {
  //     if (!helper.state.polygon.points.length) {
  //       return;
  //     }
  //     e.clipboardData.setData(
  //       'text/plain',
  //       `<svg  width="${image.width}" height="${image.height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${
  //         image.width
  //       } ${image.height}"><g><polygon points="${helper.state.polygon.points
  //         .map(r => r.join(','))
  //         .join(' ')}" /></g></svg>`
  //     );
  //     e.preventDefault();
  //   };
  //
  //   window.addEventListener('copy', onCopy);
  //   return () => {
  //     window.removeEventListener('copy', onCopy);
  //   };
  // }, []);

  // Default styles for markers.
  const defs = (
    <>
      {/* Marker */}
      <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
        <circle cx="5" cy="5" r="4" fill="#fff" stroke="#000" strokeWidth="2" className="marker" />
      </marker>

      {/* New Marker */}
      <marker id="newdot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
        <circle cx="5" cy="5" r="4" fill="#F26725" stroke="#F26725" strokeWidth="2" className="marker" />
      </marker>

      {/* Selected points color */}
      <marker id="selected" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
        <circle cx="5" cy="5" r="4" fill="#0000FF" strokeWidth="1" stroke="#000" />
      </marker>

      {/* Square corners of the bounding box */}
      <marker id="resizer" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
        <rect width="10" height="10" stroke="#00FF00" fill="#fff" strokeWidth={2} />
      </marker>
    </>
  );

  const Shape = currentShape ? (currentShape.open ? 'polyline' : 'polygon') : null;
  const isHoveringPoint =
    !state.showBoundingBox && state.closestPoint !== null && state.actionIntentType === 'select-point';
  const isAddingPoint = state.actionIntentType === 'add-open-point';
  const isSplitting = state.transitionIntentType === 'split-line';

  const isStamping = state.transitioning && state.selectedStamp && state.transitionIntentType === 'stamp-shape';

  // - SelectedShapeBackground
  // - TransitionShapeBackground
  //   - LineBoxBackground
  // - DrawingOutline

  const editor =
    currentShape && Shape ? (
      <>
        {/* The shape itself when its selected. */}
        <Shape
          fill={
            (!state.transitioning || state.transitionIntentType === 'select-multiple-points') && !currentShape.open
              ? 'rgba(0, 255, 0, .5)'
              : 'none'
          }
          strokeWidth={isStamping ? 0 : 2}
          stroke={'#000'}
          points={currentShape.points.map((r) => r.join(',')).join(' ')}
          vectorEffect="non-scaling-stroke"
          markerStart={!state.showBoundingBox ? (state.boxMode ? 'url(#resizer)' : 'url(#dot)') : undefined}
          markerMid={!state.showBoundingBox ? (state.boxMode ? 'url(#resizer)' : 'url(#dot)') : undefined}
          markerEnd={!state.showBoundingBox ? (state.boxMode ? 'url(#resizer)' : 'url(#dot)') : undefined}
          style={{ pointerEvents: 'none' }}
          opacity={state.transitioning && state.transitionIntentType === 'move-shape' ? 0 : 1}
        />

        {/* Only shown when the linebox is being drawn (transition) */}
        {state.currentTool === 'lineBox' && state.actionIntentType === 'close-line-box' ? (
          <polygon
            fill="rgba(0, 0, 255, .4)"
            ref={lineBox}
            stroke="#000"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* Outline of the pencil drawing */}
        {state.transitionIntentType === 'draw-shape' && state.transitioning ? (
          <polyline
            ref={transitionDraw}
            fill="none"
            stroke="rgba(255, 0, 255, .5)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* Shape created by selected points. Used for rendering selected points. (Dont show) */}
        {!state.showBoundingBox && state.selectedPoints && state.selectedPoints.length ? (
          <polyline
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            stroke="transparent"
            markerStart="url(#selected)"
            markerMid="url(#selected)"
            markerEnd="url(#selected)"
            fill="transparent"
            points={currentShape.points
              .filter((p, idx) => state.selectedPoints?.includes(idx))
              .map((r) => r.join(','))
              .join(' ')}
            opacity={state.transitioning && state.transitionIntentType === 'move-shape' ? 0 : 1}
          />
        ) : null}

        {/* Shape created by all points. Used for rendering all points. (Dont show) */}
        {isHoveringPoint && state.closestPoint !== null && currentShape.points[state.closestPoint] ? (
          <polyline
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            stroke="transparent"
            markerStart="url(#selected)"
            markerMid="url(#selected)"
            markerEnd="url(#selected)"
            fill="rgba(255,255,0)"
            points={`${currentShape.points[state.closestPoint]![0]},${currentShape.points[state.closestPoint]![1]}`}
            opacity={state.transitioning && state.transitionIntentType === 'move-shape' ? 0 : 1}
          />
        ) : null}

        {/* The tracer from the users mouse to the next point */}
        {!state.transitioning &&
        (state.actionIntentType === 'add-open-point' ||
          state.actionIntentType === 'close-shape' ||
          state.actionIntentType === 'close-shape-line') ? (
          <polyline
            stroke="#0000ff"
            ref={pointLine}
            strokeWidth={state.actionIntentType === 'add-open-point' ? 1 : 2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* Draw the closest line */}
        {state.hasClosestLine &&
        !state.showBoundingBox &&
        state.currentTool !== 'box' &&
        state.transitionIntentType === 'split-line' ? (
          <g>
            <polyline
              ref={closestLine}
              vectorEffect="non-scaling-stroke"
              fill="transparent"
              stroke="#F26725"
              strokeWidth={3}
            />
          </g>
        ) : null}

        {/* The preview that appears in the splitline */}
        {state.hasClosestLine &&
        !state.showBoundingBox &&
        state.currentTool !== 'box' &&
        state.transitionIntentType === 'split-line' ? (
          <g ref={hint}>
            <polyline
              markerStart="url(#newdot)"
              points="0,0 1,1"
              vectorEffect="non-scaling-stroke"
              stroke="transparent"
              fill="transparent"
              strokeWidth={2}
            />
          </g>
        ) : null}

        {/* Ghost shape when transitioning */}
        {state.transitioning ? (
          <Shape
            ref={transitionShape}
            fill={currentShape.open ? 'none' : 'rgba(0, 255, 0, .5)'}
            stroke="rgba(0, 0, 0, .5)"
            strokeWidth={currentShape.open ? 2 : 2}
          />
        ) : null}

        {/* The ghost that appears when selecting points via a box */}
        {state.transitioning && state.transitionIntentType === 'select-multiple-points' ? (
          <rect
            ref={selectBox}
            fill="rgba(255, 255, 255, .3)"
            strokeWidth={1}
            stroke="rgba(0,0,0,.2)"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* Bounding box itself, should match the resizer */}
        {state.showBoundingBox && !isStamping ? (
          <polygon
            ref={boundingBox}
            strokeWidth={2}
            stroke="#000000"
            fill="none"
            markerStart="url(#resizer)"
            markerMid="url(#resizer)"
            markerEnd="url(#resizer)"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {helper.snap.isActive() &&
          helper.snap.getActiveGuides().map((guide, index) => {
            switch (guide.type) {
              case 'point':
                return (
                  <circle
                    key={`snap-point-${index}`}
                    cx={guide.points[0][0]}
                    cy={guide.points[0][1]}
                    r="8"
                    fill="none"
                    stroke="#00ff00"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              case 'line':
                return (
                  <g key={`snap-line-${index}`}>
                    <line
                      x1={guide.points[0][0]}
                      y1={guide.points[0][1]}
                      x2={guide.points[1][0]}
                      y2={guide.points[1][1]}
                      stroke="#0080ff"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      cx={guide.points[2][0]}
                      cy={guide.points[2][1]}
                      r="4"
                      fill="#0080ff"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              case 'cross': {
                const [x, y] = guide.points[0];
                return (
                  <g key={`snap-cross-${index}`}>
                    <line
                      x1={x - 6}
                      y1={y - 6}
                      x2={x + 6}
                      y2={y + 6}
                      stroke="#ff8000"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={x - 6}
                      y1={y + 6}
                      x2={x + 6}
                      y2={y - 6}
                      stroke="#ff8000"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              }
              case 'parallel-line':
                return (
                  <line
                    key={`snap-parallel-${index}`}
                    x1={guide.points[0][0]}
                    y1={guide.points[0][1]}
                    x2={guide.points[1][0]}
                    y2={guide.points[1][1]}
                    stroke="#ff00ff"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              default:
                return null;
            }
          })}
      </>
    ) : null;

  return {
    currentTool: helper.state.slowState.currentTool,
    setCurrentTool: helper.tools.setTool,

    helper,
    currentShape,
    state,
    isAddingPoint,
    isSplitting,
    isStamping,
    isHoveringPoint,
    transitionDirection,
    transitionRotate,
    defs,
    editor,
  };
}

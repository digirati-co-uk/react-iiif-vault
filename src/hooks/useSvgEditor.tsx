import { createSvgHelpers, type InputShape, type RenderState, type SlowState } from 'polygon-editor';
import { useEffect, useRef, useState } from 'react';
import { usePolygonHelper } from './usePolygonHelper';

const svgHelpers = createSvgHelpers();

interface SvgEditorOptions {
  image: { height: number; width: number };
  hideShapeLines?: boolean;
  onChange?: (shape: InputShape) => void;
  theme?: Partial<SVGTheme>;
}

export const defaultSvgTheme = {
  shapeFill: '#ffffff33',
  shapeStroke: '#000',
  lineStroke: '#000',
  ghostLineStroke: '#0F0',
  // activeLineStroke: '#F26725',
  activeLineStroke: '#4D7EEA',
  boundingBoxDottedStroke: '#0007',
  boundingBoxStroke: '#fffA',
  controlFill: '#fff',
};

export type SVGTheme = typeof defaultSvgTheme;

export function useSvgEditor(options: SvgEditorOptions) {
  const { image } = options;
  const theme = { ...(options.theme || {}), ...defaultSvgTheme };
  const boundingBox1 = useRef<any>();
  const boundingBox2 = useRef<any>();
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
    svgHelpers.updateBoundingBoxPolygon(boundingBox1.current, renderState, slowState);
    svgHelpers.updateBoundingBoxPolygon(boundingBox2.current, renderState, slowState);
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

  // Default styles for markers.
  const defs = (
    <>
      {/* Marker */}
      <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
        <circle
          cx="5"
          cy="5"
          r="4"
          fill={theme.controlFill}
          stroke={theme.lineStroke}
          strokeWidth="2"
          className="marker"
        />
      </marker>

      {/* New Marker */}
      <marker id="newdot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
        <circle
          cx="5"
          cy="5"
          r="4"
          fill={theme.activeLineStroke}
          stroke={theme.activeLineStroke}
          strokeWidth="2"
          className="marker"
        />
      </marker>

      {/* Selected points color */}
      <marker id="selected" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
        <circle cx="5" cy="5" r="4" fill={theme.activeLineStroke} strokeWidth="2" stroke={theme.lineStroke} />
      </marker>

      {/* Square corners of the bounding box */}
      <marker id="resizer" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
        <rect
          width="10"
          height="10"
          stroke={theme.lineStroke}
          fill={theme.controlFill}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </marker>
    </>
  );

  const Shape = currentShape ? (currentShape.open ? 'polyline' : 'polygon') : null;
  const isHoveringPoint =
    !state.showBoundingBox && state.closestPoint !== null && state.actionIntentType === 'select-point';
  const isAddingPoint = state.actionIntentType === 'add-open-point';
  const isSplitting = state.transitionIntentType === 'split-line';

  const isStamping = state.transitioning && state.selectedStamp && state.transitionIntentType === 'stamp-shape';

  const editor =
    currentShape && Shape ? (
      <>
        {/* The shape itself when its selected. */}
        <Shape
          fill={
            (!state.transitioning || state.transitionIntentType === 'select-multiple-points') && !currentShape.open
              ? theme.shapeFill
              : 'none'
          }
          strokeWidth={
            isStamping ||
            (state.showBoundingBox && state.boxMode) ||
            (state.transitioning && state.transitionIntentType === 'split-line') ||
            (state.transitioning && state.transitionIntentType === 'move-point')
              ? 0
              : 2
          }
          stroke={theme.shapeStroke}
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
            fill={theme.shapeFill}
            ref={lineBox}
            stroke={theme.lineStroke}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* Outline of the pencil drawing */}
        {state.transitionIntentType === 'draw-shape' && state.transitioning ? (
          <polyline
            ref={transitionDraw}
            fill="none"
            stroke={theme.activeLineStroke}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* Shape created by selected points. Used for rendering selected points. (Dont show) */}
        {!(state.transitioning && state.transitionIntentType === 'move-point') &&
        !state.showBoundingBox &&
        state.selectedPoints &&
        state.selectedPoints.length ? (
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

        {/* This renders the hover of the point */}
        {isHoveringPoint &&
        !state.transitioning &&
        state.closestPoint !== null &&
        currentShape.points[state.closestPoint] ? (
          <polyline
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            stroke="transparent"
            markerStart="url(#selected)"
            markerMid="url(#selected)"
            markerEnd="url(#selected)"
            fill={theme.activeLineStroke}
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
            stroke={theme.activeLineStroke}
            ref={pointLine}
            strokeWidth={state.actionIntentType === 'add-open-point' ? 1 : 2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* Draw the closest line */}
        {state.hasClosestLine &&
        !state.showBoundingBox &&
        !state.transitioning &&
        state.currentTool !== 'box' &&
        state.transitionIntentType === 'split-line' ? (
          <g>
            <polyline
              ref={closestLine}
              vectorEffect="non-scaling-stroke"
              fill="transparent"
              stroke={theme.activeLineStroke}
              strokeWidth={3}
            />
          </g>
        ) : null}

        {/* The preview that appears in the splitline */}
        {state.hasClosestLine &&
        !state.showBoundingBox &&
        !state.transitioning &&
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
            fill={currentShape.open ? 'none' : theme.shapeFill}
            stroke={theme.shapeStroke}
            vectorEffect="non-scaling-stroke"
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
          <>
            <polygon
              ref={boundingBox1}
              strokeWidth={2}
              stroke={theme.boundingBoxDottedStroke}
              fill="none"
              markerStart="url(#resizer)"
              markerMid="url(#resizer)"
              markerEnd="url(#resizer)"
              vectorEffect="non-scaling-stroke"
            />
            <polygon
              ref={boundingBox2}
              strokeWidth={2}
              stroke={theme.boundingBoxStroke}
              fill="none"
              strokeDasharray="4 4"
              markerStart="url(#resizer)"
              markerMid="url(#resizer)"
              markerEnd="url(#resizer)"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
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

import { polygonPath } from '../utility/polygon-path';
import { createSvgHelpers, type InputShape, type RenderState, type SlowState } from 'polygon-editor';
import { useEffect, useId, useRef, useState } from 'react';
import { usePolygonHelper } from './usePolygonHelper';

const svgHelpers = createSvgHelpers();

export interface SvgEditorOptions {
  showVertices?: boolean;
  showBoundingBox?: boolean;
  showBezierControls?: boolean;
  showSnapGuides?: boolean;
  showSnapSources?: boolean;
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

export type SVGTheme = typeof defaultSvgTheme & { curveStroke?: string; snapStroke?: string; sourceStroke?: string };

export function useSvgEditor(options: SvgEditorOptions) {
  const theme = {
    curveStroke: '#b66c22',
    snapStroke: '#913bd1',
    sourceStroke: '#64748b',
    ...defaultSvgTheme,
    ...(options.theme || {}),
  };
  const idPrefix = `svg-editor-${useId().replace(/:/g, '')}`;
  const markerIds = {
    dot: `${idPrefix}-dot`,
    newdot: `${idPrefix}-newdot`,
    selected: `${idPrefix}-selected`,
    resizer: `${idPrefix}-resizer`,
  };
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
  const [frame, setFrame] = useState<RenderState | null>(null);
  const lastFrame = useRef('');
  const { helper, state, currentShape } = usePolygonHelper((renderState: RenderState, slowState: SlowState) => {
    const key = JSON.stringify([
      renderState.transitionPoints,
      renderState.polygon.points,
      renderState.scale,
      renderState.previewPoint,
      renderState.activeSnapGuides,
      renderState.snapSources,
      renderState.boxOrigin,
      renderState.selectedPoints,
      renderState.isOpen,
    ]);
    if (key !== lastFrame.current) {
      lastFrame.current = key;
      setFrame({ ...renderState, polygon: { ...renderState.polygon }, slowState: { ...slowState } });
    }
    svgHelpers.updateTransitionBoundingBox(transitionBoundingBox.current, renderState, slowState);
    svgHelpers.updateBoundingBoxPolygon(boundingBox1.current, renderState, slowState);
    svgHelpers.updateBoundingBoxPolygon(boundingBox2.current, renderState, slowState);
    transitionShape.current?.setAttribute('d', polygonPath(renderState.transitionPoints || [], renderState.isOpen));
    svgHelpers.updateClosestLinePointTransform(hint.current, renderState, slowState);
    svgHelpers.updateSelectBox(selectBox.current, renderState, slowState);
    const line = renderState.line;
    const closing = ['close-shape', 'close-shape-line'].includes(slowState.actionIntentType || '');
    const previewLine =
      closing && renderState.polygon.points.length > 1
        ? [renderState.polygon.points[0], renderState.polygon.points.at(-1)!]
        : line;
    pointLine.current?.setAttribute('points', previewLine?.map((p) => `${p[0]},${p[1]}`).join(' ') || '');
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
        closestLine.current.setAttribute('d', polygonPath([linePointA, linePointB], true));
      }
    }
  });

  useEffect(() => {
    if (currentShape) options.onChange?.(currentShape);
  }, [currentShape, options.onChange]);

  // Markers follow the non-scaling stroke in CSS pixels; the browser handles
  // display density. Applying devicePixelRatio here enlarges Retina handles.
  const defs = (
    <>
      {/* Marker */}
      <marker id={markerIds.dot} viewBox="0 0 10 10" refX="5" refY="5" markerWidth={5} markerHeight={5}>
        <circle cx="5" cy="5" r="5" fill={theme.lineStroke} className="marker" />
        <circle cx="5" cy="5" r="3" fill={theme.controlFill} />
      </marker>

      {/* New Marker */}
      <marker id={markerIds.newdot} viewBox="0 0 10 10" refX="5" refY="5" markerWidth={5} markerHeight={5}>
        <circle cx="5" cy="5" r="5" fill={theme.activeLineStroke} className="marker" />
      </marker>

      {/* Selected points color */}
      <marker id={markerIds.selected} viewBox="0 0 10 10" refX="5" refY="5" markerWidth={5} markerHeight={5}>
        <circle cx="5" cy="5" r="5" fill={theme.lineStroke} />
        <circle cx="5" cy="5" r="3" fill={theme.activeLineStroke} />
      </marker>

      {/* Square corners of the bounding box */}
      <marker id={markerIds.resizer} viewBox="0 0 10 10" refX="5" refY="5" markerWidth={6} markerHeight={6}>
        <rect width="10" height="10" fill={theme.lineStroke} />
        <rect x="1" y="1" width="8" height="8" fill={theme.controlFill} />
      </marker>
    </>
  );

  const Shape = currentShape ? 'path' : null;
  const isHoveringPoint =
    !state.showBoundingBox &&
    state.closestPoint !== null &&
    ['select-point', 'close-shape', 'close-shape-line'].includes(state.actionIntentType || '');
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
            options.hideShapeLines ||
            isStamping ||
            (state.showBoundingBox && state.boxMode) ||
            (state.transitioning && state.transitionIntentType === 'split-line') ||
            (state.transitioning && state.transitionIntentType === 'move-point')
              ? 0
              : 2
          }
          stroke={theme.shapeStroke}
          d={polygonPath(currentShape.points, currentShape.open)}
          vectorEffect="non-scaling-stroke"
          markerStart={
            options.showVertices !== false && !state.showBoundingBox
              ? `url(#${state.boxMode ? markerIds.resizer : markerIds.dot})`
              : undefined
          }
          markerMid={
            options.showVertices !== false && !state.showBoundingBox
              ? `url(#${state.boxMode ? markerIds.resizer : markerIds.dot})`
              : undefined
          }
          markerEnd={
            options.showVertices !== false && !state.showBoundingBox
              ? `url(#${state.boxMode ? markerIds.resizer : markerIds.dot})`
              : undefined
          }
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
        !(state.transitioning && state.transitionIntentType === 'stamp-shape') &&
        options.showVertices !== false &&
        !state.showBoundingBox &&
        state.selectedPoints &&
        state.selectedPoints.length ? (
          <polyline
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            stroke="transparent"
            markerStart={`url(#${markerIds.selected})`}
            markerMid={`url(#${markerIds.selected})`}
            markerEnd={`url(#${markerIds.selected})`}
            fill="transparent"
            points={currentShape.points
              .filter((p, idx) => state.selectedPoints?.includes(idx))
              .map((r) => `${r[0]},${r[1]}`)
              .join(' ')}
            opacity={state.transitioning && state.transitionIntentType === 'move-shape' ? 0 : 1}
          />
        ) : null}

        {/* Highlight both editable vertices and the point that will close a drawing. */}
        {options.showVertices !== false &&
        isHoveringPoint &&
        !state.transitioning &&
        state.closestPoint !== null &&
        currentShape.points[state.closestPoint] ? (
          <circle
            cx={currentShape.points[state.closestPoint]![0]}
            cy={currentShape.points[state.closestPoint]![1]}
            r={5 * (frame?.scale || helper.state.scale || 1)}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            stroke={theme.lineStroke}
            fill={theme.activeLineStroke}
            data-testid="vertex-hover"
            pointerEvents="none"
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
            <path
              ref={closestLine}
              data-testid="edge-hover"
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
              markerStart={`url(#${markerIds.newdot})`}
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
            d={polygonPath(frame?.transitionPoints || [], currentShape.open)}
            fill={currentShape.open ? 'none' : theme.shapeFill}
            stroke={state.transitionIntentType === 'stamp-shape' ? theme.activeLineStroke : theme.shapeStroke}
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
        {options.showBoundingBox !== false && state.showBoundingBox && !isStamping ? (
          <>
            <polygon
              ref={boundingBox1}
              strokeWidth={2}
              stroke={theme.boundingBoxStroke}
              fill="none"
              markerStart={`url(#${markerIds.resizer})`}
              markerMid={`url(#${markerIds.resizer})`}
              markerEnd={`url(#${markerIds.resizer})`}
              vectorEffect="non-scaling-stroke"
            />
            <polygon
              ref={boundingBox2}
              strokeWidth={2}
              stroke={theme.boundingBoxDottedStroke}
              fill="none"
              strokeDasharray="4 4"
              markerStart={`url(#${markerIds.resizer})`}
              markerMid={`url(#${markerIds.resizer})`}
              markerEnd={`url(#${markerIds.resizer})`}
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}

        {frame &&
          options.showSnapSources &&
          frame.snapSources?.map((source, i) => (
            <path
              key={`source-${i}`}
              d={polygonPath(source.points, source.open)}
              fill="none"
              stroke={theme.sourceStroke}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        {frame &&
          options.showBezierControls !== false &&
          !state.showBoundingBox &&
          ['pen', 'pointer'].includes(state.currentTool) &&
          (frame.transitionPoints || currentShape.points).map((p, i, points) => {
            if (p.length !== 6 || (currentShape.open && i === points.length - 1)) return null;
            const next = points[(i + 1) % points.length];
            return (
              <g key={`curve-${i}`} data-testid="bezier-controls" pointerEvents="none">
                {([0, 1] as const).map((control) => {
                  const offset = 2 + control * 2,
                    x = p[0] + p[offset],
                    y = p[1] + p[offset + 1],
                    anchor = control === 0 ? p : next;
                  return (
                    <g key={control}>
                      <line
                        x1={anchor[0]}
                        y1={anchor[1]}
                        x2={x}
                        y2={y}
                        stroke={theme.curveStroke}
                        strokeDasharray="3 3"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={5 * frame.scale}
                        fill={theme.controlFill}
                        stroke={theme.curveStroke}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        {frame &&
          options.showSnapGuides !== false &&
          frame.activeSnapGuides.map((guide, i) => (
            <polyline
              key={`guide-${i}`}
              data-testid="snap-guide"
              points={guide.points.map((p) => `${p[0]},${p[1]}`).join(' ')}
              fill="none"
              stroke={theme.snapStroke}
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </>
    ) : null;

  return {
    currentTool: helper.state.slowState.currentTool,
    setCurrentTool: helper.tools.setTool,

    helper,
    currentShape,
    renderState: frame,
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

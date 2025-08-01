import { startTransition, useMemo } from 'react';
import { useStore } from 'zustand';
import { SVGAnnotationEditor } from '../../components/annotations/SVGAnnotationEditor';
import { useAtlasContextMenu } from '../../hooks/useAtlasContextMenu';
import { useCanvas } from '../../hooks/useCanvas';
import { useCurrentAnnotationRequest } from '../../hooks/useCurrentAnnotationRequest';
import type { SVGTheme } from '../../hooks/useSvgEditor';
import { polygonToBoundingBox } from '../../utility/polygon-to-bounding-box';
import { useAtlasStore } from '../context/atlas-store-provider';
import { RenderHighlightAnnotation } from './HighlightAnnotation';

export function RenderAnnotationEditing({
  theme,
  renderContextMenu,
  children,
}: {
  theme?: Partial<SVGTheme>;
  renderContextMenu?: (options: { canvasId?: string; position: { x: number; y: number } }) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const store = useAtlasStore();
  const canvas = useCanvas();

  const currentShape = useStore(store, (state) => state.polygon);
  const currentTool = useStore(store, (state) => state.polygonState.currentTool);
  const mode = useStore(store, (state) => state.mode);
  const changeMode = useStore(store, (state) => state.changeMode);
  const isTransitioning = useStore(store, (state) => state.polygonState.transitioning);
  const { enabled, requestId } = useStore(store, (state) => state.tool);
  const boundingBox = useMemo(() => polygonToBoundingBox(currentShape), [currentShape]);
  const request = useCurrentAnnotationRequest();
  const [contextMenu, contextMenuProps] = useAtlasContextMenu(`editing-annotation`, canvas?.id, renderContextMenu);

  const annotationPopup = request?.annotationPopup || children || <DefaultEditingTools />;
  const svgTheme = request?.svgTheme || theme;

  const onClick = () => {
    changeMode('sketch');
  };

  if (!enabled || !canvas || !requestId || !currentShape) {
    return null;
  }

  const popup =
    boundingBox &&
    currentShape.id &&
    !isTransitioning &&
    (currentTool === 'pointer' || currentTool === 'hand' || !currentShape.open) ? (
      <RenderHighlightAnnotation annotation={currentShape as any} target={boundingBox}>
        {annotationPopup}
      </RenderHighlightAnnotation>
    ) : null;

  const Shape = 'shape' as any;

  if (mode === 'explore') {
    return (
      <>
        <Shape
          id={`shape-${currentShape.id}`}
          points={currentShape.points}
          open={currentShape.open}
          onClick={onClick}
          relativeStyle={true}
          target={{ x: 0, y: 0, width: canvas.width, height: canvas.height }}
          style={{
            ':hover': {
              backgroundColor: 'rgba(0,0,0,0.2)',
            },
            backgroundColor: 'rgba(0,0,0,0)',
            borderWidth: '4px',
            borderColor: 'rgba(255, 255, 255, .4)',
          }}
          {...contextMenuProps}
        />
        <Shape
          id={`shape-${currentShape.id}`}
          points={currentShape.points}
          open={currentShape.open}
          onClick={onClick}
          relativeStyle={true}
          target={{ x: 0, y: 0, width: canvas.width, height: canvas.height }}
          style={{
            backgroundColor: 'rgba(0,0,0,0)',
            borderWidth: '2px',
            borderColor: 'rgba(0, 0, 0, .4)',
          }}
        />
        {popup}
      </>
    );
  }

  return (
    <>
      {renderContextMenu ? (
        <Shape
          id={`shape-${currentShape.id}`}
          points={currentShape.points}
          open={currentShape.open}
          target={{ x: 0, y: 0, width: canvas.width, height: canvas.height }}
          {...contextMenuProps}
        />
      ) : null}
      <SVGAnnotationEditor image={canvas} theme={svgTheme} />
      {popup}
      {contextMenu}
    </>
  );
}

export function DefaultEditingTools() {
  const store = useAtlasStore();
  const changeMode = useStore(store, (state) => state.changeMode);
  const mode = useStore(store, (state) => state.mode);
  const completeRequest = useStore(store, (state) => state.completeRequest);
  const tool = useStore(store, (state) => state.tool);

  const save = () => {
    startTransition(() => {
      completeRequest();
    });
  };

  if (!tool.enabled) {
    return null;
  }

  return (
    <div className="svg-tools-container animate-fadeIn">
      {mode !== 'sketch' && (
        <button
          className="svg-tools-button"
          onClick={() => {
            changeMode('sketch');
          }}
        >
          Edit
        </button>
      )}

      <button className="svg-tools-button" onClick={save}>
        Save
      </button>
    </div>
  );
}

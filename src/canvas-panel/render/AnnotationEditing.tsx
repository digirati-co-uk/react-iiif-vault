import { startTransition, useMemo } from 'react';
import { useStore } from 'zustand';
import { SVGAnnotationEditor } from '../../components/annotations/SVGAnnotationEditor';
import { useCanvas } from '../../hooks/useCanvas';
import { polygonToBoundingBox } from '../../utility/polygon-to-bounding-box';
import { useAtlasStore } from '../context/atlas-store-provider';
import { RenderHighlightAnnotation } from './HighlightAnnotation';

export function RenderAnnotationEditing({ children }: { children?: React.ReactNode }) {
  const store = useAtlasStore();
  const canvas = useCanvas();

  const currentShape = useStore(store, (state) => state.polygon);
  const mode = useStore(store, (state) => state.mode);
  const changeMode = useStore(store, (state) => state.changeMode);
  const isTransitioning = useStore(store, (state) => state.polygonState.transitioning);
  const { enabled, requestId } = useStore(store, (state) => state.tool);
  const boundingBox = useMemo(() => polygonToBoundingBox(currentShape), [currentShape]);

  const onClick = () => {
    changeMode('sketch');
  };

  if (!enabled || !canvas || !requestId || !currentShape) {
    return null;
  }

  const popup =
    boundingBox && currentShape.id && !isTransitioning ? (
      <RenderHighlightAnnotation annotation={currentShape as any} target={boundingBox}>
        {children || <DefaultEditingTools />}
      </RenderHighlightAnnotation>
    ) : null;

  if (mode === 'explore') {
    const Shape = 'shape' as any;

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
      <SVGAnnotationEditor image={canvas} />
      {popup}
    </>
  );
}

export function DefaultEditingTools() {
  const store = useAtlasStore();
  const changeMode = useStore(store, (state) => state.changeMode);
  const mode = useStore(store, (state) => state.mode);
  const compelteRequest = useStore(store, (state) => state.completeRequest);
  const tool = useStore(store, (state) => state.tool);

  const save = () => {
    startTransition(() => {
      compelteRequest();
    });
  };

  if (!tool.enabled) {
    return null;
  }

  return (
    <div className="animate-fadeIn">
      {mode !== 'sketch' && (
        <button
          onClick={() => {
            changeMode('sketch');
          }}
        >
          Edit
        </button>
      )}

      <button onClick={save}>Save</button>
    </div>
  );
}

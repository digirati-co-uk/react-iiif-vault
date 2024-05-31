import { InputShape } from 'polygon-editor';
import { useSelectorEvents } from '../../context/SelectorHelperContext';
import { useAnnotationStyles } from '../../context/AnnotationStylesContext';
import { CreateCustomShape, CreateCustomShapeProps, SvgTheme } from './CreateCustomShape';
import { useCanvas } from '../../hooks/useCanvas';

export interface PolygonSelectorProps {
  id: string;
  polygon: InputShape;
  annotationBucket?: string;
  isHighlighted?: boolean;
  updatePolygon?: (shape: InputShape) => void;
  readOnly?: boolean;
  theme?: SvgTheme;
  controlsHtmlId?: string;
  renderControls?: CreateCustomShapeProps['renderControls'];
}

export function PolygonSelector(props: PolygonSelectorProps) {
  const canvas = useCanvas();
  const bucket = props.annotationBucket;
  const readOnly = props.readOnly;
  const id = props.id;
  const { onClick, isHighlighted } = useSelectorEvents(props.id);
  const styles = useAnnotationStyles();
  const style = isHighlighted ? styles.highlighted : styles[bucket || 'hidden'] || styles.hidden;

  if (!canvas) {
    return null;
  }

  if (readOnly) {
    const Shape = 'shape' as any;
    const shape = props.polygon;
    const open = shape.open;
    if (!shape) {
      return null;
    }
    return (
      <Shape
        id={`shape-${id}`}
        points={shape.points}
        open={open}
        onClick={onClick}
        relativeStyle={true}
        target={{ x: 0, y: 0, width: canvas.width, height: canvas.height }}
        style={style}
      />
    );
  }

  return (
    <CreateCustomShape
      image={canvas}
      shape={props.polygon || { id: props.id, open: true, points: [] }}
      updateShape={props.updatePolygon}
      theme={props.theme}
      controlsHtmlId={props.controlsHtmlId}
      renderControls={props.renderControls}
    />
  );
}

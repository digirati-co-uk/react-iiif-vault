import { BoxStyle } from '@atlas-viewer/atlas';
import { useCanvas } from '../../hooks/useCanvas';

export function CanvasBackground({ style }: { style?: BoxStyle }) {
  const canvas = useCanvas();

  if (!canvas || !canvas.height || !canvas.width) {
    return null;
  }

  return <box interactive={false} target={{ x: 0, y: 0, width: canvas.width, height: canvas.height }} style={style} />;
}

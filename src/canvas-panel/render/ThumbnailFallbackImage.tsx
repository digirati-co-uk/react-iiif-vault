import { useCanvas } from '../../hooks/useCanvas';
import { useThumbnail } from '../../hooks/useThumbnail';
import { Box } from '@atlas-viewer/atlas';

export function ThumbnailFallbackImage({ x = 0, y = 0 }: { x?: number; y?: number }) {
  const canvas = useCanvas();
  const thumbnail = useThumbnail({ maxWidth: 256, maxHeight: 256 });

  if (!canvas || !thumbnail || thumbnail.type !== 'fixed') {
    return null;
  }

  return (
    <world-object height={canvas.height} width={canvas.width} x={x} y={y}>
      <world-image
        uri={thumbnail.id}
        target={{ x: 0, y: 0, width: canvas.width, height: canvas.height }}
        display={
          thumbnail.width && thumbnail.height
            ? {
                width: thumbnail.width,
                height: thumbnail.height,
              }
            : undefined
        }
        crop={undefined}
      />
    </world-object>
  );
}

import type { CanvasNormalized as Canvas3 } from '@iiif/parser/presentation-3-normalized/types';
import type { CanvasNormalized as Canvas4 } from '@iiif/parser/presentation-4-normalized/types';
import type { TimelineNormalized as Timeline4 } from '@iiif/parser/presentation-4-normalized/types';

export type CompatibleCanvas = (Canvas3 | Canvas4 | Timeline4) & {
  width?: number;
  height?: number;
  duration?: number;
};

export type CanvasContainerReference = {
  id: string;
  type: 'Canvas' | 'Timeline' | 'Scene';
};

export type ViewableContainerReference = Pick<CanvasContainerReference, 'id'> & {
  type: 'Canvas' | 'Timeline';
};

export function getCanvasContainerSize(canvas: CompatibleCanvas): { width: number; height: number } {
  return {
    width: typeof canvas.width === 'number' && canvas.width > 0 ? canvas.width : 1,
    height: typeof canvas.height === 'number' && canvas.height > 0 ? canvas.height : 1,
  };
}

function isContainerReference(value: unknown): value is CanvasContainerReference {
  if (!value || typeof value !== 'object' || !('id' in value) || !('type' in value)) return false;
  return (
    typeof value.id === 'string' && (value.type === 'Canvas' || value.type === 'Timeline' || value.type === 'Scene')
  );
}

export function getCanvasBackgroundColor(canvas: CompatibleCanvas | null | undefined): string | undefined {
  if (!canvas || !('backgroundColor' in canvas)) return undefined;
  return typeof canvas.backgroundColor === 'string' ? canvas.backgroundColor : undefined;
}

export function getPlaceholderContainer(canvas: CompatibleCanvas | null | undefined): CanvasContainerReference | null {
  if (!canvas) return null;
  const container =
    'placeholderContainer' in canvas
      ? canvas.placeholderContainer
      : 'placeholderCanvas' in canvas
        ? canvas.placeholderCanvas
        : null;
  return isContainerReference(container) ? container : null;
}

export function getAccompanyingContainer(canvas: CompatibleCanvas | null | undefined): CanvasContainerReference | null {
  if (!canvas) return null;
  const container =
    'accompanyingContainer' in canvas
      ? canvas.accompanyingContainer
      : 'accompanyingCanvas' in canvas
        ? canvas.accompanyingCanvas
        : null;
  return isContainerReference(container) ? container : null;
}

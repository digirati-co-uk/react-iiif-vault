import { get3dStrategy } from './3d-strategy';
import { getAudioStrategy } from './audio-strategy';
import { getImageStrategy } from './image-strategy';
import { emptyStrategy, unknownResponse, unsupportedStrategy } from './rendering-utils';
import { getTextualContentStrategy } from './textual-content-strategy';
import { getVideoStrategy } from './video-strategy';
import type { CanvasNormalized } from '@iiif/presentation-3-normalized';
import type { Paintables } from '@iiif/helpers/painting-annotations';
import type { ImageServiceLoaderType } from '../../hooks/useLoadImageService';

interface GetRenderStrategyOptions {
  canvas: CanvasNormalized | null | undefined;
  paintables: Paintables;
  supports: string[];
  loadImageService: ImageServiceLoaderType;
}

export function getRenderingStrategy({ canvas, paintables, supports, loadImageService }: GetRenderStrategyOptions) {
  if (!canvas) {
    console.log('No canvas');
    return unknownResponse;
  }

  if (paintables.types.length === 0) {
    if (supports.indexOf('empty') !== -1) {
      return emptyStrategy(canvas.width, canvas.height);
    }
    console.log('No paintables');
    return unknownResponse;
  }

  if (paintables.types.length !== 1) {
    if (paintables.types.length === 2 && paintables.types.indexOf('text') !== -1) {
      paintables.types = paintables.types.filter((t) => t !== 'text');
    } else {
      if (supports.indexOf('complex-timeline') === -1) {
        return unsupportedStrategy('Complex timeline not supported');
      }
      return unsupportedStrategy('ComplexTimelineStrategy not yet supported');
    }
  }

  const mainType = paintables.types[0];

  // Image
  if (mainType === 'image') {
    if (supports.indexOf('images') === -1) {
      return unsupportedStrategy('Image not supported');
    }

    return getImageStrategy(canvas, paintables, loadImageService);
  }

  // 3D
  if (mainType === 'Model' || mainType === 'model') {
    if (supports.indexOf('3d-model') === -1) {
      return unsupportedStrategy('3D not supported');
    }

    return get3dStrategy(canvas, paintables);
  }

  if (mainType === 'textualbody') {
    if (supports.indexOf('textual-content') === -1) {
      return unsupportedStrategy('Textual content not supported');
    }

    return getTextualContentStrategy(canvas, paintables);
  }

  if (mainType === 'sound' || mainType === 'audio') {
    if (supports.indexOf('media') === -1) {
      return unsupportedStrategy('Media not supported');
    }

    // Media Strategy with audio or audio sequence.
    return getAudioStrategy(canvas, paintables);
  }

  if (mainType === 'video') {
    if (supports.indexOf('media') === -1) {
      return unsupportedStrategy('Media not supported');
    }

    // Media Strategy with video or video sequence.
    return getVideoStrategy(canvas, paintables);
  }

  // Unknown fallback.
  return unknownResponse;
}

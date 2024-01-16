import { AnnotationPageNormalized } from '@iiif/presentation-3-normalized';
import { useCanvas } from './useCanvas';
import { useMemo } from 'react';
import { useVault } from './useVault';
import { RenderingStrategy } from '../features/rendering-strategy/strategies';
import {
  emptyActions,
  emptyStrategy,
  unknownResponse,
  unsupportedStrategy,
} from '../features/rendering-strategy/rendering-utils';
import { useAnnotationPageManager } from './useAnnotationPageManager';
import { useManifest } from './useManifest';
import { useResources } from './useResources';
import { useLoadImageService } from './useLoadImageService';
import { usePaintables } from './usePaintables';
import { getImageStrategy } from '../features/rendering-strategy/image-strategy';
import { get3dStrategy } from '../features/rendering-strategy/3d-strategy';
import { getAudioStrategy } from '../features/rendering-strategy/audio-strategy';
import { getVideoStrategy } from '../features/rendering-strategy/video-strategy';
import { getTextualContentStrategy } from '../features/rendering-strategy/textual-content-strategy';

// @todo we may not have any actions returned from the rendering strategy.
export type StrategyActions = {
  makeChoice: (id: string, options?: { deselectOthers?: boolean; deselect?: boolean }) => void;
};

export type UseRenderingStrategy = [RenderingStrategy, StrategyActions];

export type UseRenderingStrategyOptions = {
  strategies?: Array<RenderingStrategy['type']>;
  annotationPageManagerId?: string;
  enableSingleAnnotation?: boolean;
  defaultChoices?: string[];
};

export function useRenderingStrategy(options?: UseRenderingStrategyOptions): UseRenderingStrategy {
  const manifest = useManifest();
  const canvas = useCanvas();
  const vault = useVault();
  const [loadImageService, imageServiceStatus] = useLoadImageService();
  const { enabledPageIds } = useAnnotationPageManager(options?.annotationPageManagerId || manifest?.id || canvas?.id, {
    all: false,
  });
  const enabledPages = useResources<AnnotationPageNormalized>(enabledPageIds, 'AnnotationPage');

  const supports: RenderingStrategy['type'][] = options?.strategies || [
    'empty',
    'images',
    'media',
    'textual-content',
    'complex-timeline',
  ];

  const [paintables, actions] = usePaintables(options, [imageServiceStatus]);

  const strategy = useMemo(() => {
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

    console.log('No idea');
    // Unknown fallback.
    return unknownResponse;
  }, [canvas, paintables, vault, actions.makeChoice]);

  return useMemo(() => {
    if (strategy.type === 'unknown') {
      return [strategy, emptyActions];
    }

    return [
      {
        ...strategy,
        annotations: { pages: enabledPages },
      },
      actions,
    ];
  }, [strategy, enabledPages]);
}

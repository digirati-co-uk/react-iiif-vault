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
import { getRenderingStrategy } from '../features/rendering-strategy/get-rendering-strategy';

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
    return getRenderingStrategy({ canvas, paintables, supports, loadImageService });
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

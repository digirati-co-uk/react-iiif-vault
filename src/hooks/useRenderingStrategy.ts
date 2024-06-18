import { AnnotationPageNormalized } from '@iiif/presentation-3-normalized';
import { useCanvas } from './useCanvas';
import { useEffect, useMemo } from 'react';
import { useVault } from './useVault';
import { RenderingStrategy } from '../features/rendering-strategy/strategies';
import { emptyActions } from '../features/rendering-strategy/rendering-utils';
import { useAnnotationPageManager } from './useAnnotationPageManager';
import { useManifest } from './useManifest';
import { useResources } from './useResources';
import { useLoadImageService } from './useLoadImageService';
import { usePaintables } from './usePaintables';
import { getRenderingStrategy } from '../features/rendering-strategy/get-rendering-strategy';
import { Emitter } from 'mitt';
import { ComplexChoice } from '@iiif/helpers';
import { useEventEmitter } from '../context/EventContext';

// @todo we may not have any actions returned from the rendering strategy.
export type StrategyActions = {
  makeChoice: (id: string, options?: { deselectOthers?: boolean; deselect?: boolean }) => void;
};

export type UseRenderingStrategy = [RenderingStrategy, StrategyActions];

export type ChoiceEvents = {
  'choice-change': {
    choice: ComplexChoice;
    partOf: { canvasId?: string; manifestId?: string };
  };
  'make-choice': {
    choiceId: string;
    deselectOthers?: boolean;
    deselect?: boolean;
  };
};

export type UseRenderingStrategyOptions = {
  strategies?: Array<RenderingStrategy['type']>;
  annotationPageManagerId?: string;
  enableSingleAnnotation?: boolean;
  defaultChoices?: string[];
  emitter?: Emitter<ChoiceEvents>;
};

export function useRenderingStrategy(options?: UseRenderingStrategyOptions): UseRenderingStrategy {
  const manifest = useManifest();
  const canvas = useCanvas();
  const vault = useVault();
  const currentEmitter = useEventEmitter<ChoiceEvents>();
  const $em = options?.emitter || currentEmitter;
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

  useEffect(() => {
    const handler = (ev: { choiceId: string; deselectOthers?: boolean; deselect?: boolean }) => {
      actions.makeChoice(ev.choiceId, { deselectOthers: ev.deselectOthers, deselect: ev.deselect });
    };

    $em.on('make-choice', handler);

    return () => {
      $em.off('make-choice', handler);
    };
  }, []);

  const strategy = useMemo(() => {
    return getRenderingStrategy({ canvas, paintables, supports, loadImageService });
  }, [canvas, paintables, vault, actions.makeChoice]);

  useEffect(
    () => {
      const choice = paintables.allChoices;

      const partOf = { canvasId: canvas?.id, manifestId: manifest?.id };
      if (choice) {
        $em.emit('choice-change', { choice, partOf });
      }
    },
    // Should only change if the canvas ID changes.
    [canvas?.id, paintables.allChoices]
  );

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

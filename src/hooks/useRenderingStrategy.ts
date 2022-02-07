import { ContentResource, IIIFExternalWebResource, SpecificResource } from '@iiif/presentation-3';
import { useCanvas } from './useCanvas';
import { usePaintingAnnotations } from './usePaintingAnnotations';
import { useCallback, useMemo, useState } from 'react';
import { useVault } from './useVault';
import { RenderingStrategy } from '../features/rendering-strategy/strategies';
import { ImageWithOptionalService } from '../features/rendering-strategy/resource-types';
import { BoxSelector, SupportedSelectors } from '../features/rendering-strategy/selector-extensions';
import { parseSpecificResource } from '../features/rendering-strategy/rendering-utils';
import { expandTarget } from '../utility/expand-target';
import { useAnnotationPageManager } from './useAnnotationPageManager';
import { useManifest } from './useManifest';
import { useResources } from './useResources';
import { ChoiceDescription } from '../features/rendering-strategy/choice-types';
import { useLoadImageService } from './useLoadImageService';
import { getImageServices } from '@atlas-viewer/iiif-image-api';

// @todo we may not have any actions returned from the rendering strategy.
export type StrategyActions = {
  makeChoice: (id: string, options?: { deselectOthers?: boolean; deselect?: boolean }) => void;
};

export type UseRenderingStrategy = [RenderingStrategy, StrategyActions];

const emptyActions = {
  makeChoice: () => {
    // no-op
  },
};

const unknownResponse: UseRenderingStrategy = [{ type: 'unknown' }, emptyActions];

const unsupported = (reason: string): UseRenderingStrategy => {
  return [{ type: 'unknown', reason, annotations: { pages: [] } }, emptyActions];
};

export type UseRenderingStrategyOptions = {
  strategies?: Array<RenderingStrategy['type']>;
  annotationPageManagerId?: string;
  defaultChoices?: string[];
};

export function useRenderingStrategy(options?: UseRenderingStrategyOptions): UseRenderingStrategy {
  const manifest = useManifest();
  const canvas = useCanvas();
  const paintingAnnotations = usePaintingAnnotations();
  const vault = useVault();

  const [loadImageService, imageServiceStatus] = useLoadImageService();

  const { enabledPageIds } = useAnnotationPageManager(options?.annotationPageManagerId || manifest?.id, { all: false });
  const enabledPages = useResources(enabledPageIds, 'AnnotationPage');
  const [enabledChoices, setEnabledChoices] = useState<string[]>(options?.defaultChoices || []);

  // console.log('painting annotations', paintingAnnotations);

  const supports = options?.strategies || [
    'single-image',
    'composite-image',
    // 'complex-timeline' not supported yet.
    'media',
  ];

  const paintables = useMemo(() => {
    const types: string[] = [];
    let choice: ChoiceDescription | null = null;
    const items: Array<{
      type: string;
      resource: IIIFExternalWebResource | SpecificResource;
      target: any;
      selector: any;
      choices?: any[];
    }> = [];
    const state = vault.getState();
    for (const annotation of paintingAnnotations) {
      const bodies = vault.get<ContentResource>(annotation.body);
      for (const unknownBody of bodies) {
        const [body, { selector }] = parseSpecificResource(unknownBody);
        const type = (body.type || 'unknown').toLowerCase();

        // Choice
        if (type === 'choice') {
          const nestedBodies = vault.get<ContentResource>(body.items) as ContentResource[];

          // Which are active? By default the first, but we could push multiple here.
          const selected = enabledChoices.length
            ? enabledChoices.map((cid) => nestedBodies.find((b) => b.id === cid)).filter(Boolean)
            : [nestedBodies[0]];

          if (selected.length === 0) {
            selected.push(nestedBodies[0]);
          }

          // Store choice.
          choice = {
            type: 'single-choice',
            items: nestedBodies.map((b) => ({
              id: b.id,
              label: (b as any).label as any,
              selected: selected.indexOf(b) !== -1,
            })) as any[],
            label: (unknownBody as any).label,
          };

          // @todo insert in the right order.
          bodies.push(...(selected as any[]));

          continue;
        }

        if (types.indexOf(type) === -1) {
          types.push(type);
        }

        items.push({
          type: type,
          resource: body as IIIFExternalWebResource,
          target: annotation.target,
          selector,
        });
      }
    }

    return {
      types,
      items,
      choice,
    };
  }, [vault, imageServiceStatus, paintingAnnotations, enabledChoices]);

  const makeChoice = useCallback(
    (
      id: string,
      { deselectOthers = true, deselect = false }: { deselectOthers?: boolean; deselect?: boolean } = {}
    ) => {
      if (paintables.choice) {
        // Don't support multiple choice yet.
        if (paintables.choice.type !== 'single-choice') {
          throw new Error('Complex choice not supported yet');
        }

        setEnabledChoices((prevChoices) => {
          if (deselect) {
            const without = prevChoices.filter((e) => e !== id);

            if (without.length === 0) {
              const defaultId = paintables.items[0].resource.id;
              if (defaultId) {
                return [defaultId];
              } else {
                return [];
              }
            }

            return without;
          }

          if (deselectOthers) {
            return [id];
          }

          const newChoices = [...prevChoices];

          // Add the default ID.
          if (newChoices.length === 0 && paintables.items.length) {
            const defaultId = paintables.items[0].resource.id;
            if (defaultId) {
              newChoices.push(defaultId);
            }
          }

          if (prevChoices.indexOf(id) !== -1) {
            return prevChoices;
          }

          return [...prevChoices, id];
        });
      }
    },
    [paintables.choice]
  );

  const actions = {
    makeChoice,
  };

  const strategy = useMemo(() => {
    if (!canvas) {
      return unknownResponse;
    }

    if (paintables.types.length !== 1) {
      // @todo this is a ComplexTimelineStrategy.
      return unsupported('ComplexTimelineStrategy not yet supported');
    }

    const mainType = paintables.types[0];

    // Image
    if (mainType === 'image') {
      const imageTypes: ImageWithOptionalService[] = [];
      for (const singleImage of paintables.items) {
        // SingleImageStrategy
        const resource: IIIFExternalWebResource =
          singleImage.resource && singleImage.resource.type === 'SpecificResource'
            ? singleImage.resource.source
            : singleImage.resource;

        // Validation.
        if (!resource.id) {
          // @todo we could skip this?
          return unsupported('No resource Identifier');
        }

        let imageService = undefined;
        if (resource.service) {
          const imageServices = getImageServices(resource as any) as any[];
          if (imageServices[0]) {
            imageService = loadImageService(imageServices[0], canvas);
          }
        }

        // @todo temporary hacks for data normalisation.
        if (singleImage.target === 'https://bvmm.irht.cnrs.fr/iiif/2309/canvas/canvas-981394#xywh=3949,994,1091,1232') {
          singleImage.target = 'https://bvmm.irht.cnrs.fr/iiif/4490/canvas/canvas-981394#xywh=3949,994,1091,1232';
        }
        if (
          imageService &&
          imageService.width &&
          imageService.height &&
          imageService.profile === 'http://library.stanford.edu/iiif/image-api/1.1/compliance.html#level2'
        ) {
          // hack.
          imageService.profile = 'http://iiif.io/api/image/2/level2.json';
          imageService.sizes = [{ width: imageService.width, height: imageService.height }];
          imageService.tiles = [{ width: 256, height: 256, scaleFactors: [1, 2, 4, 8, 16, 32] }];
        }

        const { selector: imageTarget, source } = expandTarget(singleImage.target);

        if (source.id !== canvas.id) {
          // Skip invalid targets.
          continue;
        }

        // Target is where it should be painted.
        const defaultTarget: BoxSelector = {
          type: 'BoxSelector',
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        };

        const target: SupportedSelectors | null = imageTarget
          ? imageTarget.type === 'TemporalSelector'
            ? {
                type: 'TemporalBoxSelector',
                startTime: imageTarget.startTime,
                endTime: imageTarget.endTime,
                x: defaultTarget.x,
                y: defaultTarget.y,
                width: defaultTarget.width,
                height: defaultTarget.height,
              }
            : imageTarget
          : null;

        // Support for cropping before painting an annotation.
        const defaultImageSelector = {
          type: 'BoxSelector',
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        } as BoxSelector;
        const imageSelector =
          singleImage.resource.type === 'SpecificResource' ? expandTarget(singleImage.resource) : null;
        const selector: BoxSelector =
          imageSelector &&
          imageSelector.selector &&
          (imageSelector.selector.type === 'BoxSelector' || imageSelector.selector.type === 'TemporalBoxSelector')
            ? {
                type: 'BoxSelector',
                x: imageSelector.selector.x,
                y: imageSelector.selector.y,
                width: imageSelector.selector.width,
                height: imageSelector.selector.height,
              }
            : defaultImageSelector;

        const imageType: ImageWithOptionalService = {
          id: resource.id,
          type: 'Image',
          width: target ? resource.width : canvas.width,
          height: target ? resource.height : canvas.height,
          service: imageService,
          sizes:
            imageService && imageService.sizes
              ? imageService.sizes
              : resource.width && resource.height
              ? [{ width: resource.width, height: resource.height }]
              : [],
          target: target ? target : defaultTarget,
          selector,
        };

        imageTypes.push(imageType);
      }

      return [
        {
          type: 'images',
          image: imageTypes[0],
          images: imageTypes,
          choice: paintables.choice,
        },
        actions,
      ];
    }

    if (mainType === 'audio') {
      // Media Strategy with audio or audio sequence.
      return unsupported('Audio strategy not yet supported');
    }

    if (mainType === 'video') {
      // Media Strategy with video or video sequence.
      return unsupported('Video strategy not yet supported');
    }

    // Unknown fallback.
    return unknownResponse;
  }, [canvas, paintables, vault, actions.makeChoice]);

  return useMemo(() => {
    return [
      {
        ...strategy[0],
        annotations: { pages: enabledPages },
      } as any,
      strategy[1] as any,
    ];
  }, [strategy, enabledPages]);
}

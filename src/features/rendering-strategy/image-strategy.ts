import { CanvasNormalized, IIIFExternalWebResource, PointSelector, W3CAnnotationTarget } from '@iiif/presentation-3';
import { ImageServiceLoaderType } from '../../hooks/useLoadImageService';
import { AnnotationPageDescription, ImageWithOptionalService } from './resource-types';
import { getImageServices } from '@atlas-viewer/iiif-image-api';
import { getParsedTargetSelector, Paintables, unsupportedStrategy } from './rendering-utils';
import { ChoiceDescription } from './choice-types';
import { expandTarget, SupportedSelectors } from '@iiif/vault-helpers/annotation-targets';
import { TemporalBoxSelector, BoxSelector } from '@iiif/vault-helpers';

export type SingleImageStrategy = {
  type: 'images';
  image: ImageWithOptionalService;
  images: Array<ImageWithOptionalService>;
  choice?: ChoiceDescription;
  annotations?: AnnotationPageDescription;
};

export function getImageStrategy(
  canvas: CanvasNormalized,
  paintables: Paintables,
  loadImageService: ImageServiceLoaderType
) {
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
      return unsupportedStrategy('No resource Identifier');
    }

    let imageService = undefined;
    if (resource.service) {
      const imageServices = getImageServices(resource as any) as any[];
      if (imageServices[0]) {
        imageService = loadImageService(imageServices[0], canvas);
      }
    }

    // Target is where it should be painted.
    const defaultTarget: BoxSelector = {
      type: 'BoxSelector',
      spatial: {
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
      },
    };

    const [target, source] = getParsedTargetSelector(canvas, singleImage.target);
    if (source.id !== canvas.id) {
      // Skip invalid targets.
      continue;
    }

    // Support for cropping before painting an annotation.
    const defaultImageSelector = {
      type: 'BoxSelector',
      spatial: {
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
      },
    } as BoxSelector;
    const imageSelector = singleImage.resource.type === 'SpecificResource' ? expandTarget(singleImage.resource) : null;
    const selector: BoxSelector =
      imageSelector &&
      imageSelector.selector &&
      (imageSelector.selector.type === 'BoxSelector' || imageSelector.selector.type === 'TemporalBoxSelector')
        ? {
            type: 'BoxSelector',
            spatial: {
              x: imageSelector.selector.spatial.x,
              y: imageSelector.selector.spatial.y,
              width: imageSelector.selector.spatial.width,
              height: imageSelector.selector.spatial.height,
            },
          }
        : defaultImageSelector;

    if (imageService && !imageService.id) {
      (imageService as any).id = imageService['@id'];
    }

    const imageType: ImageWithOptionalService = {
      id: resource.id,
      type: 'Image',
      annotationId: singleImage.annotationId,
      width: target ? resource.width : canvas.width,
      height: target ? resource.height : canvas.height,
      service: imageService,
      sizes:
        imageService && imageService.sizes
          ? imageService.sizes
          : resource.width && resource.height
          ? [{ width: resource.width, height: resource.height }]
          : [],
      target: target && target.type !== 'PointSelector' ? target : defaultTarget,
      selector,
    };

    imageTypes.push(imageType);
  }

  return {
    type: 'images',
    image: imageTypes[0],
    images: imageTypes,
    choice: paintables.choice,
  } as SingleImageStrategy;
}

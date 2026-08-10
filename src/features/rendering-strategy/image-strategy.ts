import type { BoxSelector, ChoiceDescription, Paintables } from '@iiif/helpers';
import { expandTarget } from '@iiif/helpers/annotation-targets';
import { getImageServices } from '@iiif/parser/image-3';
import type { IIIFExternalWebResource as ExternalWebResource3 } from '@iiif/parser/presentation-3/types';
import type { ContentResourceLike as ExternalWebResource4 } from '@iiif/parser/presentation-4/types';
import type { ImageServiceLoaderType } from '../../hooks/useLoadImageService';
import { makeHttps } from '../../utility/make-https';
import { getCanvasContainerSize, type CompatibleCanvas } from '../../utility/canvas-compat';
import { getParsedTargetSelector, unsupportedStrategy } from './rendering-utils';
import type { AnnotationPageDescription, ImageWithOptionalService } from './resource-types';
import type { UnknownStrategy } from './strategies';

export type SingleImageStrategy = {
  type: 'images';
  image: ImageWithOptionalService;
  images: Array<ImageWithOptionalService>;
  choice?: ChoiceDescription;
  annotations?: AnnotationPageDescription;
};

type ExternalWebResource = ExternalWebResource3 | ExternalWebResource4;

function getImageApiSelectorRotation(selector: any): number | undefined {
  if (selector?.type !== 'ImageApiSelector' || typeof selector.rotation === 'undefined') {
    return undefined;
  }

  return getRotation(selector.rotation);
}

function getRotation(value: any): number | undefined {
  if (value === null || typeof value === 'undefined' || value === '') {
    return undefined;
  }

  const rotation = Number(value);
  return Number.isFinite(rotation) ? rotation : undefined;
}

function getTransformMetadata(singleImage: any) {
  const selector = singleImage.selector || {};

  return {
    ...(singleImage.rotationOrigin || selector.rotationOrigin
      ? { rotationOrigin: singleImage.rotationOrigin || selector.rotationOrigin }
      : {}),
    ...(singleImage.translate || selector.translate ? { translate: singleImage.translate || selector.translate } : {}),
    ...(singleImage.transform || selector.transform ? { transform: singleImage.transform || selector.transform } : {}),
    ...(singleImage.style || selector.boxStyle ? { style: singleImage.style || selector.boxStyle } : {}),
    ...(singleImage.styleClass ? { styleClass: singleImage.styleClass } : {}),
  };
}

export function getImageStrategy(
  canvas: CompatibleCanvas,
  paintables: Paintables,
  loadImageService: ImageServiceLoaderType
): SingleImageStrategy | UnknownStrategy {
  const canvasSize = getCanvasContainerSize(canvas);
  const imageTypes: ImageWithOptionalService[] = [];
  for (const singleImage of paintables.items) {
    // SingleImageStrategy
    const resource: ExternalWebResource =
      singleImage.resource && singleImage.resource.type === 'SpecificResource'
        ? singleImage.resource.source
        : singleImage.resource;

    // Validation.
    if (!resource.id) {
      // @todo we could skip this?
      return unsupportedStrategy('No resource Identifier');
    }
    const resourceWidth = typeof resource.width === 'number' ? resource.width : undefined;
    const resourceHeight = typeof resource.height === 'number' ? resource.height : undefined;

    const imageApiRotation =
      singleImage.resource.type === 'SpecificResource'
        ? getImageApiSelectorRotation((singleImage.resource as any).selector)
        : undefined;
    const rotation =
      imageApiRotation ??
      getImageApiSelectorRotation(singleImage.selector) ??
      getRotation((singleImage as any).rotation) ??
      getRotation((singleImage.selector as any)?.rotation);
    const hasRotation = typeof rotation !== 'undefined';

    let imageService;
    if (resource.service) {
      const imageServices = getImageServices(resource as any) as any[];
      if (imageServices[0]) {
        imageService = loadImageService(
          imageServices[0],
          hasRotation
            ? {
                width: Number(resourceWidth || canvas.width),
                height: Number(resourceHeight || canvas.height),
              }
            : canvasSize
        );
      }
    }

    // Target is where it should be painted.
    const defaultTarget: BoxSelector = {
      type: 'BoxSelector',
      spatial: {
        x: 0,
        y: 0,
        width: canvasSize.width,
        height: canvasSize.height,
      },
    };

    const [target, source] = getParsedTargetSelector(canvas, singleImage.target);
    const canvasIdNoQuery = canvas.id?.split('?')[0] || '';
    if (
      !(
        makeHttps(source.id || '') === makeHttps(canvas.id) ||
        makeHttps(decodeURIComponent(source.id || '')) === makeHttps(canvas.id || '') ||
        // Check for canvas id without query string. Assume these are valid.
        makeHttps(source.id || '') === makeHttps(canvasIdNoQuery) ||
        makeHttps(decodeURIComponent(source.id || '')) === makeHttps(canvasIdNoQuery)
      )
    ) {
      // Skip invalid targets.
      continue;
    }

    let imageSelector = singleImage.resource.type === 'SpecificResource' ? expandTarget(singleImage.resource) : null;

    if (singleImage.selector) {
      const found = expandTarget({
        type: 'SpecificResource',
        source: singleImage.resource,
        selector: singleImage.selector,
      });

      if (found) {
        imageSelector = found;
      }
    }

    const selector: undefined | BoxSelector =
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
            ...(typeof imageSelector.selector.rotation !== 'undefined'
              ? { rotation: imageSelector.selector.rotation }
              : {}),
            ...(imageSelector.selector.rotationOrigin ? { rotationOrigin: imageSelector.selector.rotationOrigin } : {}),
            ...(imageSelector.selector.translate ? { translate: imageSelector.selector.translate } : {}),
            ...(imageSelector.selector.transform ? { transform: imageSelector.selector.transform } : {}),
            ...(imageSelector.selector.boxStyle ? { boxStyle: imageSelector.selector.boxStyle } : {}),
          }
        : undefined;

    if (imageService && !imageService.id) {
      (imageService as any).id = imageService['@id'];
    }

    const imageType: ImageWithOptionalService = {
      id: resource.id,
      type: 'Image',
      annotationId: singleImage.annotationId,
      annotation: singleImage.annotation as any,
      width: Number(hasRotation || target || selector ? resourceWidth : canvas.width),
      height: Number(hasRotation || target || selector ? resourceHeight : canvas.height),
      ...(typeof rotation !== 'undefined' ? { rotation } : {}),
      ...getTransformMetadata(singleImage),
      service: imageService,
      sizes:
        imageService && imageService.sizes
          ? imageService.sizes
          : resourceWidth && resourceHeight
            ? [{ width: resourceWidth, height: resourceHeight }]
            : [],
      target: target && target.type !== 'PointSelector' ? target : defaultTarget,
      selector: selector || {
        type: 'BoxSelector',
        spatial: {
          x: 0,
          y: 0,
          width: Number(canvas.width),
          height: Number(canvas.height),
        },
      },
      annotationPages: (singleImage.resource as any).annotations || [],
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

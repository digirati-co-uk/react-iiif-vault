import { CanvasNormalized, W3CAnnotationBody } from '@iiif/presentation-3';
import { Paintables, unsupportedStrategy } from './rendering-utils';
import { AnnotationPageDescription, ImageWithOptionalService } from './resource-types';
import { ChoiceDescription } from './choice-types';
import { ExternalWebResource } from '@iiif/presentation-3/resources/annotation';
import { RenderingStrategy } from './strategies';

export type Single3DModelStrategy = {
  type: '3d-model';
  model: ExternalWebResource;
  choice?: ChoiceDescription; // future
  annotations?: AnnotationPageDescription; // future
};

const supportedFormats = ['model/gltf-binary'];

export function get3dStrategy(canvas: CanvasNormalized, paintables: Paintables): RenderingStrategy {
  const first = paintables.items[0] as ExternalWebResource;

  if (!first.format) {
    return unsupportedStrategy('Unknown format');
  }

  if (supportedFormats.indexOf(first.format) === -1) {
    return unsupportedStrategy(`3D format: ${first.format} is unsupported`);
  }

  return {
    type: '3d-model',
    model: first as any,
  } as Single3DModelStrategy;
}

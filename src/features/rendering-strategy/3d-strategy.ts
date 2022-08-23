import { CanvasNormalized } from '@iiif/presentation-3';
import { Paintables, unsupportedStrategy } from './rendering-utils';
import { AnnotationPageDescription } from './resource-types';
import { ChoiceDescription } from './choice-types';
import { ExternalWebResource } from '@iiif/presentation-3';
import { RenderingStrategy } from './strategies';

export type Single3DModelStrategy = {
  type: '3d-model';
  model: ExternalWebResource;
  choice?: ChoiceDescription; // future
  annotations?: AnnotationPageDescription; // future
};

const supportedFormats = ['model/gltf-binary'];

export function get3dStrategy(canvas: CanvasNormalized, paintables: Paintables): RenderingStrategy {
  const first = paintables.items[0];
  const resource = first.resource as ExternalWebResource;

  if (!resource.format) {
    return unsupportedStrategy('Unknown format');
  }

  if (supportedFormats.indexOf(resource.format) === -1) {
    return unsupportedStrategy(`3D format: ${resource.format} is unsupported`);
  }

  return {
    type: '3d-model',
    model: resource as any,
  } as Single3DModelStrategy;
}

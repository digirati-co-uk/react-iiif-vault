import type { AnnotationNormalized } from '@iiif/parser/presentation-3-normalized/types';
import { unsupportedStrategy } from './rendering-utils';
import { AnnotationPageDescription } from './resource-types';
import type { ExternalWebResource } from '@iiif/parser/presentation-3/types';
import { RenderingStrategy } from './strategies';
import { ChoiceDescription, Paintables } from '@iiif/helpers';
import type { CompatibleCanvas } from '../../utility/canvas-compat';

export type Single3DModelStrategy = {
  type: '3d-model';
  model: ExternalWebResource;
  choice?: ChoiceDescription; // future
  annotations?: AnnotationPageDescription; // future
  annotation: AnnotationNormalized;
  annotationId: string;
};

const supportedFormats = ['model/gltf-binary'];

export function get3dStrategy(canvas: CompatibleCanvas, paintables: Paintables): RenderingStrategy {
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
    annotationId: first.annotationId,
    annotation: first.annotation,
  } as Single3DModelStrategy;
}

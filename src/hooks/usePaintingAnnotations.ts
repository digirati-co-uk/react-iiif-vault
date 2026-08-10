// This is valid under a canvas context.
import type { AnnotationNormalized, AnnotationPageNormalized } from '@iiif/parser/presentation-3-normalized/types';
import { useCanvasContainer } from './useCanvasContainer';
import { useVaultSelector } from './useVaultSelector';
import { useAnnotation } from './useAnnotation';

export function usePaintingAnnotations(
  options: { canvasId?: string; enableSingleAnnotation?: boolean } = {}
): AnnotationNormalized[] {
  const annotation = useAnnotation();
  const contextContainer = useCanvasContainer();

  return useVaultSelector(
    (state, vault) => {
      const canvas = options.canvasId
        ? state.iiif.mapping[options.canvasId] === 'Timeline'
          ? state.iiif.entities.Timeline[options.canvasId]
          : state.iiif.entities.Canvas[options.canvasId]
        : contextContainer;
      if (!canvas) {
        return [];
      }
      if (annotation && options.enableSingleAnnotation) {
        return [annotation];
      }
      const annotationPages = vault.get([...canvas.items]);
      const flatAnnotations: AnnotationNormalized[] = [];
      for (const page of annotationPages) {
        flatAnnotations.push(...vault.get(page.items));
      }
      return flatAnnotations;
    },
    [contextContainer, options.canvasId]
  );
}

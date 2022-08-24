// This is valid under a canvas context.
import { AnnotationNormalized, AnnotationPageNormalized } from '@iiif/presentation-3';
import { useCanvas } from './useCanvas';
import { useVaultSelector } from './useVaultSelector';
import { useAnnotation } from './useAnnotation';

export function usePaintingAnnotations(
  options: { canvasId?: string; enableSingleAnnotation?: boolean } = {}
): AnnotationNormalized[] {
  const annotation = useAnnotation();
  const canvas = useCanvas(options.canvasId ? { id: options.canvasId } : undefined);

  return useVaultSelector(
    (state, vault) => {
      if (!canvas) {
        return [];
      }
      if (annotation && options.enableSingleAnnotation) {
        return [annotation];
      }
      const annotationPages = vault.get<AnnotationPageNormalized>(canvas.items);
      const flatAnnotations: AnnotationNormalized[] = [];
      for (const page of annotationPages) {
        flatAnnotations.push(...vault.get<AnnotationNormalized>(page.items));
      }
      return flatAnnotations;
    },
    [canvas]
  );
}

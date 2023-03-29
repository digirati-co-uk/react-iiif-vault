import { useResourceContext } from '../context/ResourceContext';
import { AnnotationPageNormalized } from '@iiif/presentation-3-normalized';
import { useMemo } from 'react';
import { useVaultSelector } from './useVaultSelector';

export function useAnnotationPage(options?: { id: string }): AnnotationPageNormalized | undefined;
export function useAnnotationPage<T>(
  options?: { id: string; selector: (annotation: AnnotationPageNormalized) => T },
  deps?: any[]
): T | undefined;
export function useAnnotationPage<T = AnnotationPageNormalized>(
  options: {
    id?: string;
    selector?: (annotation: AnnotationPageNormalized) => T;
  } = {},
  deps: any[] = []
): AnnotationPageNormalized | T | undefined {
  const { id, selector } = options;
  const ctx = useResourceContext();
  const annotationPageId = id ? id : ctx.annotationPage;

  const annotationPage = useVaultSelector(
    (s) => (annotationPageId ? s.iiif.entities.AnnotationPage[annotationPageId] : undefined),
    [annotationPageId]
  );

  return useMemo(() => {
    if (!annotationPage) {
      return undefined;
    }

    if (selector) {
      return selector(annotationPage);
    }
    return annotationPage;
  }, [annotationPage, ...deps]);
}

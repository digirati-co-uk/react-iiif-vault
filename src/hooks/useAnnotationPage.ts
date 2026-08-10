import { useResourceContext } from '../context/ResourceContext';
import type { AnnotationPageNormalized } from '@iiif/parser/presentation-3-normalized/types';
import { type DependencyList, useMemo } from 'react';
import { useVaultSelector } from './useVaultSelector';

export function useAnnotationPage(options?: {
  id?: string;
  selector?: undefined;
}): AnnotationPageNormalized | undefined;
export function useAnnotationPage<T>(
  options?: { id: string; selector: (annotation: AnnotationPageNormalized) => T },
  deps?: DependencyList
): T | undefined;
export function useAnnotationPage<T = AnnotationPageNormalized>(
  options: {
    id?: string;
    selector?: (annotation: AnnotationPageNormalized) => T;
  } = {},
  deps: DependencyList = []
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

import { useResourceContext } from '../context/ResourceContext';
import { AnnotationNormalized } from '@iiif/presentation-3-normalized';
import { useMemo } from 'react';
import { useVaultSelector } from './useVaultSelector';
import { expandTarget } from '@iiif/vault-helpers/annotation-targets';
import { useVault } from './useVault';

export function useAnnotation(options?: { id: string }): AnnotationNormalized | undefined;
export function useAnnotation<T>(
  options?: { id: string; selector: (annotation: AnnotationNormalized) => T },
  deps?: any[]
): T | undefined;
export function useAnnotation<T = AnnotationNormalized>(
  options: {
    id?: string;
    selector?: (annotation: AnnotationNormalized) => T;
  } = {},
  deps: any[] = []
): AnnotationNormalized | T | undefined {
  const { id, selector } = options;
  const ctx = useResourceContext();
  const vault = useVault();
  const annotationId = id ? id : ctx.annotation;

  const annotation = useVaultSelector(
    (s) => (annotationId ? s.iiif.entities.Annotation[annotationId] : undefined),
    [annotationId]
  );

  const body = useVaultSelector(
    (s) =>
      annotation && annotation.body
        ? annotation.body
            .map((singleBody) => (singleBody ? s.iiif.entities[singleBody.type][singleBody.id] : null))
            .filter(Boolean)
        : [],
    [annotation]
  );

  return useMemo(() => {
    if (!annotation) {
      return undefined;
    }

    const newAnnotation: any = {
      ...annotation,
      body,
      target: expandTarget(annotation.target as any, { typeMap: vault.getState().iiif.mapping }),
    };

    if (selector) {
      return selector(newAnnotation);
    }
    return newAnnotation;
  }, [annotation, selector, body, ...deps]);
}

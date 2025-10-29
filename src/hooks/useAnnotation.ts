import { expandTarget } from '@iiif/helpers/annotation-targets';
import type { AnnotationNormalized } from '@iiif/presentation-3-normalized';
import { useMemo } from 'react';
import { useResourceContext } from '../context/ResourceContext';
import { useRemoteStylesheet } from './useRemoteStylesheet';
import { useVault } from './useVault';
import { useVaultSelector } from './useVaultSelector';

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

  const [stylesheets] = useRemoteStylesheet(annotation?.stylesheet);

  const body = useVaultSelector(
    (s) =>
      annotation && annotation.body
        ? annotation.body
            .map((singleBody) => {
              if (!singleBody) {
                return null;
              }

              if ((singleBody as any).type === 'SpecificResource') {
                return {
                  ...singleBody,
                  source: vault.get(singleBody),
                };
              }

              return singleBody ? s.iiif.entities[singleBody.type][singleBody.id] : null;
            })
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
      target: expandTarget(annotation.target as any, {
        typeMap: vault.getState().iiif.mapping,
        loadedStylesheets: stylesheets,
      }),
    };

    if (selector) {
      return selector(newAnnotation);
    }
    return newAnnotation;
  }, [annotation, selector, body, stylesheets, ...deps]);
}

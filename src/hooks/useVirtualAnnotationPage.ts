import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { Annotation, AnnotationNormalized, AnnotationPageNormalized } from '@iiif/presentation-3';
import { useVault } from './useVault';
import { useVaultSelector } from './useVaultSelector';
import { entityActions } from '@iiif/vault/actions';
import { useDispatch } from './useDispatch';
import { emptyAnnotationPage } from '@iiif/parser';
import { Vault } from '@iiif/vault';

export interface VaultActivatedAnnotation {
  __vault?: Vault;
  bindToVault(vault: Vault): void;
  source: string | { id: string };
}

function isVaultActivated(obj: any): obj is VaultActivatedAnnotation {
  return typeof obj !== 'string' && obj && obj.bindToVault;
}

export function useVirtualAnnotationPage() {
  const vault = useVault();
  const sources = useRef<Record<any, any>>([]);
  const dispatch = useDispatch();
  const virtualId = useMemo(() => {
    return `vault://annotation-page/${new Date().getTime()}/${Math.round(Math.random() * 1000000000).toString(16)}`;
  }, []);

  useLayoutEffect(() => {
    const page: AnnotationPageNormalized = {
      ...emptyAnnotationPage,
      id: virtualId,
      items: [],
    };

    dispatch(
      entityActions.importEntities({
        entities: {
          AnnotationPage: {
            [page.id]: page,
          },
        },
      })
    );
  }, [virtualId]);

  const fullPage: AnnotationPageNormalized | null = useVaultSelector(
    (state) => (virtualId ? state.iiif.entities.AnnotationPage[virtualId] : null),
    [virtualId]
  );

  const addAnnotation = useCallback(
    (id: string | Annotation | VaultActivatedAnnotation | AnnotationNormalized, atIndex?: number) => {
      if (virtualId) {
        if (isVaultActivated(id)) {
          const display = id;
          if (!display.__vault) {
            // First bind to vault.
            display.bindToVault(vault);
          }
          id = typeof display.source === 'string' ? display.source : display.source.id;
          sources.current[id] = display;
        } else if (typeof id !== 'string') {
          id = id.id;
        }

        const full: AnnotationPageNormalized = vault.get({ id: virtualId, type: 'AnnotationPage' });
        const annotation: AnnotationNormalized = vault.get({ id, type: 'Annotation' });
        if (full && annotation) {
          if (!full.items.find((r: any) => r.id === annotation.id)) {
            dispatch(
              entityActions.addReference({
                id: virtualId,
                type: 'AnnotationPage',
                key: 'items',
                reference: {
                  id,
                  type: 'Annotation',
                },
                index: atIndex,
              })
            );
          }
        }
      }
    },
    [virtualId]
  );
  const removeAnnotation = useCallback(
    (id: string | Annotation | VaultActivatedAnnotation | AnnotationNormalized) => {
      if (virtualId) {
        if (isVaultActivated(id)) {
          id = typeof id.source === 'string' ? id.source : id.source.id;
        } else if (typeof id !== 'string') {
          id = id.id;
        }

        if (sources.current[id]) {
          sources.current[id].beforeRemove();
        }

        const full: AnnotationPageNormalized = vault.get({ id: virtualId, type: 'AnnotationPage' });
        if (full) {
          dispatch(
            entityActions.removeReference({
              id: virtualId,
              type: 'AnnotationPage',
              key: 'items',
              reference: {
                id,
                type: 'Annotation',
              },
            })
          );
        }
      }
    },
    [virtualId]
  );

  return [
    fullPage,
    {
      addAnnotation,
      removeAnnotation,
    },
  ] as const;
}

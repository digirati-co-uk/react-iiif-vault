import { useCallback, useMemo } from 'react';
import { useVault } from './useVault';
import { useManifest } from './useManifest';
import { useCanvas } from './useCanvas';
import { useVisibleCanvases } from '../context/VisibleCanvasContext';
import { useEnabledAnnotationPageIds } from './useEnabledAnnotationPageIds';
import { flattenAnnotationPageIds } from '../utility/flatten-annotation-page-ids';
import { IIIFStore } from '@iiif/vault';

type AnnotationPageResourceMap = {
  [id: string]: boolean;
};

type AnnotationPageManager = {
  views: AnnotationPageResourceMap;
};

function getMeta(state: IIIFStore, resourceId: string) {
  const resourceMeta = state?.iiif?.meta[resourceId];
  if (!resourceMeta) {
    return null;
  }
  return resourceMeta.annotationPageManager as AnnotationPageManager;
}

export function useAnnotationPageManager(resourceId?: string, options: { all?: boolean } = {}) {
  const vault = useVault();
  const manifest = useManifest();
  const canvas = useCanvas();
  const canvases = useVisibleCanvases();
  const availablePageIds = useMemo(() => {
    return flattenAnnotationPageIds({
      all: options.all,
      manifest,
      canvas,
      canvases,
    });
  }, [options.all, canvas, canvases, manifest]);
  const enabledPageIds = useEnabledAnnotationPageIds(resourceId, options.all ? undefined : availablePageIds);

  const setPageDisabled = useCallback(
    (deselectId: string) => {
      if (!resourceId) {
        return;
      }
      vault.setMetaValue<AnnotationPageResourceMap>(
        [deselectId, 'annotationPageManager', 'views'],
        (existingResources: AnnotationPageResourceMap | undefined) => {
          if (existingResources && !existingResources[resourceId]) {
            return existingResources;
          }

          return {
            ...(existingResources || {}),
            [resourceId]: false,
          };
        }
      );
    },
    [resourceId, vault]
  );

  const setPageEnabled = useCallback(
    (id: string, opt: { deselectOthers?: boolean } = {}) => {
      if (!resourceId) {
        return;
      }
      const state = vault.getState();
      const toDeselect = [];

      // Deselect these.
      if (opt?.deselectOthers) {
        const allAnnotationListIds = Object.keys(state.iiif.entities.AnnotationPage);
        for (const annotationPageId of allAnnotationListIds) {
          const annotationListMeta = getMeta(state, annotationPageId);
          if (annotationListMeta && annotationListMeta.views && annotationListMeta.views[resourceId]) {
            toDeselect.push(annotationPageId);
          }
        }
      }

      // Disable first.
      for (const deselectId of toDeselect) {
        setPageDisabled(deselectId);
      }

      // Then enable.
      vault.setMetaValue<AnnotationPageResourceMap>(
        [id, 'annotationPageManager', 'views'],
        (existingResources: AnnotationPageResourceMap | undefined) => {
          if (existingResources && existingResources[resourceId]) {
            return existingResources;
          }
          return {
            ...(existingResources || {}),
            [resourceId]: true,
          };
        }
      );
    },
    [resourceId, setPageDisabled, vault]
  );

  return {
    availablePageIds,
    enabledPageIds,
    setPageEnabled,
    setPageDisabled,
  };
}

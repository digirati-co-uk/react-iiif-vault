import { useVaultSelector } from './useVaultSelector';
import { IIIFStore } from '@iiif/vault';

function getMeta(state: IIIFStore, resourceId: string) {
  const resourceMeta = state?.iiif?.meta[resourceId];
  if (!resourceMeta) {
    return null;
  }
  return resourceMeta.annotationPageManager as any;
}

export function useEnabledAnnotationPageIds(resourceId?: string, availablePageIds?: string[]) {
  return useVaultSelector(
    (state) => {
      const pageIds: string[] = [];
      if (!resourceId) {
        return pageIds;
      }
      const allAnnotationListIds = Object.keys(state.iiif.entities.AnnotationPage);
      for (const annotationListId of allAnnotationListIds) {
        if (!availablePageIds || availablePageIds.indexOf(annotationListId) !== -1) {
          const annotationListMeta = getMeta(state, annotationListId);
          if (annotationListMeta && annotationListMeta.views && annotationListMeta.views[resourceId]) {
            pageIds.push(annotationListId);
          }
        }
      }

      return pageIds;
    },
    [resourceId]
  );
}

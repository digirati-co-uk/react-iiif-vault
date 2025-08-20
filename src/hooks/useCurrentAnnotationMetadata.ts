import { useCallback } from 'react';
import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';

export function useCurrentAnnotationMetadata({ requestId: customRequestId }: { requestId?: string } = {}) {
  const store = useAtlasStore();
  const metadata = useStore(store, (state) => state.metadata);
  const currentRequestId = useStore(store, (state) => state.tool.requestId);
  const requestId = customRequestId || currentRequestId;
  const updateMetadataInternal = useStore(store, (state) => state.setMetadata);

  const updateMetadata = useCallback(
    (data: Record<string, any>) => {
      return updateMetadataInternal(data, requestId || undefined);
    },
    [updateMetadataInternal, requestId],
  );

  return [
    //
    (requestId ? metadata[requestId] || {} : {}) as Record<string, any>,
    updateMetadata,
  ] as const;
}

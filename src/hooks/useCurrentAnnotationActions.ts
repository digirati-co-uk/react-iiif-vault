import { startTransition, useMemo } from 'react';
import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';

export function useCurrentAnnotationActions() {
  const store = useAtlasStore();
  const completeRequest = useStore(store, (state) => state.completeRequest);
  const cancelRequest = useStore(store, (state) => state.cancelRequest);

  return useMemo(
    () => ({
      saveAnnotation: () => {
        startTransition(() => {
          completeRequest();
        });
      },
      cancelRequest,
    }),
    [completeRequest, cancelRequest],
  );
}

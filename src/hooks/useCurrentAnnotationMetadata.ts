import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';

export function useCurrentAnnotationMetadata() {
  const store = useAtlasStore();
  const metadata = useStore(store, (state) => state.metadata);
  const requestId = useStore(store, (state) => state.tool.requestId);
  const updateMetadata = useStore(store, (state) => state.setMetadata);

  return [
    //
    (requestId ? metadata[requestId] || {} : {}) as Record<string, any>,
    updateMetadata,
  ] as const;
}

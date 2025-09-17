import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';

export function useCurrentAnnotationArguments() {
  const store = useAtlasStore();
  return useStore(store, (state) =>
    state.tool.requestId ? state.requests[state.tool.requestId]?.arguments || {} : {},
  );
}

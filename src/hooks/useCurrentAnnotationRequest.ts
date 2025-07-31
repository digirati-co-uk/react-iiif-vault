import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';

export function useCurrentAnnotationRequest() {
  const store = useAtlasStore();
  return useStore(store, (state) => (state.tool.requestId ? state.requests[state.tool.requestId] || null : null));
}

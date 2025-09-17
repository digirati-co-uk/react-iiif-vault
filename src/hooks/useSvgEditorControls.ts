import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';

export function useSvgEditorControls() {
  const store = useAtlasStore();

  const completeRequest = useStore(store, (state) => state.completeRequest);
  const currentTool = useStore(store, (state) => state.polygonState.currentTool);
  const selectedStamp = useStore(store, (state) => state.polygonState.selectedStamp);
  const switchTool = useStore(store, (state) => state.switchTool);

  return {
    completeRequest,
    currentTool,
    selectedStamp,
    switchTool,
  };
}

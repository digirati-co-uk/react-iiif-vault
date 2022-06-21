import { createContext, useContext } from 'react';
import { Preset } from '@atlas-viewer/atlas';

export const ViewerPresetContext = createContext<Preset | null | undefined>(null);

export function useViewerPreset() {
  return useContext(ViewerPresetContext);
}

import { ReactNode, createContext, useContext } from 'react';
import { ComplexTimelineStrategy, EmptyStrategy, MediaStrategy } from '../features/rendering-strategy/strategies';
import { SingleImageStrategy } from '../features/rendering-strategy/image-strategy';

export interface ControlsContext {
  renderMediaControls?: (strategy: MediaStrategy) => ReactNode;
  viewControlsDeps: any[];
  renderViewerControls?: (strategy: SingleImageStrategy | EmptyStrategy) => ReactNode;
  mediaControlsDeps: any[];
  renderComplexTimelineControls?: (strategy: ComplexTimelineStrategy) => ReactNode;
  complexTimelineControlsDeps: any[];
}

export const ControlsReactContext = createContext<ControlsContext | null>(null);
ControlsReactContext.displayName = 'Controls';

export function useRenderControls() {
  const context = useContext(ControlsReactContext);
  if (!context) {
    throw new Error('useStrategy must be used within a StrategyProvider');
  }
  return context;
}

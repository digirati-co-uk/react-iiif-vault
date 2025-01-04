import { createContext, useContext } from 'react';
import { ChoiceDescription } from '@iiif/helpers';
import { RenderingStrategy } from '../features/rendering-strategy/strategies';

export interface StrategyContext {
  strategy: RenderingStrategy;
  choices: ChoiceDescription | null;
}

export const StrategyReactContext = createContext<StrategyContext | null>(null);
StrategyReactContext.displayName = 'Strategy';

export function useStrategy() {
  const context = useContext(StrategyReactContext);
  if (!context) {
    throw new Error('useStrategy must be used within a StrategyProvider');
  }
  return context;
}

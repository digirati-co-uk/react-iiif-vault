import { ReactNode, useEffect, useMemo } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { StrategyActions, useRenderingStrategy } from '../../hooks/useRenderingStrategy';
import {
  ComplexTimelineStrategy,
  EmptyStrategy,
  MediaStrategy,
  RenderingStrategy,
} from '../../features/rendering-strategy/strategies';
import { StrategyContext, StrategyReactContext } from '../../context/StrategyContext';
import { useVault } from '../../hooks/useVault';
import { ChoiceDescription, createStylesHelper } from '@iiif/helpers';
import { SingleImageStrategy } from '../../features/rendering-strategy/image-strategy';
import { ControlsReactContext } from '../../context/ControlsContext';

interface CanvasStrategyProviderProps {
  onChoiceChange?: (choice?: ChoiceDescription) => void;
  strategies?: Array<RenderingStrategy['type']>;
  registerActions?: (actions: StrategyActions) => void;
  defaultChoices?: Array<{ id: string; opacity?: number }>;
  children: ReactNode;
  renderMediaControls?: (strategy: MediaStrategy) => ReactNode;
  viewControlsDeps?: any[];
  renderViewerControls?: (strategy: SingleImageStrategy | EmptyStrategy) => ReactNode;
  renderComplexTimelineControls?: (strategy: ComplexTimelineStrategy) => ReactNode;
  complexTimelineControlsDeps?: any[];
  mediaControlsDeps?: any[];
  throwOnUnknown?: boolean;
}

export function CanvasStrategyProvider({
  strategies,
  registerActions,
  defaultChoices,
  onChoiceChange,
  mediaControlsDeps,
  renderMediaControls,
  renderViewerControls,
  viewControlsDeps,
  renderComplexTimelineControls,
  complexTimelineControlsDeps,
  throwOnUnknown,
  children,
}: CanvasStrategyProviderProps) {
  const canvas = useCanvas();
  const vault = useVault();
  const helper = useMemo(() => createStylesHelper(vault), [vault]);
  const [strategy, actions] = useRenderingStrategy({
    strategies: strategies || ['images'],
    defaultChoices: defaultChoices?.map(({ id }) => id),
  });
  const choice = 'choice' in strategy ? strategy.choice : undefined;

  useEffect(() => {
    if (registerActions) {
      registerActions(actions);
    }
  }, [strategy.annotations]);

  useEffect(() => {
    if (onChoiceChange) {
      onChoiceChange(choice);
    }
  }, [choice]);

  useEffect(() => {
    if (defaultChoices) {
      for (const choice of defaultChoices) {
        if (typeof choice.opacity !== 'undefined') {
          helper.applyStyles({ id: choice.id }, 'atlas', {
            opacity: choice.opacity,
          });
        }
      }
    }
  }, [defaultChoices]);

  if (strategy.type === 'unknown' && throwOnUnknown) {
    throw new Error(strategy.reason || 'Unknown strategy');
  }

  const controls = useMemo(
    () => ({
      renderMediaControls,
      mediaControlsDeps: mediaControlsDeps || [],
      renderViewerControls,
      viewControlsDeps: viewControlsDeps || [],
      renderComplexTimelineControls,
      complexTimelineControlsDeps: complexTimelineControlsDeps || [],
    }),
    [
      mediaControlsDeps,
      renderMediaControls,
      renderViewerControls,
      viewControlsDeps,
      renderComplexTimelineControls,
      complexTimelineControlsDeps,
    ]
  );
  const context = useMemo(
    () =>
      ({
        strategy,
        actions,
        choices: 'choice' in strategy ? strategy.choice : [],
      }) as StrategyContext,
    [strategy, canvas]
  );

  return (
    <ControlsReactContext.Provider value={controls}>
      <StrategyReactContext.Provider value={context}>{children}</StrategyReactContext.Provider>
    </ControlsReactContext.Provider>
  );
}

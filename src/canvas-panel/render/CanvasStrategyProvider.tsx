import { ReactNode, useEffect, useMemo } from 'react';
import { useCanvasContainer } from '../../hooks/useCanvasContainer';
import { StrategyActions, UseRenderingStrategyOptions, useRenderingStrategy } from '../../hooks/useRenderingStrategy';
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

export interface CanvasStrategyProviderProps {
  /** Keep default-choice opacity local instead of writing shared Vault metadata. */
  scopedStyles?: boolean;
  emitter?: UseRenderingStrategyOptions["emitter"];
  annotationPageManagerId?: string;
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
  scopedStyles,
  emitter,
  annotationPageManagerId,
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
  const canvas = useCanvasContainer();
  const vault = useVault();
  const helper = useMemo(() => createStylesHelper(vault), [vault]);
  const [strategy, actions] = useRenderingStrategy({
    strategies: strategies || ['images'],
    emitter,
    annotationPageManagerId,
    defaultChoices: defaultChoices?.map(({ id }) => id),
  });
  const choice = 'choice' in strategy ? strategy.choice : undefined;

  useEffect(() => {
    if (registerActions) {
      const cleanup: unknown = registerActions(actions);
      return typeof cleanup === 'function' ? () => { cleanup(); } : undefined;
    }
  }, [registerActions, actions]);

  useEffect(() => {
    if (onChoiceChange) {
      onChoiceChange(choice);
    }
  }, [choice, onChoiceChange]);

  useEffect(() => {
    if (defaultChoices && !scopedStyles) {
      for (const choice of defaultChoices) {
        if (typeof choice.opacity !== 'undefined') {
          helper.applyStyles({ id: choice.id }, 'atlas', {
            opacity: choice.opacity,
          });
        }
      }
    }
  }, [defaultChoices, helper, scopedStyles]);

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
        imageStyles: scopedStyles ? Object.fromEntries((defaultChoices || []).filter(choice => choice.opacity !== undefined).map(choice => [choice.id, { opacity: choice.opacity }])) : undefined,
        choices: 'choice' in strategy ? strategy.choice : [],
      }) as StrategyContext,
    [strategy, canvas, actions, defaultChoices, scopedStyles]
  );

  return (
    <ControlsReactContext.Provider value={controls}>
      <StrategyReactContext.Provider value={context}>{children}</StrategyReactContext.Provider>
    </ControlsReactContext.Provider>
  );
}

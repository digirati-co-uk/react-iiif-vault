import { useId, useMemo } from 'react';
import mitt from 'mitt';
import { useCanvasContainer } from '../../hooks/useCanvasContainer';
import { EventsProvider } from '../../context/EventContext';
import type { ChoiceEvents } from '../../hooks/useRenderingStrategy';
import {
  CanvasStrategyProvider as SharedProvider,
  type CanvasStrategyProviderProps,
} from '../render/CanvasStrategyProvider';
export type { CanvasStrategyProviderProps } from '../render/CanvasStrategyProvider';

/** One scope per mounted canvas, even when several panels share a Vault/resource. */
export function CanvasStrategyProvider(props: CanvasStrategyProviderProps) {
  const id = useId();
  const canvas = useCanvasContainer();
  const localEmitter = useMemo(() => mitt<ChoiceEvents>(), []);
  const emitter = props.emitter || localEmitter;
  return (
    <EventsProvider emitter={emitter}>
      <SharedProvider
        key={canvas?.id}
        {...props}
        scopedStyles={props.scopedStyles ?? true}
        emitter={emitter}
        annotationPageManagerId={props.annotationPageManagerId || `scene-${id}`}
      />
    </EventsProvider>
  );
}

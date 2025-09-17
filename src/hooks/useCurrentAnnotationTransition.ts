import type { PolygonEvents } from 'polygon-editor';
import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';
import { useEvent } from './useEvent';

export function useCurrentAnnotationTransition(options: {
  requestId?: string | null;
  onStart?: (type: string) => void;
  onEnd?: (type: string, response: PolygonEvents['polygons.end-transition']['response']) => void;
  onTransition?: (type: string) => void;
}) {
  const store = useAtlasStore();
  const toolRequestId = useStore(store, (s) => s.tool.requestId);

  useEvent<PolygonEvents, 'polygons.start-transition'>(
    'polygons.start-transition',
    (ev) => {
      if (options.requestId && toolRequestId !== options.requestId) return;
      options?.onStart?.(ev.transitionIntent);
    },
    [toolRequestId, options.requestId],
  );

  useEvent<PolygonEvents, 'polygons.end-transition'>(
    'polygons.end-transition',
    (ev) => {
      if (options.requestId && toolRequestId !== options.requestId) return;
      options?.onEnd?.(ev.transitionIntent, ev.response);
    },
    [toolRequestId, options.requestId],
  );

  useEvent<PolygonEvents, 'polygons.transition'>(
    'polygons.transition',
    (ev) => {
      if (options.requestId && toolRequestId !== options.requestId) return;
      options?.onTransition?.(ev.transitionIntent);
    },
    [toolRequestId, options.requestId],
  );
}

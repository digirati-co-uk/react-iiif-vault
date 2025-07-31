import type { PolygonEvents } from 'polygon-editor';
import { useEvent } from './useEvent';

export function useCurrentAnnotationTransition(options: {
  onStart?: (type: string) => void;
  onEnd?: (type: string, response: PolygonEvents['polygons.end-transition']['response']) => void;
  onTransition?: (type: string) => void;
}) {
  useEvent<PolygonEvents, 'polygons.start-transition'>('polygons.start-transition', (ev) => {
    options?.onStart?.(ev.transitionIntent);
  });

  useEvent<PolygonEvents, 'polygons.end-transition'>('polygons.end-transition', (ev) => {
    options?.onEnd?.(ev.transitionIntent, ev.response);
  });

  useEvent<PolygonEvents, 'polygons.transition'>('polygons.transition', (ev) => {
    options?.onTransition?.(ev.transitionIntent);
  });
}

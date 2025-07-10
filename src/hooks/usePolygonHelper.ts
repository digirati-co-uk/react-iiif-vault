import { useStore } from 'zustand';
import type { AtlasStoreEvents } from '../canvas-panel/context/atlas-store';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';
import { useEvent } from './useEvent';

export function usePolygonHelper(render: (t: any, s: any, dt: number) => void) {
  const store = useAtlasStore();
  const helper = useStore(store, (s) => s.polygons);
  const state = useStore(store, (s) => s.polygonState);
  const currentShape = useStore(store, (s) => s.polygon);

  useEvent<AtlasStoreEvents, 'atlas.polygon-render'>('atlas.polygon-render', ({ state, slowState, dt }) => {
    render(state, slowState, dt);
  });

  return { currentShape, state, helper };
}

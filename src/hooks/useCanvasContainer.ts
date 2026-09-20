import type { CompatibleCanvas } from '../utility/canvas-compat';
import { useResourceContext } from '../context/ResourceContext';
import { useVaultSelector } from './useVaultSelector';

/** The CanvasPanel rendering surface: a Canvas in v3, or a Canvas/Timeline in v4. */
export function useCanvasContainer(): CompatibleCanvas | undefined {
  const { canvas: id } = useResourceContext();
  return useVaultSelector(
    (state) => {
      if (!id) return undefined;
      return state.iiif.mapping[id] === 'Timeline' ? state.iiif.entities.Timeline[id] : state.iiif.entities.Canvas[id];
    },
    [id]
  );
}

import type { Paintables } from '@iiif/helpers/painting-annotations';
type CompatibleAnnotation = Paintables['items'][number]['annotation'];
import { isVault4 } from '@iiif/helpers/vault-4';
import { useResourceContext } from '../context/ResourceContext';
import { useCanvasContainer } from './useCanvasContainer';
import { useActiveVault } from './useVault';
import { useSelectorForVault } from './useVaultSelector';
import { useAnnotation } from './useAnnotation';

/** Internal rendering data preserves each Vault's normalized annotation model. */
export function useCompatiblePaintingAnnotations(
  options: { canvasId?: string; enableSingleAnnotation?: boolean } = {}
) {
  const vault = useActiveVault();
  const context = useResourceContext();
  const container = useCanvasContainer();
  const legacyAnnotation = useAnnotation();
  return useSelectorForVault(
    vault,
    (state, current) => {
      const id = options.canvasId || container?.id;
      const canvas = id
        ? state.iiif.mapping[id] === 'Timeline'
          ? state.iiif.entities.Timeline[id]
          : state.iiif.entities.Canvas[id]
        : undefined;
      if (!canvas) return [];
      if (options.enableSingleAnnotation && context.annotation) {
        if (isVault4(current)) return [current.get({ id: context.annotation, type: 'Annotation' })];
        return legacyAnnotation ? [legacyAnnotation] : [];
      }
      const pageIds = canvas.items;
      return pageIds.flatMap<CompatibleAnnotation>((page) => {
        if (isVault4(current))
          return current
            .get({ id: page.id, type: 'AnnotationPage' })
            .items.map((item) => current.get({ id: item.id, type: 'Annotation' }));
        return current
          .get({ id: page.id, type: 'AnnotationPage' })
          .items.map((item) => current.get({ id: item.id, type: 'Annotation' }));
      });
    },
    [container, options.canvasId, options.enableSingleAnnotation, context.annotation, legacyAnnotation]
  );
}

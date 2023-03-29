import { CanvasNormalized, ManifestNormalized, RangeNormalized } from '@iiif/presentation-3-normalized';
import { Reference } from '@iiif/presentation-3';
import { Vault } from '@iiif/vault';
import { findAllCanvasesInRange } from './ranges';

/**
 * Get visible canvases from canvas ID
 *
 * This function returns a list of canvas references that should all be displayed
 * when the passed canvasId is visible. This should work for individual items,
 * 2-up paged view and continuous (scrolls).
 *
 * The options are listed below (from IIIF docs)
 *
 * - `unordered` - Valid on Collections, Manifests and Ranges. The Canvases included in resources that have this behavior
 *    have no inherent order, and user interfaces should avoid implying an order to the user. Disjoint with individuals,
 *    continuous, and paged.
 *
 * - `individuals` - Valid on Collections, Manifests, and Ranges. For Collections that have this behavior, each of the
 *    included Manifests are distinct objects in the given order. For Manifests and Ranges, the included Canvases are
 *    distinct views, and should not be presented in a page-turning interface. This is the default layout behavior if
 *    not specified. Disjoint with unordered, continuous, and paged.
 *
 * - `continuous`  Valid on Collections, Manifests and Ranges, which include Canvases that have at least height and
 *    width dimensions. Canvases included in resources that have this behavior are partial views and an appropriate
 *    rendering might display all of the Canvases virtually stitched together, such as a long scroll split into
 *    sections. This behavior has no implication for audio resources. The viewingDirection of the Manifest will
 *    determine the appropriate arrangement of the Canvases. Disjoint with unordered, individuals and paged.
 *
 * - `paged`  Valid on Collections, Manifests and Ranges, which include Canvases that have at least height and width
 *    dimensions. Canvases included in resources that have this behavior represent views that should be presented in
 *    a page-turning interface if one is available. The first canvas is a single view (the first recto) and thus the
 *    second canvas likely represents the back of the object in the first canvas. If this is not the case, see the
 *    behavior value non-paged. Disjoint with unordered, individuals, continuous, facing-pages and non-paged.
 *
 */
export function getVisibleCanvasesFromCanvasId(
  vault: Vault,
  manifestOrRange: ManifestNormalized | RangeNormalized,
  canvasId: string | null,
  preventPaged = false
): Reference<'Canvas'>[] {
  const behavior = manifestOrRange.behavior;
  const fullCanvas = canvasId ? vault.get<CanvasNormalized>(canvasId) : null;
  if (!fullCanvas) {
    return [];
  }

  const canvasBehavior = fullCanvas.behavior;
  const isPaged = preventPaged ? false : behavior.includes('paged');
  const isContinuous = isPaged ? false : behavior.includes('continuous');
  const isIndividuals = isPaged || isContinuous ? false : behavior.includes('individuals');
  const isCanvasFacingPages = canvasBehavior.includes('facing-pages');
  const isCanvasNonPaged = canvasBehavior.includes('non-paged');

  // Individuals should just be the default.
  if (isCanvasFacingPages || isCanvasNonPaged || isIndividuals || preventPaged) {
    return [{ id: fullCanvas.id, type: 'Canvas' }];
  }

  const [manifestItems, ordering] = getManifestSequence(vault, manifestOrRange);

  // Continuous should just return all items together.
  if (isContinuous) {
    return manifestItems;
  }

  const canvasIndex = manifestItems.findIndex((r) => r.id === canvasId);
  if (canvasIndex === -1) {
    return [];
  }

  for (const indexes of ordering) {
    if (indexes.includes(canvasIndex)) {
      return indexes.map((index) => manifestItems[index]);
    }
  }

  return [{ id: fullCanvas.id, type: 'Canvas' }];
}

export function getManifestSequence(
  vault: Vault,
  manifestOrRange: ManifestNormalized | RangeNormalized,
  { disablePaging, skipNonPaged }: { disablePaging?: boolean; skipNonPaged?: boolean } = {}
): [Reference<'Canvas'>[], number[][]] {
  const behavior = manifestOrRange.behavior;
  const isPaged = behavior.includes('paged');
  const isContinuous = isPaged ? false : behavior.includes('continuous');
  const isIndividuals = isPaged || isContinuous ? false : behavior.includes('individuals');
  const manifestItems =
    manifestOrRange.type === 'Manifest' ? manifestOrRange.items : findAllCanvasesInRange(vault, manifestOrRange);

  // Continuous should just return all items together.
  if (isContinuous) {
    return [manifestItems, [manifestItems.map((_, index) => index)]];
  }

  // Individuals should just be the default.
  if (isIndividuals || !isPaged || disablePaging) {
    return [manifestItems, manifestItems.map((_, index) => [index])];
  }

  // This is the tricky case.
  const ordering: number[][] = [];
  let currentOrdering: number[] = [];

  const flush = () => {
    if (currentOrdering.length) {
      ordering.push([...currentOrdering]);
      currentOrdering = [];
    }
  };

  let offset = 0;
  let flushNextPaged = false;
  for (let i = 0; i < manifestItems.length; i++) {
    const canvas = vault.get<CanvasNormalized>(manifestItems[i]);
    if (canvas.behavior.includes('non-paged')) {
      if (i === offset) {
        offset++;
      }
      if (!skipNonPaged) {
        flush();
        ordering.push([i]);
        flush();
      }
      continue;
    }

    if (i === offset || canvas.behavior.includes('facing-pages')) {
      // Flush and push a single.
      if (currentOrdering.length) {
        flushNextPaged = true;
      }
      flush();
      ordering.push([i]);
      flush();
      continue;
    }

    currentOrdering.push(i);

    if (flushNextPaged) {
      flush();
      flushNextPaged = false;
      continue;
    }

    if (currentOrdering.length > 1) {
      flush();
    }
  }

  if (currentOrdering.length) {
    flush();
  }

  return [manifestItems, ordering];
}

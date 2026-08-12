import { getManifestSequence } from '@iiif/helpers/sequences';
import type { Vault } from '@iiif/helpers/vault';
import type { Vault4 } from '@iiif/helpers/vault-4';
import type { ViewableContainerReference } from './canvas-compat';

type SequencedResource = Parameters<typeof getManifestSequence>[1];

function isViewableContainer(value: unknown): value is ViewableContainerReference {
  if (!value || typeof value !== 'object') return false;
  const resource = value as { id?: unknown; type?: unknown };
  return typeof resource.id === 'string' && (resource.type === 'Canvas' || resource.type === 'Timeline');
}

/** Preserve Canvas paging while keeping Presentation 4 Timelines as independent views. */
export function getContainerSequence(
  vault: Vault | Vault4,
  resource: SequencedResource,
  options: { disablePaging?: boolean } = {}
): [ViewableContainerReference[], number[][]] {
  if (
    resource.type !== 'Manifest' ||
    !resource.items.some((item) => isViewableContainer(item) && item.type === 'Timeline')
  ) {
    const [canvases, sequence] = getManifestSequence(vault, resource, options);
    return [canvases.map(({ id }) => ({ id, type: 'Canvas' })), sequence];
  }

  const items = resource.items.flatMap((item) => (isViewableContainer(item) ? [{ id: item.id, type: item.type }] : []));
  const [canvases, canvasSequence] = getManifestSequence(vault, resource, options);
  const canvasGroups = canvasSequence.map((group) => group.map((index) => canvases[index]?.id).filter(Boolean));
  const emitted = new Set<string>();
  const sequence: number[][] = [];

  for (const [index, item] of items.entries()) {
    if (item.type === 'Timeline') {
      sequence.push([index]);
      continue;
    }
    if (emitted.has(item.id)) continue;
    const group = canvasGroups.find((ids) => ids.includes(item.id)) || [item.id];
    group.forEach((id) => emitted.add(id));
    sequence.push(
      group.flatMap((id) => {
        const groupIndex = items.findIndex((candidate) => candidate.id === id);
        return groupIndex < 0 ? [] : [groupIndex];
      })
    );
  }

  return [items, sequence];
}

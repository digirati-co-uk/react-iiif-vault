import { getManifestSequence } from '@iiif/helpers/sequences';
import type { Vault } from '@iiif/helpers/vault';
import type { Vault4 } from '@iiif/helpers/vault-4';
import type { ContainerReference } from './canvas-compat';

type SequencedResource = Parameters<typeof getManifestSequence>[1];

function isViewableContainer(value: unknown): value is ContainerReference {
  if (!value || typeof value !== 'object') return false;
  const resource = value as { id?: unknown; type?: unknown };
  return (
    typeof resource.id === 'string' &&
    (resource.type === 'Canvas' || resource.type === 'Timeline' || resource.type === 'Scene')
  );
}

/** Preserve Canvas paging while keeping Presentation 4 Scenes and Timelines as independent views. */
export function getContainerSequence(
  vault: Vault | Vault4,
  resource: SequencedResource,
  options: { disablePaging?: boolean; containerTypes?: readonly ContainerReference['type'][] } = {}
): [ContainerReference[], number[][]] {
  const selectedResource =
    resource.type === 'Manifest' && options.containerTypes
      ? ({
          ...resource,
          items: resource.items.filter(
            (item) => !isViewableContainer(item) || options.containerTypes!.includes(item.type)
          ),
        } as SequencedResource)
      : resource;
  if (
    selectedResource.type !== 'Manifest' ||
    !selectedResource.items.some((item) => isViewableContainer(item) && item.type !== 'Canvas')
  ) {
    const [canvases, sequence] = getManifestSequence(vault, selectedResource, options);
    return [canvases.map(({ id }) => ({ id, type: 'Canvas' })), sequence];
  }

  const items = selectedResource.items.flatMap((item) =>
    isViewableContainer(item) ? [{ id: item.id, type: item.type }] : []
  );
  const sequence: number[][] = [];
  let canvasRun: Array<{ item: ContainerReference; index: number }> = [];

  const flushCanvases = () => {
    if (!canvasRun.length) return;
    const runResource = { ...selectedResource, items: canvasRun.map(({ item }) => item) } as SequencedResource;
    const [, groups] = getManifestSequence(vault, runResource, options);
    sequence.push(...groups.map((group) => group.map((index) => canvasRun[index].index)));
    canvasRun = [];
  };

  for (const [index, item] of items.entries()) {
    if (item.type !== 'Canvas') {
      flushCanvases();
      sequence.push([index]);
      continue;
    }
    canvasRun.push({ item, index });
  }
  flushCanvases();

  return [items, sequence];
}

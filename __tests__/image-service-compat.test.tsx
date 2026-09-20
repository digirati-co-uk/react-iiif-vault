import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { Vault } from '@iiif/helpers/vault';
import { Vault4 } from '@iiif/helpers/vault-4';
import { VaultProvider } from '../src/context/VaultContext';
import { useImageService } from '../src/hooks/useImageService';
import type { ImageService } from '@iiif/parser/presentation-3/types';

const { load, loadSync } = vi.hoisted(() => ({ load: vi.fn(), loadSync: () => undefined }));
vi.mock('../src/context/ImageServicesContext', () => ({
  useLoadImageServiceFn: () => load,
  useLoadImageServiceFnSync: () => loadSync,
}));

function canvas(service: string) {
  return {
    id: 'https://example.org/canvas',
    type: 'Canvas',
    width: 100,
    height: 80,
    items: [
      {
        id: 'https://example.org/page',
        type: 'AnnotationPage',
        items: [
          {
            id: 'https://example.org/annotation',
            type: 'Annotation',
            motivation: 'painting',
            target: 'https://example.org/canvas',
            body: {
              id: 'https://example.org/image',
              type: 'Image',
              service: [{ id: service, type: 'ImageService3', profile: 'level1' }],
            },
          },
        ],
      },
    ],
  };
}

test('image-service loads follow replacement vaults and ignore stale promises', async () => {
  const first = new Vault();
  const second = new Vault4();
  first.loadSync('https://example.org/canvas', canvas('https://example.org/first'));
  second.loadSync('https://example.org/canvas', canvas('https://example.org/second'));
  let resolveFirst: (service: ImageService) => void = () => {};
  const secondService: ImageService = {
    id: 'https://example.org/second',
    type: 'ImageService3',
    profile: 'level1',
    width: 100,
    height: 80,
  };
  load
    .mockImplementationOnce(
      () =>
        new Promise<ImageService>((resolve) => {
          resolveFirst = resolve;
        })
    )
    .mockResolvedValue(secondService);
  let active: Vault | Vault4 = first;
  const view = renderHook(() => useImageService(), {
    wrapper: ({ children }) => (
      <VaultProvider vault={active} resources={{ canvas: 'https://example.org/canvas' }}>
        {children}
      </VaultProvider>
    ),
  });
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  active = second;
  view.rerender();
  await waitFor(() => expect(view.result.current.data?.id).toBe(secondService.id));
  await act(async () => resolveFirst({ ...secondService, id: 'https://example.org/first' }));
  expect(view.result.current.data?.id).toBe(secondService.id);
});

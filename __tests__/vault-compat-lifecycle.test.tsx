import { useRemoteStylesheet, useStylesheetStore } from '../src/hooks/useRemoteStylesheet';
import { entityActions } from '@iiif/helpers/vault/actions';
import React, { useContext } from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { Vault, VaultProvider, ReactVaultContext, createVaultHooks, useManifest, useExternalCollection } from '../src';
import {
  Vault4,
  useManifest as useManifest4,
  useAnnotation as useAnnotation4,
  usePaintingAnnotations as usePainting4,
  useCanvasSubset as useSubset4,
  useVirtualAnnotationPage as useVirtual4,
  useVaultSelector as useSelector4,
} from '../src/presentation-4';
import { useVaultSelector } from '../src/hooks/useVaultSelector';
import { useVaultEffect } from '../src/hooks/useVaultEffect';
import { useExternalResource } from '../src/hooks/useExternalResource';
import type { ManifestNormalized as Manifest3 } from '@iiif/parser/presentation-3-normalized/types';
import type {
  ManifestNormalized as Manifest4,
  AnnotationNormalized as Annotation4,
} from '@iiif/parser/presentation-4-normalized/types';

function fixture(label: string, version = 3) {
  return {
    '@context': `http://iiif.io/api/presentation/${version}/context.json`,
    id: 'https://example.org/manifest',
    type: 'Manifest',
    label: { en: [label] },
    items: [],
  };
}

function checkTypes() {
  expectTypeOf(useManifest()).toEqualTypeOf<Manifest3 | undefined>();
  expectTypeOf(useManifest4()).toEqualTypeOf<Manifest4 | undefined>();
  expectTypeOf(useAnnotation4()).toEqualTypeOf<Annotation4 | undefined>();
  expectTypeOf(usePainting4()).toEqualTypeOf<Annotation4[]>();
  expectTypeOf<Manifest3>().not.toEqualTypeOf<Manifest4>();
  const collection = useExternalCollection('collection');
  expectTypeOf(collection.manifest).toEqualTypeOf(collection.collection);
}
void checkTypes;

describe('compatibility lifecycle regressions', () => {
  test('recomputes on replacement and selector dependencies, removes old subscriptions and effect cleanup', () => {
    const first = new Vault();
    const second = new Vault();
    first.loadSync('https://example.org/manifest', fixture('first'));
    second.loadSync('https://example.org/manifest', fixture('second'));
    const subscribe1 = vi.spyOn(first, 'subscribe');
    const subscribe2 = vi.spyOn(second, 'subscribe');
    const cleaned = vi.fn();
    const effects = vi.fn();
    function Probe({ suffix }: { suffix: string }) {
      const label = useVaultSelector(
        (_state, vault) => vault.get({ id: 'https://example.org/manifest', type: 'Manifest' }).label?.en?.[0] + suffix,
        [suffix]
      );
      useVaultEffect((vault) => {
        effects(vault);
        return () => cleaned(vault);
      });
      return <span>{label}</span>;
    }
    const view = render(
      <VaultProvider vault={first}>
        <Probe suffix="!" />
      </VaultProvider>
    );
    expect(view.container.textContent).toBe('first!');
    view.rerender(
      <VaultProvider vault={second}>
        <Probe suffix="?" />
      </VaultProvider>
    );
    expect(view.container.textContent).toBe('second?');
    expect(cleaned).toHaveBeenCalledWith(first);
    expect(effects).toHaveBeenLastCalledWith(second);
    expect(subscribe1).toHaveBeenCalledTimes(1);
    act(() =>
      first.dispatch(
        entityActions.modifyEntityField({
          id: 'https://example.org/manifest',
          type: 'Manifest',
          key: 'label',
          value: { en: ['old update'] },
        })
      )
    );
    expect(view.container.textContent).toBe('second?');
    act(() =>
      second.dispatch(
        entityActions.modifyEntityField({
          id: 'https://example.org/manifest',
          type: 'Manifest',
          key: 'label',
          value: { en: ['new update'] },
        })
      )
    );
    expect(view.container.textContent).toBe('new update?');
    view.unmount();
    expect(cleaned).toHaveBeenCalledWith(second);
    expect(subscribe2).toHaveBeenCalledTimes(1);
  });

  test('unsubscribes when replaced and unmounted', () => {
    const first = new Vault();
    const second = new Vault4();
    const stop1 = vi.fn();
    const stop2 = vi.fn();
    vi.spyOn(first, 'subscribe').mockReturnValue(stop1);
    vi.spyOn(second, 'subscribe').mockReturnValue(stop2);
    function Probe() {
      return <span>{useVaultSelector((_state, vault) => vault.presentationVersion)}</span>;
    }
    const view = render(
      <VaultProvider vault={first}>
        <Probe />
      </VaultProvider>
    );
    view.rerender(
      <VaultProvider vault={second}>
        <Probe />
      </VaultProvider>
    );
    expect(view.container.textContent).toBe('4');
    expect(stop1).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(stop2).toHaveBeenCalledTimes(1);
  });

  test('separate providers with the same resource ID stay independent, including mixed entry imports', () => {
    const first = new Vault();
    const second = new Vault4();
    first.loadSync('https://example.org/manifest', fixture('three'));
    second.loadSync('https://example.org/manifest', fixture('four', 4));
    function Three() {
      return <span>{useManifest()?.label?.en?.[0]}</span>;
    }
    function Four() {
      return <span>{useManifest4()?.label?.en?.[0]}</span>;
    }
    const resources = { manifest: 'https://example.org/manifest' };
    const view = render(
      <>
        <VaultProvider vault={first} resources={resources}>
          <Three />
        </VaultProvider>
        <VaultProvider vault={second} resources={resources}>
          <Four />
        </VaultProvider>
      </>
    );
    expect(view.container.textContent).toBe('threefour');
    act(() =>
      first.dispatch(
        entityActions.modifyEntityField({
          id: resources.manifest,
          type: 'Manifest',
          key: 'label',
          value: { en: ['changed'] },
        })
      )
    );
    expect(view.container.textContent).toBe('changedfour');
  });

  test('an explicit vault wins over the setter and version changes clear a generated override', () => {
    const explicit = new Vault();
    let context: React.ContextType<typeof ReactVaultContext>;
    function Probe() {
      context = useContext(ReactVaultContext);
      return <span>{context.vault?.presentationVersion}</span>;
    }
    const view = render(
      <VaultProvider vault={explicit} version={4}>
        <Probe />
      </VaultProvider>
    );
    act(() => context.setVaultInstance(new Vault4()));
    expect(view.container.textContent).toBe('3');
    view.rerender(
      <VaultProvider>
        <Probe />
      </VaultProvider>
    );
    act(() => context.setVaultInstance(new Vault4()));
    expect(view.container.textContent).toBe('4');
    view.rerender(
      <VaultProvider version={4}>
        <Probe />
      </VaultProvider>
    );
    view.rerender(
      <VaultProvider version={3}>
        <Probe />
      </VaultProvider>
    );
    expect(view.container.textContent).toBe('3');
  });

  test('ignores late resource loads from a replaced vault and clears old data immediately', async () => {
    const first = new Vault({
      customFetcher: () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    });
    let resolveOld: (value: unknown) => void = () => {
      throw new Error('load did not start');
    };
    const second = new Vault4();
    const data = fixture('current', 4);
    second.loadSync(data.id, data);
    function Probe() {
      const resource = useExternalResource<Manifest3 | Manifest4>(data.id);
      return <span>{resource.resource?.label?.en?.[0] || 'loading'}</span>;
    }
    const view = render(
      <VaultProvider vault={first}>
        <Probe />
      </VaultProvider>
    );
    await waitFor(() => expect(first.requestStatus(data.id)?.loadingState).toBe('RESOURCE_LOADING'));
    view.rerender(
      <VaultProvider vault={second}>
        <Probe />
      </VaultProvider>
    );
    expect(view.container.textContent).toBe('current');
    await act(async () => {
      resolveOld(fixture('stale'));
    });
    expect(view.container.textContent).toBe('current');
  });

  test('all version-bound hook forms reject the opposite provider', () => {
    const hooks = createVaultHooks(3);
    for (const hook of [
      () => hooks.useVault(),
      () => hooks.useVaultSelector(() => 0),
      () => hooks.useVaultEffect(() => {}),
      () => hooks.useExistingVault(),
    ]) {
      expect(() =>
        renderHook(hook, { wrapper: ({ children }) => <VaultProvider version={4}>{children}</VaultProvider> })
      ).toThrow('Expected a Presentation 3 Vault');
    }
    expect(() =>
      renderHook(() => useSelector4(() => 0), { wrapper: ({ children }) => <VaultProvider>{children}</VaultProvider> })
    ).toThrow('Expected a Vault4');
  });

  test('v4 virtual pages are normalized using the active vault', () => {
    const vault = new Vault4();
    const { result } = renderHook(() => useVirtual4(), {
      wrapper: ({ children }) => <VaultProvider vault={vault}>{children}</VaultProvider>,
    });
    expect(result.current[0]?.type).toBe('AnnotationPage');
    expect(result.current[0]).toEqual(vault.get({ id: result.current[0]!.id, type: 'AnnotationPage' }));
  });
});

test('late stylesheets cannot follow a replacement resource', async () => {
  let resolveOld: (value: { id: string; type: 'CssStylesheet'; value: string }) => void = () => {};
  const parse = vi.spyOn(useStylesheetStore.getState(), 'parseStylesheet')
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValue({ id: 'new', type: 'CssStylesheet', value: 'new' });
  try {
    const view = renderHook(({ sheet }) => useRemoteStylesheet(sheet), { initialProps: { sheet: 'old' } });
    view.rerender({ sheet: 'new' });
    await waitFor(() => expect(view.result.current[1].id).toBe('new'));
    await act(async () => resolveOld({ id: 'old', type: 'CssStylesheet', value: 'old' }));
    expect(view.result.current[1].id).toBe('new');
  } finally {
    parse.mockRestore();
  }
});

test('root external collections retain the legacy manifest alias', () => {
  const vault = new Vault();
  vault.loadCollectionSync('https://example.org/collection', { id: 'https://example.org/collection', type: 'Collection', items: [] });
  const { result } = renderHook(() => useExternalCollection('https://example.org/collection'), {
    wrapper: ({ children }) => <VaultProvider vault={vault}>{children}</VaultProvider>,
  });
  expect(result.current.manifest?.type).toBe('Collection');
  expect(result.current.collection).toBe(result.current.manifest);
});

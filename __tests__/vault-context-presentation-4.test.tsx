/**
 * @vitest-environment happy-dom
 */

import React, { useContext } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { Vault } from '@iiif/helpers/vault';
import { Vault4 } from '@iiif/helpers/vault-4';
import type { ManifestNormalized as Manifest4Normalized } from '@iiif/parser/presentation-4-normalized/types';
import { ReactVaultContext, VaultProvider } from '../src/context/VaultContext';
import { createVaultHooks } from '../src/hooks/createVaultHooks';
import { useExistingVault } from '../src/hooks/useExistingVault';
import { useVaultSelector } from '../src/hooks/useVaultSelector';
import {
  Vault as Presentation4Vault,
  VaultProvider as Presentation4VaultProvider,
  useManifest as usePresentation4Manifest,
  useVault as usePresentation4Vault,
} from '../src/presentation-4';

const vault3Hooks = createVaultHooks();
const vault4Hooks = createVaultHooks(4);

expectTypeOf(vault3Hooks.useVault).returns.toEqualTypeOf<Vault>();
expectTypeOf(vault4Hooks.useVault).returns.toEqualTypeOf<Vault4>();
expectTypeOf(Presentation4Vault).toEqualTypeOf<typeof Vault4>();
expectTypeOf(usePresentation4Vault).returns.toEqualTypeOf<Vault4>();

function VaultProbe() {
  const context = useContext(ReactVaultContext);
  const vault = useExistingVault(context.vault!);
  expectTypeOf(vault).toEqualTypeOf<Vault | Vault4>();
  return (
    <button type="button" onClick={() => context.setVaultInstance(new Vault4())}>
      {vault instanceof Vault4 ? 'p4' : 'p3'}
    </button>
  );
}

function VaultSelectorProbe() {
  const version = useVaultSelector((_state, vault) => vault.presentationVersion);
  return <span data-testid="selected-version">p{version}</span>;
}

function Vault4TypeProbe() {
  const vault = vault4Hooks.useVault();
  const version = vault4Hooks.useVaultSelector((_state, current) => current.presentationVersion);
  expectTypeOf(vault).toEqualTypeOf<Vault4>();
  return <span>typed-p{version}</span>;
}

describe('VaultProvider Presentation 3/4 lifecycle', () => {
  test('keeps Presentation 3 as the default and replaces generated vaults when version changes', () => {
    const view = render(
      <VaultProvider>
        <VaultProbe />
        <VaultSelectorProbe />
      </VaultProvider>
    );
    expect(screen.getByRole('button').textContent).toBe('p3');
    expect(screen.getByTestId('selected-version').textContent).toBe('p3');

    view.rerender(
      <VaultProvider version={4}>
        <VaultProbe />
        <VaultSelectorProbe />
      </VaultProvider>
    );
    expect(screen.getByRole('button').textContent).toBe('p4');
    expect(screen.getByTestId('selected-version').textContent).toBe('p4');

    view.rerender(
      <VaultProvider version={3}>
        <VaultProbe />
        <VaultSelectorProbe />
      </VaultProvider>
    );
    expect(screen.getByRole('button').textContent).toBe('p3');
    expect(screen.getByTestId('selected-version').textContent).toBe('p3');
  });

  test('uses a replacement explicit vault immediately', () => {
    const first = new Vault();
    const second = new Vault();
    let observed: Vault | Vault4 | null = null;

    function IdentityProbe() {
      observed = useContext(ReactVaultContext).vault;
      return null;
    }

    const view = render(
      <VaultProvider vault={first}>
        <IdentityProbe />
      </VaultProvider>
    );
    expect(observed).toBe(first);

    view.rerender(
      <VaultProvider vault={second}>
        <IdentityProbe />
      </VaultProvider>
    );
    expect(observed).toBe(second);
  });

  test('retains the context setter for uncontrolled providers', () => {
    render(
      <VaultProvider>
        <VaultProbe />
      </VaultProvider>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('p4');
  });

  test('prefers an explicit hook argument over a Presentation 4 context', () => {
    const explicit = new Vault();

    function ExistingVaultProbe() {
      const legacyDefault = useExistingVault();
      expectTypeOf(legacyDefault).toEqualTypeOf<Vault>();
      return <span>{useExistingVault(explicit) === explicit ? 'explicit' : 'context'}</span>;
    }

    render(
      <VaultProvider version={4}>
        <ExistingVaultProbe />
        <Vault4TypeProbe />
      </VaultProvider>
    );
    expect(screen.getByText('explicit')).toBeTruthy();
    expect(screen.getByText('typed-p4')).toBeTruthy();
  });

  test('binds the Presentation 4 entry point to Vault4', () => {
    const manifestId = 'https://example.org/manifest';
    const vault = new Presentation4Vault();
    vault.loadSync(manifestId, {
      '@context': 'http://iiif.io/api/presentation/4/context.json',
      id: manifestId,
      type: 'Manifest',
      label: { en: ['Presentation 4'] },
      items: [],
    });

    function Presentation4Probe() {
      const manifest = usePresentation4Manifest({ id: manifestId });
      const selectedId = usePresentation4Manifest({
        id: manifestId,
        selector: (manifest) => manifest.id,
      });
      expectTypeOf(manifest).toEqualTypeOf<Manifest4Normalized | undefined>();
      expectTypeOf(selectedId).toEqualTypeOf<string | undefined>();
      return <span>{usePresentation4Vault() instanceof Presentation4Vault ? selectedId : 'p3'}</span>;
    }

    render(
      <Presentation4VaultProvider vault={vault}>
        <Presentation4Probe />
      </Presentation4VaultProvider>
    );
    expect(screen.getByText(manifestId)).toBeTruthy();
  });

  test('rejects a hook set used with the wrong Vault version', () => {
    function MismatchedProbe() {
      vault4Hooks.useVault();
      return null;
    }

    expect(() =>
      render(
        <VaultProvider>
          <MismatchedProbe />
        </VaultProvider>
      )
    ).toThrow('Expected a Vault4, but found a Presentation 3 Vault.');
  });
});

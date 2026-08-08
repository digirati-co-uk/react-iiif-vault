/**
 * @vitest-environment happy-dom
 */

import React, { useContext } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { Vault } from '@iiif/helpers/vault';
import { Vault4 } from '@iiif/helpers/vault-4';
import { ReactVaultContext, VaultProvider } from '../src/context/VaultContext';
import { useExistingVault } from '../src/hooks/useExistingVault';
import { useVaultSelector } from '../src/hooks/useVaultSelector';

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
      </VaultProvider>
    );
    expect(screen.getByText('explicit')).toBeTruthy();
  });
});

/** @vitest-environment happy-dom */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Vault } from '@iiif/helpers/vault';
import { Vault4 } from '@iiif/helpers/vault-4';
import { VaultProvider } from '../src/context/VaultContext';
import { createVaultHooks } from '../src/hooks/createVaultHooks';
import { SceneProvider, useSceneRuntime } from '../src/scene-panel/context';
import { SceneContext } from '../src/scene-panel/SceneContext';

const legacy = createVaultHooks(3);
const native = createVaultHooks(4);
const scene = { id: 'https://example.org/scene/compatibility', type: 'Scene', items: [] };

test('isolates a Scene Vault4 beneath a P3 provider while sibling hooks retain the P3 vault', async () => {
  const parent = new Vault();
  let before: Vault | undefined;
  let after: Vault | undefined;
  let inside: Vault4 | undefined;
  function LegacyProbe({ position }: { position: 'before' | 'after' }) {
    const vault = legacy.useVault();
    if (position === 'before') before = vault;
    else after = vault;
    return null;
  }
  function SceneProbe() {
    inside = native.useVault();
    expect(useSceneRuntime().vault).toBe(inside);
    return null;
  }
  const view = render(
    <VaultProvider vault={parent}>
      <LegacyProbe position="before" />
      <SceneProvider scene={scene as any}><SceneProbe /></SceneProvider>
      <LegacyProbe position="after" />
    </VaultProvider>
  );
  await waitFor(() => expect(inside).toBeInstanceOf(Vault4));
  expect(before).toBe(parent);
  expect(after).toBe(parent);
  expect(inside).not.toBe(parent);
  expect(parent.getState().iiif.mapping[scene.id]).toBeUndefined();
  view.unmount();
});

test('uses the native P4 provider vault and SceneContext selection without replacing it', async () => {
  const vault = new Vault4();
  vault.loadSync(scene.id, scene);
  let inside: Vault4 | undefined;
  let selected: string | undefined;
  function Probe() {
    inside = native.useVault();
    selected = useSceneRuntime().scene.id;
    return null;
  }
  const view = render(
    <VaultProvider vault={vault} version={4}>
      <SceneContext scene={scene.id}>
        <SceneProvider><Probe /></SceneProvider>
      </SceneContext>
    </VaultProvider>
  );
  await waitFor(() => expect(selected).toBe(scene.id));
  expect(inside).toBe(vault);
  view.unmount();
});

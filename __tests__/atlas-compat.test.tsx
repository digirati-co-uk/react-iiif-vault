import { Atlas, type Preset } from '@atlas-viewer/atlas';
import { render, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Vault, VaultProvider, CanvasContext, CanvasPanel } from '../src';
import { Vault4 } from '../src/presentation-4';

for (const VaultClass of [Vault, Vault4]) {
  test(`Atlas reconciles an existing 2D background with ${VaultClass.name}`, async () => {
    const vault = new VaultClass();
    vault.loadSync('https://example.org/canvas', {
      id: 'https://example.org/canvas',
      type: 'Canvas',
      width: 100,
      height: 80,
      items: [],
    });
    let preset: Preset | undefined;
    const view = render(
      <Atlas
        width={100}
        height={80}
        renderPreset="static-preset"
        onCreated={(value) => {
          preset = value;
        }}
      >
        <VaultProvider vault={vault}>
          <CanvasContext canvas="https://example.org/canvas">
            <world-object width={100} height={80}>
              <CanvasPanel.CanvasBackground />
            </world-object>
          </CanvasContext>
        </VaultProvider>
      </Atlas>
    );
    await waitFor(() => expect(preset?.runtime.world.getObjects().length).toBe(1));
    view.unmount();
  });
}

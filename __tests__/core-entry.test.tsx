import React from 'react';
import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Vault4 } from '@iiif/helpers/vault-4';
import * as core from '../src/core';
import { VaultProvider as LegacyVaultProvider } from '../src';

for (const VaultClass of [core.Vault, Vault4]) {
  test(`core shares providers and selects image/video strategies with ${VaultClass.name}`, () => {
    const vault = new VaultClass();
    const imageId = 'https://example.org/core/image';
    const videoId = 'https://example.org/core/video';
    for (const [id, type] of [
      [imageId, 'Image'],
      [videoId, 'Video'],
    ]) {
      vault.loadSync(id, {
        id,
        type: 'Canvas',
        width: 100,
        height: 80,
        ...(type === 'Video' ? { duration: 10 } : {}),
        items: [
          {
            id: `${id}/page`,
            type: 'AnnotationPage',
            items: [
              {
                id: `${id}/annotation`,
                type: 'Annotation',
                motivation: 'painting',
                target: id,
                body: {
                  id: `${id}/resource`,
                  type,
                  width: 100,
                  height: 80,
                  ...(type === 'Video' ? { duration: 10, format: 'video/mp4' } : { format: 'image/jpeg' }),
                },
              },
            ],
          },
        ],
      });
    }
    expect(core.VaultProvider).toBe(LegacyVaultProvider);
    const hooks = VaultClass === Vault4 ? core.createVaultHooks(4) : core.createVaultHooks(3);
    for (const [canvas, expected] of [
      [imageId, 'images'],
      [videoId, 'media'],
    ]) {
      const view = renderHook(() => ({ vault: hooks.useVault(), strategy: core.useStaticRenderingStrategy() }), {
        wrapper: ({ children }) => (
          <LegacyVaultProvider vault={vault}>
            <core.CanvasContext canvas={canvas}>{children}</core.CanvasContext>
          </LegacyVaultProvider>
        ),
      });
      expect(view.result.current.vault).toBe(vault);
      expect(view.result.current.strategy.type).toBe(expected);
      view.unmount();
    }
  });
}

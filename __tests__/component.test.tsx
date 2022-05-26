/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { useManifest } from '../src';
import { Vault } from '@iiif/vault';
import { createVaultWrapper } from '../test-utils';

describe('component-test', () => {
  test('a hook', async () => {
    const vault = new Vault();
    await vault.loadManifest('https://example.org/manifest', {
      id: 'https://example.org/manifest',
      type: 'Manifest',
      label: { en: ['My manifest'] },
    });

    const hook = renderHook(() => useManifest({ id: 'https://example.org/manifest' }), {
      wrapper: createVaultWrapper(vault),
    });

    expect(hook.result.current!.label).toEqual({
      en: ['My manifest'],
    });
  });
});

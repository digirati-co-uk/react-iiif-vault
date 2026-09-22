import React from 'react';
import { Vault } from '@iiif/helpers/vault';
import { Vault4 } from '@iiif/helpers/vault-4';
import { Atlas, type Preset } from '@atlas-viewer/atlas';
import { render, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { getCanvasContainerSize } from '../src/utility/canvas-compat';

test.each([3, 4] as const)('a reused Atlas preserves home after dimensionless v%s audio', async (version) => {
  const vault = version === 3 ? new Vault() : new Vault4();
  const type = version === 3 ? 'Canvas' : 'Timeline';
  vault.loadSync('https://example.org/audio', {
    '@context': `http://iiif.io/api/presentation/${version}/context.json`,
    id: 'https://example.org/audio',
    type,
    duration: 12,
    items: [],
  });
  const audio = getCanvasContainerSize(
    vault instanceof Vault4
      ? vault.get({ id: 'https://example.org/audio', type: 'Timeline' })
      : vault.get({ id: 'https://example.org/audio', type: 'Canvas' })
  );
  let preset: Preset | undefined;
  const onCreated = (value: Preset) => {
    preset = value;
  };
  const scene = (id: string, width: number, height: number) => (
    <Atlas width={800} height={600} renderPreset="static-preset" onCreated={onCreated}>
      <world-object key={id} width={width} height={height}>
        <box target={{ x: 0, y: 0, width, height }} />
      </world-object>
    </Atlas>
  );
  const view = render(scene('a', 1200, 1800));
  await waitFor(() => expect(preset?.runtime.world.width).toBe(1200));
  await waitFor(() => expect(preset?.runtime.homePosition[3]).toBe(1200));
  const first = Array.from(preset!.runtime.homePosition);
  const aspect = preset!.runtime.width / preset!.runtime.height;
  for (let i = 0; i < 5; i++) {
    view.rerender(scene('b', 4032, 3024));
    await waitFor(() => expect(preset?.runtime.homePosition[4]).toBe(3024));
    view.rerender(scene('audio', audio.width, audio.height));
    await waitFor(() => expect(preset?.runtime.world.width).toBe(audio.width));
    view.rerender(scene('a', 1200, 1800));
    await waitFor(() => expect(Array.from(preset!.runtime.homePosition)).toEqual(first));
    expect(preset!.runtime.width / preset!.runtime.height).toBeCloseTo(aspect, 2);
  }
  view.unmount();
});

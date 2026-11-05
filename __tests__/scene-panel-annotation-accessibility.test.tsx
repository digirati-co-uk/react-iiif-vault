/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { createSceneRuntimeStore } from '../src/scene-panel/store';
import { SceneRuntimeContext } from '../src/scene-panel/context';
import { Annotation3D } from '../src/scene-panel/annotations';

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('Scene annotation keyboard accessibility', () => {
  test('discovers, activates, dismisses, and restores focus without a pointer', async () => {
    const annotation = {
      id: 'https://example.org/keyboard-comment',
      type: 'Annotation',
      label: { en: ['Keyboard comment'] },
      motivation: ['commenting'],
      body: { type: 'TextualBody', value: 'Accessible annotation' },
      target: {
        type: 'SpecificResource',
        source: { id: 'https://example.org/scene', type: 'Scene' },
        selector: { type: 'PointSelector', x: 0, y: 0, z: 0 },
      },
    } as any;
    const scene = { id: 'https://example.org/scene', type: 'Scene', items: [] } as any;
    const store = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 });
    const path = `${scene.id}/supplementary/${annotation.id}`;
    const runtime = {
      scene,
      store,
      annotationMarkerSize: 16,
      annotationMarker: false,
      annotationPopover: undefined,
      resolvePoint: () => null,
      diagnostic: vi.fn(),
      vault: {
        get: (input: unknown) => (input === annotation.id || input === annotation.body ? annotation : undefined),
      },
      register: () => () => undefined,
      selectAnnotation: (selection: string | { id: string; path?: string } | null) => {
        const id = typeof selection === 'string' ? selection : selection?.id || null;
        store.setState({ selectedAnnotation: id, selectedAnnotationPath: id ? path : null });
      },
    } as any;
    render(
      <SceneRuntimeContext.Provider value={runtime}>
        <Annotation3D annotation={annotation} marker={false} />
      </SceneRuntimeContext.Provider>
    );

    const trigger = screen.getByRole('button', { name: 'Keyboard comment' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard comment' });
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('button', { name: 'Close annotation' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});

test('uses a TextualBody label for an otherwise unnamed marker button', async () => {
  const scene = { id: 'https://example.org/scene', type: 'Scene', items: [] } as any;
  const store = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 });
  const annotation = {
    id: 'https://example.org/north-sea',
    type: 'Annotation',
    motivation: ['commenting'],
    body: { type: 'TextualBody', label: '北海', value: '<p></p>' },
    target: { type: 'SpecificResource', source: scene, selector: [{ type: 'PointSelector', x: 1, y: 2, z: 3 }] },
  } as any;
  const runtime = {
    scene,
    store,
    annotationMarker: false,
    annotationPopover: false,
    annotationMarkerSize: 16,
    vault: { get: (input: any) => (input === annotation.id ? annotation : input) },
    register: () => () => {},
    resolvePoint: () => null,
  } as any;
  const mounted = render(
    <SceneRuntimeContext.Provider value={runtime}>
      <Annotation3D annotation={annotation} />
    </SceneRuntimeContext.Provider>
  );
  expect(screen.getByRole('button', { name: '北海' })).toBeTruthy();
  mounted.unmount();
});

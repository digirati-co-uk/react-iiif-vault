/** @vitest-environment happy-dom */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { SceneProvider, useSceneRuntime } from '../src/scene-panel/context';
import { useSceneControls } from '../src/scene-panel/controls';

test('handle and controls atomically deactivate multiple transactions using resource-path refs', async () => {
  const id = 'https://example.org/undo';
  const trigger = `${id}/trigger`;
  const model = `${id}/model`;
  const annotationIds = ['hide', 'disable'].map((action) => `${id}/${action}`);
  const scene = {
    id,
    type: 'Scene',
    annotations: [
      {
        id: `${id}/page`,
        type: 'AnnotationPage',
        items: [
          {
            id: trigger,
            type: 'Annotation',
            motivation: ['commenting'],
            body: { type: 'TextualBody', value: 'Toggle' },
          },
          ...['hide', 'disable'].map((action, index) => ({
            id: annotationIds[index],
            type: 'Annotation',
            motivation: ['activating'],
            target: { id: trigger, type: 'Annotation' },
            body: { type: 'SpecificResource', source: { id: model, type: 'Model' }, action: [action] },
          })),
        ],
      },
    ],
  } as any;
  let runtime!: ReturnType<typeof useSceneRuntime>;
  let controls!: ReturnType<typeof useSceneControls>;
  function Probe() {
    runtime = useSceneRuntime();
    controls = useSceneControls();
    return null;
  }
  const mounted = render(
    <SceneProvider scene={scene}>
      <Probe />
    </SceneProvider>
  );
  await waitFor(() => expect(runtime).toBeTruthy());
  act(() => {
    for (const instance of ['left', 'right'])
      runtime.register({
        path: `${instance}/model`,
        instancePath: instance,
        ids: [model],
        type: 'model',
        supportedActions: ['hide', 'disable'],
      });
    runtime.store.setState({ resourcesReady: true });
    expect(runtime.handle().activate({ id: trigger, type: 'Annotation', path: 'left/model' }).ok).toBe(true);
    expect(runtime.handle().activate({ id: trigger, type: 'Annotation', path: 'right/model' }).ok).toBe(true);
  });
  expect(controls.activeActivations).toHaveLength(4);
  let changes = 0;
  const unsubscribe = runtime.store.subscribe(() => changes++);
  act(() => {
    expect(controls.deactivateMany(annotationIds.map((id) => ({ id, path: 'left/model' })))).toEqual({
      ok: true,
      annotationIds,
    });
  });
  expect(changes).toBe(1);
  expect(runtime.handle().getSnapshot().resources['left/model']).toMatchObject({ visible: true, disabled: false });
  expect(runtime.handle().getSnapshot().resources['right/model']).toMatchObject({ visible: false, disabled: true });
  expect(controls.activeActivations).toHaveLength(2);
  const before = runtime.store.getState();
  act(() => {
    expect(runtime.handle().deactivateMany([annotationIds[0], 'missing']).ok).toBe(false);
  });
  expect(runtime.store.getState()).toBe(before);
  expect(changes).toBe(1);
  act(() => {
    expect(runtime.handle().deactivate(annotationIds[0]).ok).toBe(true);
    expect(controls.deactivate(annotationIds[1]).ok).toBe(true);
  });
  expect(controls.activeActivations).toEqual([]);
  unsubscribe();
  mounted.unmount();
});

/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ScenePanel } from '../src/scene-panel/ScenePanel';
import { useSceneRuntime } from '../src/scene-panel/context';

vi.mock('../src/scene-panel/rendering', () => ({
  SceneCanvas: ({ children, composition, ...props }: React.PropsWithChildren<Record<string, any>>) => (
    <div data-testid="scene-canvas" {...props}>
      {composition}
      {children}
    </div>
  ),
}));

const scene = {
  id: 'https://example.org/scene/presentation',
  type: 'Scene',
  duration: 10,
  label: { en: ['Gallery'] },
  requiredStatement: {
    label: { en: ['Scene attribution'] },
    value: { en: ['<p>Safe <strong>credit</strong></p><script>unsafe()</script>'] },
  },
  items: [],
  placeholderContainer: {
    id: 'https://example.org/canvas/poster',
    type: 'Canvas',
    width: 800,
    height: 400,
    label: { en: ['Opening image'] },
    items: [
      {
        id: 'https://example.org/page/poster',
        type: 'AnnotationPage',
        items: [
          {
            id: 'https://example.org/painting/poster',
            type: 'Annotation',
            motivation: ['painting'],
            body: {
              id: 'https://example.org/poster.jpg',
              type: 'Image',
              format: 'image/jpeg',
              width: 800,
              height: 400,
              label: { en: ['Poster'] },
              requiredStatement: {
                label: { en: ['Image credit'] },
                value: { en: ['Made by <a href="javascript:alert(1)" onclick="alert(1)">Example</a>'] },
              },
            },
            target: 'https://example.org/canvas/poster#xywh=80,40,400,200',
          },
        ],
      },
    ],
  },
  accompanyingContainer: {
    id: 'https://example.org/timeline/audio',
    type: 'Timeline',
    duration: 10,
    label: { en: ['Audio description'] },
    items: [
      {
        id: 'https://example.org/page/audio',
        type: 'AnnotationPage',
        items: [
          {
            id: 'https://example.org/painting/audio',
            type: 'Annotation',
            motivation: ['painting'],
            body: {
              id: 'https://example.org/audio.mp3',
              type: 'Sound',
              format: 'audio/mpeg',
              duration: 10,
              label: { en: ['Spoken description'] },
            },
            target: 'https://example.org/timeline/audio#t=0,10',
          },
        ],
      },
    ],
  },
} as any;

describe('ScenePanel presentation UI', () => {
  test('renders placeholder Canvas and accompanying Timeline bodies', async () => {
    const view = render(<ScenePanel scene={scene} loadingFallback={null} />);

    const poster = await screen.findByRole('img', { name: 'Poster' });
    expect(poster.getAttribute('src')).toBe('https://example.org/poster.jpg');
    expect(poster.style.cssText).toContain('left: 10%');
    expect(poster.style.cssText).toContain('top: 10%');
    expect(poster.style.cssText).toContain('width: 50%');
    expect(poster.style.cssText).toContain('height: 50%');
    expect(screen.getByLabelText('Scene placeholder').textContent).toContain('Opening image');
    expect(screen.getByLabelText('Accompanying content').textContent).toContain('Audio description');
    const audio = view.container.querySelector('audio');
    expect(audio?.getAttribute('src')).toBe('https://example.org/audio.mp3');
    expect(audio?.hasAttribute('controls')).toBe(true);
  });

  test('renders sanitized required statements in one dismissible window', async () => {
    const view = render(<ScenePanel scene={scene} loadingFallback={null} />);

    const section = await screen.findByRole('region', { name: 'Required statements' });
    const statements = section.querySelectorAll('article');
    expect(statements).toHaveLength(2);
    expect(statements[0].querySelector('strong')?.textContent).toContain('Scene attribution — Gallery');
    expect(statements[0].querySelector('div strong')?.textContent).toBe('credit');
    expect(statements[0].querySelector('script')).toBeNull();

    const imageStatement = view.container.querySelector('[data-resource-id="https://example.org/poster.jpg"]');
    expect(imageStatement?.querySelector('strong')?.textContent).toContain('Image credit — Poster');
    expect(imageStatement?.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(imageStatement?.innerHTML).not.toContain('onclick');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss required statements' }));
    expect(screen.queryByRole('region', { name: 'Required statements' })).toBeNull();
  });

  test('allows the default required-statement window to be disabled', async () => {
    render(<ScenePanel scene={scene} loadingFallback={null} requiredStatements={false} />);

    await screen.findByRole('img', { name: 'Poster' });
    expect(screen.queryByRole('region', { name: 'Required statements' })).toBeNull();
  });

  test('tracks required statements on visible rendered resources', async () => {
    const modelId = 'https://example.org/model.glb';
    const modelScene = {
      ...scene,
      placeholderContainer: undefined,
      accompanyingContainer: undefined,
      items: [
        {
          id: 'https://example.org/page/model',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.org/painting/model',
              type: 'Annotation',
              motivation: ['painting'],
              body: {
                id: modelId,
                type: 'Model',
                format: 'model/gltf-binary',
                label: { en: ['Gallery model'] },
                requiredStatement: {
                  label: { en: ['Model credit'] },
                  value: { en: ['Model maker'] },
                },
              },
              target: scene.id,
            },
          ],
        },
      ],
    } as any;
    let runtime!: ReturnType<typeof useSceneRuntime>;
    function RegisteredModel() {
      runtime = useSceneRuntime();
      React.useEffect(
        () =>
          runtime.register({
            path: 'model-path',
            ids: ['https://example.org/painting/model', modelId],
            annotationId: 'https://example.org/painting/model',
            resourceId: modelId,
            resourceType: 'Model',
            type: 'model',
          }),
        [runtime.register]
      );
      return null;
    }

    const view = render(
      <ScenePanel scene={modelScene} loadingFallback={null}>
        <RegisteredModel />
      </ScenePanel>
    );
    await waitFor(() => expect(view.container.querySelector(`[data-resource-id="${modelId}"]`)).not.toBeNull());

    act(() =>
      runtime.store.setState((state) => ({
        resources: { ...state.resources, 'model-path': { ...state.resources['model-path'], hidden: true } },
      }))
    );
    await waitFor(() => expect(view.container.querySelector(`[data-resource-id="${modelId}"]`)).toBeNull());
  });

  test('reports spatialScale and converts visible Scene bounds to physical units', async () => {
    const scaledScene = {
      id: 'https://example.org/scene/scaled',
      type: 'Scene',
      items: [],
      spatialScale: { type: 'Quantity', quantityValue: 0.1, unit: 'm' },
    } as any;
    let runtime!: ReturnType<typeof useSceneRuntime>;
    function BoundedResource() {
      runtime = useSceneRuntime();
      React.useEffect(
        () =>
          runtime.register({
            path: 'bounded-model',
            ids: ['bounded-model'],
            annotationId: 'bounded-model-painting',
            resourceId: 'bounded-model',
            resourceType: 'Model',
            type: 'model',
            getBoundingBox: () => ({
              min: [-2, 1, 0],
              max: [8, 6, 3],
              center: [3, 3.5, 1.5],
            }),
          }),
        [runtime.register]
      );
      return null;
    }

    render(
      <ScenePanel scene={scaledScene} loadingFallback={null}>
        <BoundedResource />
      </ScenePanel>
    );

    const scale = await screen.findByRole('note', { name: 'Scene scale' });
    expect(scale.textContent).toContain('1 Scene unit = 0.1 m');
    expect(scale.textContent).toContain('Visible extent: 1 × 0.5 × 0.3 m');

    act(() =>
      runtime.store.setState((state) => ({
        resources: {
          ...state.resources,
          'bounded-model': { ...state.resources['bounded-model'], hidden: true },
        },
      }))
    );
    await waitFor(() => expect(scale.textContent).not.toContain('Visible extent'));
    expect(scale.textContent).toContain('1 Scene unit = 0.1 m');
  });
});

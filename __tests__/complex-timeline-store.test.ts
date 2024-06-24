import { describe, test, expect } from 'vitest';
import { resolveKeyframeChanges } from '../src/future-helpers/complex-timeline-store';
describe('Complex timeline store', () => {
  test('time: 0', () => {
    const [idx, resolved] = resolveKeyframeChanges({
      targetTime: 0,
      currentTime: 0,
      currentKeyFrameIndex: 0,
      keyframes,
    });

    expect(idx).toEqual(1);
    expect(resolved.length).toEqual(1);
    expect(resolved).toMatchInlineSnapshot(`
      [
        {
          "id": "https://tomcrane.github.io/fire/annos/anno1",
          "resourceType": "image",
          "time": 0,
          "type": "enter",
        },
      ]
    `);
  });

  test('time: 8', () => {
    const [idx, resolved] = resolveKeyframeChanges({
      currentTime: 0,
      targetTime: 8,
      currentKeyFrameIndex: 0,
      keyframes,
    });

    expect(idx).toEqual(2);
    expect(resolved.length).toEqual(2);
    expect(resolved).toMatchInlineSnapshot(`
      [
        {
          "id": "https://tomcrane.github.io/fire/annos/anno1",
          "resourceType": "image",
          "time": 0,
          "type": "enter",
        },
        {
          "id": "https://tomcrane.github.io/fire/annos/anno2",
          "resourceType": "image",
          "time": 2,
          "type": "enter",
        },
      ]
    `);
  });

  test('time: 9', () => {
    const [idx, resolved] = resolveKeyframeChanges({
      currentTime: 0,
      targetTime: 9,
      currentKeyFrameIndex: 0,
      keyframes,
    });

    expect(idx).toEqual(4);
    expect(resolved.length).toEqual(2);
    expect(resolved).toMatchInlineSnapshot(`
      [
        {
          "id": "https://tomcrane.github.io/fire/annos/anno1",
          "resourceType": "image",
          "time": 0,
          "type": "enter",
        },
        {
          "id": "https://tomcrane.github.io/fire/annos/anno4",
          "resourceType": "image",
          "time": 9,
          "type": "enter",
        },
      ]
    `);
  });
  test('time: 13', () => {
    const [idx, resolved] = resolveKeyframeChanges({
      currentTime: 0,
      targetTime: 13,
      currentKeyFrameIndex: 0,
      keyframes,
    });

    expect(idx).toEqual(5);
    expect(resolved.length).toEqual(3);
    expect(resolved).toMatchInlineSnapshot(`
      [
        {
          "id": "https://tomcrane.github.io/fire/annos/anno1",
          "resourceType": "image",
          "time": 0,
          "type": "enter",
        },
        {
          "id": "https://tomcrane.github.io/fire/annos/anno4",
          "resourceType": "image",
          "time": 9,
          "type": "enter",
        },
        {
          "id": "https://tomcrane.github.io/fire/annos/anno5",
          "isPrime": true,
          "resourceType": "video",
          "time": 13,
          "type": "enter",
        },
      ]
    `);
  });

  test('time: 13 -> 26', () => {
    const [idx, resolved] = resolveKeyframeChanges({
      currentTime: 13,
      targetTime: 26,
      currentKeyFrameIndex: 5,
      keyframes,
    });

    expect(keyframes[5]).toMatchInlineSnapshot(`
      {
        "id": "https://tomcrane.github.io/fire/annos/anno4",
        "resourceType": "image",
        "time": 20,
        "type": "exit",
      }
    `);

    expect(idx).toEqual(8);
    expect(resolved.length).toEqual(3);
    expect(resolved).toMatchInlineSnapshot(`
      [
        {
          "id": "https://tomcrane.github.io/fire/annos/anno4",
          "resourceType": "image",
          "time": 20,
          "type": "exit",
        },
        {
          "id": "https://tomcrane.github.io/fire/annos/anno5",
          "resourceType": "video",
          "time": 26,
          "type": "exit",
        },
        {
          "id": "https://tomcrane.github.io/fire/annos/anno6",
          "isPrime": true,
          "resourceType": "video",
          "time": 26,
          "type": "enter",
        },
      ]
    `);
  });

  test('time: 30 -> 40', () => {
    const [idx, resolved] = resolveKeyframeChanges({
      currentTime: 30,
      targetTime: 40,
      currentKeyFrameIndex: 9,
      keyframes,
    });

    expect(keyframes[9]).toMatchInlineSnapshot(`
      {
        "id": "https://tomcrane.github.io/fire/annos/anno6",
        "resourceType": "video",
        "time": 38,
        "type": "exit",
      }
    `);

    expect(idx).toEqual(12);
    expect(resolved).toMatchInlineSnapshot(`
      [
        {
          "id": "https://tomcrane.github.io/fire/annos/anno6",
          "resourceType": "video",
          "time": 38,
          "type": "exit",
        },
        {
          "id": "https://tomcrane.github.io/fire/annos/anno7",
          "resourceType": "video",
          "time": 38,
          "type": "enter",
        },
      ]
    `);
  });
});

const keyframes: any[] = [
  {
    id: 'https://tomcrane.github.io/fire/annos/anno1',
    type: 'enter',
    resourceType: 'image',
    time: 0,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno2',
    type: 'enter',
    resourceType: 'image',
    time: 2,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno2',
    type: 'exit',
    resourceType: 'image',
    time: 9,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno4',
    type: 'enter',
    resourceType: 'image',
    time: 9,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno5',
    type: 'enter',
    resourceType: 'video',
    time: 13,
    isPrime: true,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno4',
    type: 'exit',
    resourceType: 'image',
    time: 20,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno5',
    type: 'exit',
    resourceType: 'video',
    time: 26,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno6',
    type: 'enter',
    resourceType: 'video',
    time: 26,
    isPrime: true,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno8',
    type: 'enter',
    resourceType: 'video',
    time: 29,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno6',
    type: 'exit',
    resourceType: 'video',
    time: 38,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno8',
    type: 'change',
    isPrime: true,
    resourceType: 'video',
    time: 38,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno7',
    type: 'enter',
    resourceType: 'video',
    time: 38,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno7',
    type: 'exit',
    resourceType: 'video',
    time: 45,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno8',
    type: 'change',
    isPrime: true,
    resourceType: 'video',
    time: 45,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno8',
    type: 'exit',
    resourceType: 'video',
    time: 48,
  },
  {
    id: 'https://tomcrane.github.io/fire/annos/anno1',
    type: 'exit',
    resourceType: 'image',
    time: 120,
  },
];

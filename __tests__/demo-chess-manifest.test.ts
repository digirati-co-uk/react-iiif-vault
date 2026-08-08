import { describe, expect, test } from 'vitest';
import { createSceneHelper } from '@iiif/helpers/scenes';
import { Vault4 } from '@iiif/helpers/vault-4';
import { createChessManifest } from '../src/demo/chess-manifest';

describe('chess demo manifest', () => {
  test('turns PGN positions into persistent pieces and activation transactions', () => {
    const manifest: any = createChessManifest(`[Event "Demo game"]
[White "Ada"]
[Black "Grace"]

1. e4 e5 2. Nf3`);
    const scene = manifest.items[0];
    const paintings = scene.items[0].items;
    const positions = scene.annotations[0].items;
    const pieces = paintings.filter((annotation: any) => annotation.id.includes('/piece/'));
    const comments = positions.filter((annotation: any) => annotation.motivation.includes('commenting'));
    const activations = positions.filter((annotation: any) => annotation.motivation.includes('activating'));

    expect(manifest.label.en[0]).toBe('Demo game · Ada vs Grace');
    expect(pieces).toHaveLength(32);
    expect(comments.map((annotation: any) => annotation.label.en[0])).toEqual([
      'Initial position',
      '1. e4',
      '1… e5',
      '2. Nf3',
    ]);
    expect(comments.every((annotation: any) => annotation.target === undefined)).toBe(true);
    expect(activations).toHaveLength(4);
    expect(activations.every((annotation: any) => annotation.body.items.length === pieces.length)).toBe(true);
    expect(pieces[0].body.source.id).toMatch(/^\/hotlink-3d\/chess\/opera-game\/assets\//);
  });

  test('rejects notation without a legal move', () => {
    expect(() => createChessManifest('not a chess game')).toThrow();
  });

  test('keeps whole-Scene painting annotations renderable at the Scene origin', () => {
    const manifest: any = createChessManifest('1. e4');
    const vault = new Vault4();
    const normalized = vault.loadManifestSync(manifest.id, manifest)!;
    const scene = vault.get<any>(normalized.items[0])!;
    const paintables = createSceneHelper(vault).getPaintables(scene).items;
    const wholeScenePaintings = paintables.filter(
      ({ annotation }) => String(annotation.id).includes('/piece/') || String(annotation.id).endsWith('/board-painting')
    );

    expect(wholeScenePaintings).toHaveLength(33);
    expect(wholeScenePaintings.every(({ target }) => target.point?.every((coordinate) => coordinate === 0))).toBe(true);
  });

  test('tracks captures and castling through the generated positions', () => {
    expect(() => createChessManifest('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. O-O')).not.toThrow();
  });

  test('ignores nested variations and preserves mainline comments', () => {
    const manifest: any = createChessManifest(`1. e4 e5 2. d4 exd4 3. Qxd4 Nc6 4. Qe3 Nf6
5. Nc3 Bb4 6. Bd2 O-O 7. O-O-O Re8
( { An alternative. } 7... d6 { Develops the bishop. } (7... Bxc3) )
8. Qg3 Nxe4 { **Mainline** commentary with (parentheses). } 9. Nxe4 0-1`);
    const comments = manifest.items[0].annotations[0].items.filter((item: any) =>
      item.motivation.includes('commenting')
    );

    expect(comments).toHaveLength(18);
    expect(comments.at(-2).body.value).toContain('Mainline commentary with (parentheses).');
    expect(comments.every((comment: any) => !comment.body.value.includes('An alternative.'))).toBe(true);
  });
});

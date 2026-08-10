import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { getValue as helperGetValue } from '@iiif/helpers/i18n';
import { createSceneHelper as helperCreateSceneHelper } from '@iiif/helpers/scenes';
import { upgrade as parserUpgrade } from '@iiif/parser/upgrader';
import { Traverse as ParserTraverse3 } from '@iiif/parser/presentation-3';
import {
  Traverse as ParserTraverse4,
  upgradePresentation3To4 as parserUpgradePresentation3To4,
} from '@iiif/parser/presentation-4';
import type { Manifest as Manifest3, ManifestNormalized as Manifest3Normalized } from '../src';
import { Vault as PublicVault3 } from '../src';
import { Vault as HelperVault3 } from '@iiif/helpers/vault';
import type {
  Collection as Collection4,
  Manifest as Manifest4,
  ManifestNormalized as Manifest4Normalized,
  Scene,
  SceneNormalized,
} from '../src/presentation-4';
import { getValue, Traverse as Traverse3, upgrade } from '../src/helpers';
import {
  createSceneHelper,
  fetch as fetchPresentation4,
  Traverse as Traverse4,
  upgradePresentation3To4,
} from '../src/presentation-4-helpers';

function checkPublicTypes(manifest3: Manifest3, manifest4: Manifest4) {
  expectTypeOf<Manifest3Normalized['type']>().toEqualTypeOf<'Manifest'>();
  expectTypeOf<Manifest4Normalized['type']>().toEqualTypeOf<'Manifest'>();
  expectTypeOf<Scene['type']>().toEqualTypeOf<'Scene'>();
  expectTypeOf<SceneNormalized['type']>().toEqualTypeOf<'Scene'>();

  const upgraded = upgradePresentation3To4(manifest3);
  expectTypeOf(upgraded).toEqualTypeOf<Manifest4>();

  const traversed3 = new Traverse3({
    manifest: [
      (manifest) => {
        expectTypeOf(manifest).toEqualTypeOf<Manifest3>();
        return manifest;
      },
    ],
  }).traverseManifest(manifest3);
  expectTypeOf(traversed3).toEqualTypeOf<Manifest3>();

  const traversed = new Traverse4({
    manifest: [
      (manifest) => {
        expectTypeOf(manifest).toEqualTypeOf<Manifest4>();
        return manifest;
      },
    ],
  }).traverseManifest(manifest4);
  expectTypeOf(traversed).toEqualTypeOf<Manifest4>();
}

void checkPublicTypes;

describe('versioned public API', () => {
  test('re-exports helpers without runtime wrappers', () => {
    expect(PublicVault3).toBe(HelperVault3);
    expect(getValue).toBe(helperGetValue);
    expect(upgrade).toBe(parserUpgrade);
    expect(Traverse3).toBe(ParserTraverse3);
    expect(createSceneHelper).toBe(helperCreateSceneHelper);
    expect(Traverse4).toBe(ParserTraverse4);
    expect(upgradePresentation3To4).toBe(parserUpgradePresentation3To4);
  });

  test('fetches and upgrades Presentation 3 JSON to Presentation 4', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          '@context': 'http://iiif.io/api/presentation/3/context.json',
          id: 'https://example.org/manifest',
          type: 'Manifest',
          label: { en: ['Example'] },
          items: [],
        })
      )
    );

    const manifest = await fetchPresentation4('https://example.org/manifest');

    expectTypeOf(manifest).toEqualTypeOf<Manifest4 | Collection4>();
    expect(manifest).toMatchObject({
      '@context': 'http://iiif.io/api/presentation/4/context.json',
      id: 'https://example.org/manifest',
      type: 'Manifest',
    });

    vi.unstubAllGlobals();
  });
});

import type { Vault } from '@iiif/helpers/vault';
import type { Vault4 } from '@iiif/helpers/vault-4';
import type { ManifestNormalized as Manifest3, RangeNormalized as Range3 } from '@iiif/parser/presentation-3-normalized/types';
import type { ManifestNormalized as Manifest4, RangeNormalized as Range4 } from '@iiif/parser/presentation-4-normalized/types';
import { findManifestSelectedRange as findManifestRange, findSelectedRange as findRange } from '@iiif/helpers/ranges';

export { findAllCanvasesInRange, findFirstCanvasFromRange } from '@iiif/helpers/ranges';

export function findManifestSelectedRange(vault: Vault, manifest: Manifest3, canvasId: string): Range3 | null;
export function findManifestSelectedRange(vault: Vault4, manifest: Manifest4, canvasId: string): Range4 | null;
export function findManifestSelectedRange(vault: Vault | Vault4, manifest: Manifest3 | Manifest4, canvasId: string) {
  return findManifestRange(vault, manifest, canvasId);
}

export function findSelectedRange(vault: Vault, range: Range3, canvasId: string): Range3 | null;
export function findSelectedRange(vault: Vault4, range: Range4, canvasId: string): Range4 | null;
export function findSelectedRange(vault: Vault | Vault4, range: Range3 | Range4, canvasId: string) {
  return findRange(vault, range, canvasId);
}

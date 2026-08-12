// This is valid under a range context.
import { useResourceContext } from '../context/ResourceContext';
import type { RangeNormalized } from '@iiif/parser/presentation-3-normalized/types';
import { type DependencyList, useMemo } from 'react';
import { useVaultSelector } from './useVaultSelector';

export function useRange(options?: { id?: string; selector?: undefined }): RangeNormalized | undefined;
export function useRange<T>(
  options?: { id: string; selector: (range: RangeNormalized) => T },
  deps?: DependencyList
): T | undefined;
export function useRange<T = RangeNormalized>(
  options: {
    id?: string;
    selector?: (range: RangeNormalized) => T;
  } = {},
  deps: DependencyList = []
): RangeNormalized | T | undefined {
  const { id, selector } = options;
  const ctx = useResourceContext();
  const rangeId = id ? id : ctx.range;

  const range = useVaultSelector((s) => (rangeId ? s.iiif.entities.Range[rangeId] : undefined), [rangeId]);

  return useMemo(() => {
    if (!range) {
      return undefined;
    }
    if (selector) {
      return selector(range);
    }
    return range;
  }, [range, selector, ...deps]);
}

// This is valid under a range context.
import { useResourceContext } from '../context/ResourceContext';
import { RangeNormalized } from '@iiif/presentation-3-normalized';
import { useMemo } from 'react';
import { useVaultSelector } from './useVaultSelector';

export function useRange(options?: { id: string }): RangeNormalized | undefined;
export function useRange<T>(
  options?: { id: string; selector: (range: RangeNormalized) => T },
  deps?: any[]
): T | undefined;
export function useRange<T = RangeNormalized>(
  options: {
    id?: string;
    selector?: (range: RangeNormalized) => T;
  } = {},
  deps: any[] = []
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

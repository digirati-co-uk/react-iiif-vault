import { useMemo } from 'react';
import { useCanvas } from './useCanvas';
import { useManifest } from './useManifest';
import { getParsedTargetSelector } from '../utils';
import { expandTarget } from '@iiif/helpers';

export function useCanvasStartTime() {
  const manifest = useManifest();
  const canvas = useCanvas();

  return useMemo(() => {
    if (!manifest || !canvas || !manifest.start) {
      return null;
    }

    const parsed = expandTarget(manifest.start as any);
    if (!parsed) {
      return null;
    }

    if (parsed.source.id !== canvas.id) {
      return null;
    }

    if (!parsed || !parsed.selector || parsed.selector.type !== 'TemporalSelector') {
      return null;
    }

    return parsed.selector.temporal;
  }, [manifest, canvas]);
}

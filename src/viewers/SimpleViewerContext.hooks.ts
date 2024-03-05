import { getManifestSequence } from '../future-helpers/sequences';
import { useManifest } from '../hooks/useManifest';
import { useCallback, useMemo, useState } from 'react';
import { useRange } from '../hooks/useRange';
import { useVault } from '../hooks/useVault';

export function useCanvasSequence({ startCanvas, disablePaging }: { startCanvas?: string; disablePaging?: boolean }) {
  const vault = useVault();
  const manifest = useManifest();
  const range = useRange();
  const [cursor, setCursor] = useState<number>(undefined as any);
  const rangeOrManifest = range ? range : manifest;

  if (!rangeOrManifest) {
    throw new Error('Nothing selected');
  }

  const [items, initialSequence] = useMemo(
    () => getManifestSequence(vault, rangeOrManifest, { disablePaging }),
    [vault, rangeOrManifest, disablePaging]
  );

  const setCanvasIndex = useCallback(
    (index: number) => {
      const foundSequence = initialSequence.findIndex((i) => i.includes(index));
      setCursor(foundSequence === -1 ? 0 : foundSequence);
    },
    [items, initialSequence]
  );

  const setCanvasId = useCallback(
    (id: string) => {
      const foundIndex = items.findIndex((i) => i.id === id);
      if (foundIndex !== -1) {
        setCanvasIndex(foundIndex);
      } else {
        setCursor(0);
      }
    },
    [items, initialSequence]
  );

  const next = useCallback(() => {
    setCursor((i) => {
      if (i >= initialSequence.length - 1) {
        return i;
      }
      return i + 1;
    });
  }, [initialSequence]);

  const previous = useCallback(() => {
    setCursor((i) => {
      if (i <= 0) {
        return 0;
      }
      return i - 1;
    });
  }, [initialSequence]);

  // Need to set an initial cursor from the canvasId (if it's valid)
  if (typeof cursor === 'undefined') {
    if (startCanvas) {
      setCanvasId(startCanvas);
    } else {
      setCursor(0);
    }
  }

  return {
    visibleItems: initialSequence[cursor]?.map((idx) => items[idx].id) || [],
    cursor,
    items,
    sequence: initialSequence,
    hasPrevious: cursor > 0,
    hasNext: cursor < initialSequence.length - 1,
    setSequenceIndex: setCursor,
    setCanvasIndex,
    setCanvasId,
    next,
    previous,
  };
}

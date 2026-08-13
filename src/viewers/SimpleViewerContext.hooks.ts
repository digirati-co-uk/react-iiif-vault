import { getContainerSequence } from '../utility/container-sequence';
import { useManifest } from '../hooks/useManifest';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRange } from '../hooks/useRange';
import { useVault } from '../hooks/useVault';

export function useContainerSequence({
  startCanvas,
  startContainer,
  disablePaging,
  containerTypes,
}: {
  startCanvas?: string;
  startContainer?: string;
  disablePaging?: boolean;
  containerTypes?: readonly import('../utility/canvas-compat').ContainerReference['type'][];
}) {
  const vault = useVault();
  const manifest = useManifest();
  const range = useRange();
  const [cursor, setCursor] = useState(0);
  const rangeOrManifest = range ? range : manifest;

  if (!rangeOrManifest) {
    throw new Error('Nothing selected');
  }

  const [items, initialSequence] = useMemo(
    () => getContainerSequence(vault, rangeOrManifest, { disablePaging, containerTypes }),
    [vault, rangeOrManifest, disablePaging, containerTypes]
  );
  const lastSequence = useRef({ sequence: initialSequence, items });

  if (lastSequence.current.sequence !== initialSequence) {
    const prev = lastSequence.current;
    const previousItemIds = new Set(
      (prev.sequence[cursor] || []).flatMap((index) => (prev.items[index] ? [prev.items[index].id] : []))
    );
    const nextCursor = previousItemIds.size
      ? initialSequence.findIndex((group) =>
          group.some((index) => !!items[index] && previousItemIds.has(items[index].id))
        )
      : -1;
    lastSequence.current = { sequence: initialSequence, items };
    setCursor(initialSequence.length ? (nextCursor >= 0 ? nextCursor : 0) : 0);
  }

  const setSequenceIndex = useCallback(
    (index: number) => {
      const normalized = Number.isFinite(index) ? Math.trunc(index) : 0;
      setCursor(initialSequence.length ? Math.max(0, Math.min(normalized, initialSequence.length - 1)) : 0);
    },
    [initialSequence.length]
  );

  const setCanvasIndex = useCallback(
    (index: number) => {
      const foundSequence = initialSequence.findIndex((i) => i.includes(index));
      setCursor(foundSequence === -1 ? 0 : foundSequence);
    },
    [initialSequence]
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
    [items, setCanvasIndex]
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

  const initialContainer = useRef(startContainer || startCanvas);
  if (initialContainer.current) {
    const id = initialContainer.current;
    initialContainer.current = undefined;
    setCanvasId(id);
  }

  return {
    visibleItems: initialSequence[cursor]?.map((idx) => items[idx].id) || [],
    cursor,
    items,
    sequence: initialSequence,
    hasPrevious: cursor > 0,
    hasNext: cursor < initialSequence.length - 1,
    setSequenceIndex,
    setCanvasIndex,
    setCanvasId,
    next,
    previous,
  };
}

/** @deprecated Use useContainerSequence. */
export const useCanvasSequence = useContainerSequence;

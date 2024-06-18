import { useCanvas } from '@atlas-viewer/atlas';
import { ComplexChoice } from '@iiif/helpers';
import { Handler } from 'mitt';
import { useEffect, useMemo, useState } from 'react';
import { useEventEmitter } from '../context/EventContext';
import { useVisibleCanvases } from '../context/VisibleCanvasContext';
import { ChoiceEvents } from './useRenderingStrategy';

export function useCanvasChoices({ canvasId }: { canvasId?: string } = {}): {
  choices: Array<{ canvasId: string; choice: ComplexChoice }>;
  actions: { makeChoice: (id: string, options?: { deselectOthers?: boolean; deselect?: boolean }) => void };
} {
  const canvas = useCanvas();
  const visibleCanvases = useVisibleCanvases();
  const visibleCanvasIds = useMemo(() => {
    if (canvasId) {
      return [canvasId];
    }
    if (canvas) {
      return [canvas.id];
    }
    return visibleCanvases.map((canvas) => canvas.id);
  }, [canvasId, canvas, visibleCanvases]);

  const [savedChoices, setSavedChoices] = useState<Record<string, ComplexChoice>>({});
  const $em = useEventEmitter<ChoiceEvents>();

  useEffect(() => {
    const handler: Handler<ChoiceEvents['choice-change']> = (ev) => {
      console.log('choice-change', ev);
      const canvasId = ev.partOf.canvasId;
      if (canvasId) {
        setSavedChoices((prev) => {
          return {
            ...prev,
            [canvasId]: ev.choice,
          };
        });
      }
    };

    $em.on('choice-change', handler);
    return () => {
      $em.off('choice-change', handler);
    };
  }, []);

  const choices = useMemo(() => {
    const toReturn: Array<{
      canvasId: string;
      choice: ComplexChoice;
    }> = [];

    for (const canvasId of visibleCanvasIds) {
      const choice = savedChoices[canvasId];
      if (choice) {
        toReturn.push({ canvasId, choice });
      }
    }

    return toReturn;
  }, [visibleCanvasIds, savedChoices]);

  const actions = useMemo(() => {
    return {
      makeChoice: (id: string, options?: { deselectOthers?: boolean; deselect?: boolean }) => {
        $em.emit('make-choice', { choiceId: id, ...options });
      },
    };
  }, [$em]);

  return {
    choices,
    actions,
  };
}

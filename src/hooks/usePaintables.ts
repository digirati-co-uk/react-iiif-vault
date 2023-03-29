import { useCallback, useMemo, useState } from 'react';
import { useVault } from './useVault';
import { usePaintingAnnotations } from './usePaintingAnnotations';
import { createPaintingAnnotationsHelper } from '@iiif/vault-helpers/painting-annotations';

export function usePaintables(
  options?: { defaultChoices?: string[]; enableSingleAnnotation?: boolean },
  deps: any[] = []
) {
  const vault = useVault();
  const helper = useMemo(() => {
    return createPaintingAnnotationsHelper(vault);
  }, []);
  const paintingAnnotations = usePaintingAnnotations({ enableSingleAnnotation: options?.enableSingleAnnotation });
  const [enabledChoices, setEnabledChoices] = useState<string[]>(options?.defaultChoices || []);

  const paintables = useMemo(
    () => helper.getPaintables(paintingAnnotations, enabledChoices),
    [vault, paintingAnnotations, enabledChoices, ...deps]
  );

  const makeChoice = useCallback(
    (
      id: string,
      { deselectOthers = true, deselect = false }: { deselectOthers?: boolean; deselect?: boolean } = {}
    ) => {
      if (paintables.choice) {
        // Don't support multiple choice yet.
        if (paintables.choice.type !== 'single-choice') {
          throw new Error('Complex choice not supported yet');
        }

        setEnabledChoices((prevChoices) => {
          if (deselect) {
            const without = prevChoices.filter((e) => e !== id);

            if (without.length === 0) {
              const defaultId = paintables.items[0].resource.id;
              if (defaultId) {
                return [defaultId];
              } else {
                return [];
              }
            }

            return without;
          }

          if (deselectOthers) {
            return [id];
          }

          const newChoices = [...prevChoices];

          // Add the default ID.
          if (newChoices.length === 0 && paintables.items.length) {
            const defaultId = paintables.items[0].resource.id;
            if (defaultId) {
              newChoices.push(defaultId);
            }
          }

          if (prevChoices.indexOf(id) !== -1) {
            return prevChoices;
          }

          return [...prevChoices, id];
        });
      }
    },
    [paintables.choice]
  );

  const actions = { makeChoice };

  return [paintables, actions] as const;
}

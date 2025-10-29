import { useMemo } from "react";
import { getRenderingStrategy } from "../utils";
import { usePaintingAnnotations } from "./usePaintingAnnotations";
import { useVault } from "./useVault";
import { createPaintingAnnotationsHelper } from "@iiif/helpers";
import { useCanvas } from "./useCanvas";
import type { RenderingStrategy } from "../features/rendering-strategy/strategies";

export function useStaticRenderingStrategy({
  supports = ['empty', 'images', 'media', '3d-model', 'textual-content', 'complex-timeline']
}: {
  supports?: Array<RenderingStrategy['type']>;
} = {}) {
  const vault = useVault();
  const canvas = useCanvas();
  const paintingAnnotations = usePaintingAnnotations();
  const helper = useMemo(() => createPaintingAnnotationsHelper(vault), [vault]);
  const paintables = useMemo(() => helper.getPaintables(paintingAnnotations), [helper, paintingAnnotations]);

  return useMemo(() =>
    getRenderingStrategy({
      canvas,
      loadImageService: (t) => t,
      paintables,
      supports,
    }), [canvas, paintables, supports]);
}

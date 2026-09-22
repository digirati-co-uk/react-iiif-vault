import { useMemo } from "react";
import { getRenderingStrategy } from "../utils";
import { useCompatiblePaintingAnnotations } from "./useCompatiblePaintingAnnotations";
import { useVault } from "./useVault";
import { createPaintingAnnotationsHelper } from "@iiif/helpers";
import { useCanvasContainer } from "./useCanvasContainer";
import type { RenderingStrategy } from "../features/rendering-strategy/strategies";

export function useStaticRenderingStrategy({
  supports = ['empty', 'images', 'media', '3d-model', 'textual-content', 'complex-timeline']
}: {
  supports?: Array<RenderingStrategy['type']>;
} = {}) {
  const vault = useVault();
  const canvas = useCanvasContainer();
  const paintingAnnotations = useCompatiblePaintingAnnotations();
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

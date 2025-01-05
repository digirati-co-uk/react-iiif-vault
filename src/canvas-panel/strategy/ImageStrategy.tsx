import { ReactNode } from 'react';
import { useStrategy } from '../../context/StrategyContext';
import { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
import { useThumbnail } from '../../hooks/useThumbnail';
import { RenderImage } from '../render/Image';
import { ViewerPresetContext, useViewerPreset } from '../../context/ViewerPresetContext';
import { useOverlay } from '../context/overlays';
import { useCanvas } from '../../hooks/useCanvas';
import { useRenderControls } from '../../context/ControlsContext';

export interface ImageStrategyProps {
  isStatic?: boolean;
  enableSizes?: boolean;
  onClickPaintingAnnotation?: (id: string, image: ImageWithOptionalService, e: any) => void;
  children?: ReactNode;
}

export function RenderImageStrategy({
  isStatic = false,
  enableSizes = false,
  onClickPaintingAnnotation,
  children,
}: ImageStrategyProps) {
  const { strategy } = useStrategy();
  const { renderViewerControls, viewControlsDeps } = useRenderControls();

  const canvas = useCanvas();
  const preset = useViewerPreset();
  const thumbnail = useThumbnail({ maxWidth: 256, maxHeight: 256 });

  useOverlay(
    preset && strategy.type === 'images' && renderViewerControls ? 'overlay' : 'none',
    `canvas-portal-controls-${canvas?.id}`,
    ViewerPresetContext.Provider,
    renderViewerControls
      ? {
          value: preset || null,
          children: renderViewerControls(strategy as any),
        }
      : {},
    [canvas, preset, strategy, ...(viewControlsDeps || [])]
  );

  if (strategy.type !== 'images') return null;

  return (
    <>
      {strategy.images.map((image, idx) => (
        <RenderImage
          isStatic={isStatic}
          key={image.id + idx}
          image={image}
          id={image.id}
          thumbnail={idx === 0 ? thumbnail : undefined}
          selector={image.selector}
          enableSizes={enableSizes}
          onClick={
            onClickPaintingAnnotation
              ? (e) => {
                  onClickPaintingAnnotation(image.annotationId, image, e);
                }
              : undefined
          }
        />
      ))}

      {children}
    </>
  );
}

import type { ReactNode } from 'react';
import { useStrategy } from '../../context/StrategyContext';
import type { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
import { useThumbnail } from '../../hooks/useThumbnail';
import { RenderImage } from './Image';
import type { ImageOptions } from './types';

export interface ImageStrategyProps extends ImageOptions {
  isStatic?: boolean;
  enableSizes?: boolean;
  enableAnnotations?: boolean;
  onClickPaintingAnnotation?: (id: string, image: ImageWithOptionalService, e: any) => void;
  rotation?: number;
  children?: ReactNode;
}

export function RenderImageStrategy({
  isStatic = false,
  enableSizes = false,
  enableAnnotations = true,
  onClickPaintingAnnotation,
  rotation,
  children,
  ...options
}: ImageStrategyProps) {
  const { strategy } = useStrategy();
  const thumbnail = useThumbnail({ maxWidth: 256, maxHeight: 256 });

  if (strategy.type !== 'images') return null;

  const rotationProperty = strategy.images.length === 1 ? rotation : 0;

  return (
    <>
      {strategy.images.map((image, idx) => (
        <RenderImage
          {...options}
          isStatic={isStatic}
          key={image.id + idx}
          image={image}
          id={image.id}
          thumbnail={idx === 0 ? thumbnail : undefined}
          selector={image.selector}
          enableSizes={enableSizes}
          enableAnnotations={enableAnnotations}
          rotation={rotationProperty}
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

import type { BoxSelector, ImageCandidate } from '@iiif/helpers';
import React, { Fragment, type ReactNode, useMemo } from 'react';
import type { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
import { RenderAnnotationPage } from './AnnotationPage';
import { RenderImageService } from './ImageService';

export function RenderImage({
  id,
  image,
  thumbnail,
  isStatic,
  x = 0,
  y = 0,
  children,
  selector,
  onClick,
  enableSizes,
  enableAnnotations,
}: {
  id: string;
  image: ImageWithOptionalService;
  thumbnail?: ImageCandidate;
  isStatic?: boolean;
  enableSizes?: boolean;
  enableAnnotations?: boolean;
  selector?: BoxSelector;
  x?: number;
  y?: number;
  children?: ReactNode;
  onClick?: (e: any) => void;
}) {
  const crop = useMemo(() => {
    // @todo crops only work if x is not zero due to bug in selector parsing
    //   setting the spatial width to canvas - which isn't correct.
    if (!selector || (selector.spatial.x === 0 && selector.spatial.y === 0)) {
      return undefined;
    }
    return selector.spatial;
  }, [selector]);

  const rotation = useMemo(() => {
    if (!image.annotation) {
      return 0;
    }
    const body: any = Array.isArray(image.annotation.body) ? image.annotation.body?.[0] : image.annotation.body;
    if (body) {
      if (body.selector?.type === 'ImageApiSelector') {
        return Number(body.selector.rotation);
      }
    }
  }, [image]);

  const targetX = x + image.target.spatial.x;
  const targetY = y + image.target.spatial.y;

  let targetWidth = image.target.spatial.width;
  let targetHeight = image.target.spatial.height;

  let imageWidth = image.target.spatial.width;
  let imageHeight = image.target.spatial.height;

  if (rotation === 90 || rotation === 270) {
    [targetWidth, targetHeight] = [targetHeight, targetWidth];
    [imageWidth, imageHeight] = [imageHeight, imageWidth];
  }

  return (
    <world-object
      key={id + (image.service ? 'server' : 'no-service')}
      x={targetX}
      y={targetY}
      width={targetWidth}
      height={targetHeight}
      onClick={onClick}
      rotation={rotation}
    >
      {!image.service ? (
        <Fragment key="no-service">
          <world-image
            onClick={onClick}
            uri={image.id}
            target={{ x: 0, y: 0, width: imageWidth, height: imageHeight }}
            display={
              imageWidth && imageHeight
                ? {
                    width: imageWidth,
                    height: imageHeight,
                  }
                : undefined
            }
            crop={crop}
          />
          {children}
        </Fragment>
      ) : (
        <Fragment key="service">
          <RenderImageService
            image={image as any}
            thumbnail={thumbnail}
            crop={crop}
            enableSizes={enableSizes}
            rotation={rotation}
          />
          {children}
        </Fragment>
      )}

      {enableAnnotations && image.annotationPages
        ? image.annotationPages.map((page) => (
            <RenderAnnotationPage key={page.id} page={page} className="image-service-annotation" ignoreTargetId />
          ))
        : null}
    </world-object>
  );
}

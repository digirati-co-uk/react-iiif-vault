import type { BoxSelector, ImageCandidate } from '@iiif/helpers';
import React, { Fragment, type ReactNode, useMemo } from 'react';
import type { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
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
}: {
  id: string;
  image: ImageWithOptionalService;
  thumbnail?: ImageCandidate;
  isStatic?: boolean;
  enableSizes?: boolean;
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
    const body: any = Array.isArray(image.annotation.body) ? image.annotation.body?.[0] : image.annotation.body;
    if (body) {
      if (body.selector?.type === 'ImageApiSelector') {
        return Number(body.selector.rotation);
      }
    }
  }, [image]);

  return (
    <world-object
      key={id + (image.service ? 'server' : 'no-service')}
      x={x + image.target.spatial.x}
      y={y + image.target.spatial.y}
      width={image.target.spatial.width}
      height={image.target.spatial.height}
      onClick={onClick}
      rotation={rotation}
    >
      {!image.service ? (
        <Fragment key="no-service">
          <world-image
            onClick={onClick}
            uri={image.id}
            target={{ x: 0, y: 0, width: image.target.spatial.width, height: image.target.spatial.height }}
            display={
              image.width && image.height
                ? {
                    width: image.width,
                    height: image.height,
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
    </world-object>
  );
}

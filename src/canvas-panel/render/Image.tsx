import { ImageCandidate } from '@atlas-viewer/iiif-image-api';
import React, { Fragment, ReactNode, useMemo } from 'react';
import { TileSet } from '@atlas-viewer/atlas';
import { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
import { BoxSelector } from '@iiif/vault-helpers';

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
}: {
  id: string;
  image: ImageWithOptionalService;
  thumbnail?: ImageCandidate;
  isStatic?: boolean;
  selector: BoxSelector;
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

  return (
    <world-object
      key={id + image.service ? 'server' : 'no-service'}
      x={x + image.target.spatial.x}
      y={y + image.target.spatial.y}
      width={image.target.spatial.width}
      height={image.target.spatial.height}
    >
      {!image.service ? (
        <Fragment key="no-service">
          <world-image
            onClick={onClick}
            uri={image.id}
            target={image.target.spatial}
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
          <TileSet
            tiles={{
              id: image.service.id || image.service['@id'] || 'unknown',
              height: image.height as number,
              width: image.width as number,
              imageService: image.service as any,
              thumbnail: thumbnail && thumbnail.type === 'fixed' ? thumbnail : undefined,
            }}
            width={image.target?.spatial.width}
            height={image.target?.spatial.height}
            onClick={onClick}
            crop={crop}
          />
          {children}
        </Fragment>
      )}
    </world-object>
  );
}

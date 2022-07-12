import { ImageCandidate } from '@atlas-viewer/iiif-image-api';
import React, { Fragment, ReactNode } from 'react';
import { TileSet } from '@atlas-viewer/atlas';
import { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';

export function RenderImage({
  id,
  image,
  thumbnail,
  isStatic,
  x = 0,
  y = 0,
  annotations,
  children,
}: {
  id: string;
  image: ImageWithOptionalService;
  thumbnail?: ImageCandidate;
  isStatic?: boolean;
  x?: number;
  y?: number;
  annotations?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Fragment key={id}>
      {!image.service ? (
        <Fragment key="no-service">
          <world-image
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
          />
          {annotations}
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
            x={image.target?.spatial.x + x}
            y={image.target?.spatial.y + y}
            width={image.target?.spatial.width}
            height={image.target?.spatial.height}
          />
          {annotations}
          {children}
        </Fragment>
      )}
    </Fragment>
  );
}

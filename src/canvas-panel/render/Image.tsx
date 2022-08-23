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
  children,
  onClick,
}: {
  id: string;
  image: ImageWithOptionalService;
  thumbnail?: ImageCandidate;
  isStatic?: boolean;
  x?: number;
  y?: number;
  children?: ReactNode;
  onClick?: (e: any) => void;
}) {
  return (
    <Fragment key={id}>
      {!image.service ? (
        <Fragment key="no-service">
          <world-image
            onClick={onClick}
            // key={`${image.width}/${image.height}`}
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
          {children}
        </Fragment>
      ) : (
        <Fragment key="service">
          <TileSet
            // key={`${image.target.spatial?.width}/${image.target.spatial?.height}`}
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
            onClick={onClick}
          />
          {children}
        </Fragment>
      )}
    </Fragment>
  );
}

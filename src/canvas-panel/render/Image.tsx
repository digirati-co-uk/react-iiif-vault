import { ImageCandidate } from '@atlas-viewer/iiif-image-api';
import React, { Fragment } from 'react';
import { TileSet as _TileSet } from '@atlas-viewer/atlas';
import { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';

const TileSet = _TileSet as any; // bug with types :(

export function RenderImage({
  id,
  image,
  thumbnail,
  isStatic,
  x = 0,
  y = 0,
  annotations,
}: {
  id: string;
  image: ImageWithOptionalService;
  thumbnail?: ImageCandidate;
  isStatic?: boolean;
  x?: number;
  y?: number;
  annotations?: JSX.Element;
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
        </Fragment>
      ) : (
        <Fragment key="service">
          <TileSet
            viewport={isStatic}
            tiles={{
              id: image.service.id,
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
        </Fragment>
      )}
    </Fragment>
  );
}

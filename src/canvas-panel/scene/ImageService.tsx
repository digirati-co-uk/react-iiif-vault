import type { CompositeResourceProps } from '@atlas-viewer/atlas';
import { useScenePresentation, MissingPresentation } from './presentation';
import type { ImageOptions } from './types';
import type { ImageCandidate } from '@iiif/helpers/image-service';
import { getId } from '@iiif/parser/image-3';
import type { ImageService, InternationalString } from '@iiif/parser/presentation-3/types';
import { Auth, useIsAuthEnabled } from '../../context/AuthContext';
import { useImageServiceId } from '../../context/ImageServicesContext';
import type { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';

import { TileSet } from '../render/TileSet';

export interface ImageServiceProps extends ImageOptions {
  image: ImageWithOptionalService & { service: ImageService };
  enableSizes?: boolean;
  crop?: { x: number; y: number; width: number; height: number };
  thumbnail?: ImageCandidate;
  enableThumbnail?: boolean;
  renderOptions?: CompositeResourceProps;
  rotation?: number;
  manualRotation?: boolean;
}

export function RenderImageService({
  image,
  thumbnail,
  crop,
  enableSizes,
  enableThumbnail,
  renderOptions,
  rotation,
  manualRotation,
  ...options
}: ImageServiceProps) {
  const presentation = useScenePresentation();
  const AuthError = presentation.Auth || MissingAuth;
  const isEnabled = useIsAuthEnabled();

  const id = getId(image.service);
  const loadedImageService = useImageServiceId(id);
  const service = loadedImageService?.service;

  const isImageServiceLoaded = service && loadedImageService?.status === 'done';
  const format = options.format || ((service as any)?.preferredFormats || [])[0];

  const thumbnailToUse =
    thumbnail &&
    thumbnail.type === 'fixed' &&
    thumbnail.id &&
    !thumbnail.id.includes('/full/full/') &&
    !thumbnail.id.includes('/max/')
      ? thumbnail
      : undefined;

  if (isImageServiceLoaded === false) {
    // if (thumbnailToUse) {
    //   return (
    //     <world-image
    //       priority
    //       uri={thumbnailToUse.id}
    //       target={{ width: image.target?.spatial.width, height: image.target?.spatial.height }}
    //       display={{ width: thumbnailToUse.width, height: thumbnailToUse.height }}
    //       crop={crop}
    //     />
    //   );
    // }

    return null;
  }

  if (!isEnabled) {
    const service = image.service;
    const width: number = service.width || image.width || 0;
    const height: number = service.height || image.height || 0;
    let x = 0;
    let y = 0;

    let targetWidth = image.target?.spatial.width || width;
    let targetHeight = image.target?.spatial.height || height;
    const targetBoxWidth = targetWidth;
    const targetBoxHeight = targetHeight;

    if (rotation === 90 || rotation === 270) {
      [targetWidth, targetHeight] = [targetHeight, targetWidth];
      if (!manualRotation) {
        x = (targetBoxWidth - targetWidth) / 2;
        y = (targetBoxHeight - targetHeight) / 2;
      }
    }

    return (
      <TileSet
        {...options}
        enableThumbnail={enableThumbnail}
        renderOptions={renderOptions}
        rotation={rotation}
        tiles={{
          id: service.id || (service as any)['@id'] || 'unknown',
          height,
          width,
          imageService: service as any,
          thumbnail: thumbnailToUse,
        }}
        enableSizes={enableSizes}
        x={x}
        y={y}
        format={format}
        width={targetWidth}
        height={targetHeight}
        crop={crop}
      />
    );
  }

  return (
    <Auth key={image.id} resource={image.service} errorComponent={AuthError} extra={image}>
      {(service) => {
        const width: number = service.width || image.width || 0;
        const height: number = service.height || image.height || 0;
        let x = 0;
        let y = 0;

        let targetWidth = image.target?.spatial.width || width;
        let targetHeight = image.target?.spatial.height || height;
        const targetBoxWidth = targetWidth;
        const targetBoxHeight = targetHeight;

        if (rotation === 90 || rotation === 270) {
          [targetWidth, targetHeight] = [targetHeight, targetWidth];
          if (!manualRotation) {
            x = (targetBoxWidth - targetWidth) / 2;
            y = (targetBoxHeight - targetHeight) / 2;
          }
        }

        return (
          <TileSet
            {...options}
            enableThumbnail={enableThumbnail}
            renderOptions={renderOptions}
            tiles={{
              id: service.id || (service as any)['@id'] || 'unknown',
              height,
              width,
              imageService: service as any,
              thumbnail: thumbnailToUse,
            }}
            rotation={rotation}
            format={format}
            enableSizes={enableSizes}
            x={x}
            y={y}
            width={targetWidth}
            height={targetHeight}
            crop={crop}
          />
        );
      }}
    </Auth>
  );
}

function MissingAuth() {
  return <MissingPresentation reason="Authentication requires an Auth presentation" />;
}

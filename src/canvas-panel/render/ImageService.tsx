import { ImageCandidate } from '@atlas-viewer/iiif-image-api';
import { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
import { ImageService, InternationalString } from '@iiif/presentation-3';
import { CompositeResourceProps, HTMLPortal, TileSet } from '@atlas-viewer/atlas';
import { LocaleString } from '../../utility/i18n-utils';
import { Auth, useIsAuthEnabled } from '../../context/AuthContext';
import { canonicalServiceUrl } from '@iiif/parser/image-3';
import { useImageServiceLoader } from '../../context/ImageServiceLoaderContext';

interface ImageServiceProps {
  image: ImageWithOptionalService & { service: ImageService };
  enableSizes?: boolean;
  crop?: { x: number; y: number; width: number; height: number };
  thumbnail?: ImageCandidate;
  enableThumbnail?: boolean;
  renderOptions?: CompositeResourceProps;
}

function NotAuthorised({
  resource: service,
  heading,
  note,
  extra: image,
}: {
  resource: ImageService;
  heading?: InternationalString | null;
  note?: InternationalString | null;
  extra: ImageServiceProps['image'] | undefined;
}) {
  if (!image) {
    return null;
  }

  return (
    <HTMLPortal
      target={{
        x: 0,
        y: 0,
        width: image.target?.spatial.width,
        height: image.target?.spatial.height,
      }}
      backgroundColor="#333"
      relative
    >
      <div
        style={{
          display: 'flex',
          alignContent: 'center',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: '100%',
          background: '#444',
          color: '#BBB',
        }}
      >
        <div>
          <LocaleString>{heading || 'Not authorised'}</LocaleString>
          {note && (
            <p>
              <LocaleString>{note}</LocaleString>
            </p>
          )}
          <p>{service.id || (service as any)['@id'] || 'unknown'}</p>
        </div>
      </div>
    </HTMLPortal>
  );
}

export function RenderImageService({
  image,
  thumbnail,
  crop,
  enableSizes,
  enableThumbnail,
  renderOptions,
}: ImageServiceProps) {
  const isEnabled = useIsAuthEnabled();
  const loader = useImageServiceLoader();
  const serviceId = image.service ? canonicalServiceUrl(image.service.id || image.service['@id'] || '') : undefined;
  const isImageServiceLoaded = serviceId ? Boolean(loader.imageServices[serviceId]) : undefined;

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
    return (
      <TileSet
        enableThumbnail={enableThumbnail}
        renderOptions={renderOptions}
        tiles={{
          id: service.id || (service as any)['@id'] || 'unknown',
          height,
          width,
          imageService: service as any,
          thumbnail: thumbnailToUse,
        }}
        enableSizes={enableSizes}
        x={0}
        y={0}
        width={image.target?.spatial.width}
        height={image.target?.spatial.height}
        crop={crop}
      />
    );
  }

  return (
    <Auth key={image.id} resource={image.service} errorComponent={NotAuthorised} extra={image}>
      {(service) => {
        const width: number = service.width || image.width || 0;
        const height: number = service.height || image.height || 0;
        return (
          <TileSet
            enableThumbnail={enableThumbnail}
            renderOptions={renderOptions}
            tiles={{
              id: service.id || (service as any)['@id'] || 'unknown',
              height,
              width,
              imageService: service as any,
              thumbnail: thumbnailToUse,
            }}
            enableSizes={enableSizes}
            x={0}
            y={0}
            width={image.target?.spatial.width}
            height={image.target?.spatial.height}
            crop={crop}
          />
        );
      }}
    </Auth>
  );
}

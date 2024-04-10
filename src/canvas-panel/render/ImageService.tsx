import { ImageCandidate } from '@atlas-viewer/iiif-image-api';
import { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
import { ImageService, InternationalString } from '@iiif/presentation-3';
import { HTMLPortal, TileSet } from '@atlas-viewer/atlas';
import { LocaleString } from '../../utility/i18n-utils';
import { Auth } from '../../context/AuthContext';

interface ImageServiceProps {
  image: ImageWithOptionalService & { service: ImageService };
  enableSizes?: boolean;
  crop?: { x: number; y: number; width: number; height: number };
  thumbnail?: ImageCandidate;
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

export function RenderImageService({ image, thumbnail, crop, enableSizes }: ImageServiceProps) {
  return (
    <Auth key={image.id} resource={image.service} errorComponent={NotAuthorised} extra={image}>
      {(service) => {
        const width: number = service.width || image.width || 0;
        const height: number = service.height || image.height || 0;
        return (
          <TileSet
            tiles={{
              id: service.id || (service as any)['@id'] || 'unknown',
              height,
              width,
              imageService: service as any,
              // Ignore thumbnail for now.
              // thumbnail: thumbnail && thumbnail.type === 'fixed' ? thumbnail : undefined,
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

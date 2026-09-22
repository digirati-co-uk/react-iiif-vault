import { HTMLPortal } from '@atlas-viewer/atlas';
import type { ImageService, InternationalString } from '@iiif/parser/presentation-3/types';
import { LocaleString } from '../../utility/i18n-utils';
import { RenderImageService as SceneImageService, type ImageServiceProps } from '../scene/ImageService';
import { ScenePresentationProvider } from '../scene/presentation';
export function NotAuthorised({
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


export function RenderImageService(props: ImageServiceProps) {
  return <ScenePresentationProvider presentation={{ Auth: NotAuthorised }}><SceneImageService {...props} /></ScenePresentationProvider>;
}

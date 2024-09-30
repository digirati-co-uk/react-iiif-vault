import { AtlasAuto, type AtlasProps, type Preset } from '@atlas-viewer/atlas';
import type React from 'react';
import { type ReactNode, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Viewer } from '../canvas-panel/Viewer';
import { useOverlay } from '../canvas-panel/context/overlays';
import { DefaultCanvasFallback } from '../canvas-panel/render/DefaultCanvasFallback';
import { RenderImage } from '../canvas-panel/render/Image';
import { ViewerPresetContext } from '../context/ViewerPresetContext';
import type { SingleImageStrategy } from '../features/rendering-strategy/image-strategy';
import type { ImageWithOptionalService } from '../features/rendering-strategy/resource-types';
import type { EmptyStrategy } from '../features/rendering-strategy/strategies';
import { useLoadImageService } from '../hooks/useLoadImageService';

interface ImageServiceProps {
  src: string;
  atlas?: AtlasProps;
  errorFallback?: React.FC;
  interactive?: boolean;
  skipSizes?: boolean;
  renderViewerControls?: (strategy: SingleImageStrategy | EmptyStrategy) => ReactNode;
  viewControlsDeps?: any[];
  fluid?: boolean;
  // disableThumbnail?: boolean;
  x?: number;
  y?: number;
  // rotation?: number;
  children?: React.ReactNode;
}

export function ImageService({
  src,
  errorFallback,
  interactive,
  skipSizes,
  children,
  renderViewerControls,
  viewControlsDeps,
  fluid,
  // disableThumbnail,
  x,
  y,
  // rotation,
  ...atlasProps
}: ImageServiceProps & Omit<AtlasProps, 'children'>) {
  const [viewerPreset, setViewerPreset] = useState<Preset | null>();
  const ErrorFallback = errorFallback || DefaultCanvasFallback;
  const [loadImageService, status] = useLoadImageService();
  const image = useMemo(() => {
    const statusOf = status[src];
    const service = loadImageService({ id: src }, {} as any);

    if (service?.height && service.width && statusOf !== 'loading') {
      return {
        id: src,
        width: service.width,
        height: service.height,
        service,
        type: 'Image',
        selector: {
          type: 'BoxSelector',
          spatial: {
            x: 0,
            y: 0,
            width: service.width,
            height: service.height,
          },
        },
        target: {
          type: 'BoxSelector',
          spatial: {
            x: 0,
            y: 0,
            width: service.width,
            height: service.height,
          },
        },
      } as ImageWithOptionalService;
    }

    return null;
  }, [loadImageService, src, status]);

  useOverlay(
    viewerPreset && renderViewerControls ? 'overlay' : 'none',
    `canvas-portal-controls-${src}`,
    ViewerPresetContext.Provider,
    renderViewerControls && image
      ? {
          value: viewerPreset || null,
          children: renderViewerControls({ image, images: [image], type: 'images' }),
        }
      : {},
    [src, viewerPreset, ...(viewControlsDeps || [])]
  );

  if (!image || !image.height || !image.width) {
    return null;
  }

  const aspectRatio = fluid
    ? undefined
    : atlasProps.homePosition
      ? atlasProps.homePosition.width / atlasProps.homePosition.height
      : image.width / image.height;

  return (
    <ErrorBoundary
      resetKeys={[]}
      fallbackRender={(fallbackProps) => <ErrorFallback {...atlasProps} {...fallbackProps} />}
    >
      <Viewer
        {...(atlasProps as any)}
        aspectRatio={aspectRatio}
        containerProps={{ style: { position: 'relative' }, ...(atlasProps.containerProps || {}) }}
        onCreated={(preset) => {
          setViewerPreset(preset);
          if (atlasProps.onCreated) {
            atlasProps.onCreated(preset);
          }
        }}
      >
        <ViewerPresetContext.Provider value={viewerPreset}>
          <RenderImage
            key={image.id}
            image={image}
            id={image.id}
            isStatic={!interactive}
            // virtualSizes={virtualSizes}
            // skipThumbnail={disableThumbnail}
            x={x}
            y={y}
            // rotation={rotation}
            // tileFormat={tileFormat}
          />
          <RenderControls
            viewerPreset={viewerPreset}
            renderViewerControls={renderViewerControls}
            image={image}
            src={src}
            viewControlsDeps={viewControlsDeps}
          />
          {children}
        </ViewerPresetContext.Provider>
      </Viewer>
    </ErrorBoundary>
  );
}

function RenderControls({
  viewerPreset,
  renderViewerControls,
  image,
  src,
  viewControlsDeps,
}: {
  viewerPreset?: Preset | null;
  renderViewerControls?: (strategy: SingleImageStrategy | EmptyStrategy) => ReactNode;
  image?: ImageWithOptionalService;
  src: string;
  viewControlsDeps?: any[];
}) {
  useOverlay(
    viewerPreset && renderViewerControls ? 'overlay' : 'none',
    `canvas-portal-controls-${src}`,
    ViewerPresetContext.Provider,
    renderViewerControls && image
      ? {
          value: viewerPreset || null,
          children: renderViewerControls({ image, images: [image], type: 'images' }),
        }
      : {},
    [src, viewerPreset, ...(viewControlsDeps || [])]
  );

  return null;
}

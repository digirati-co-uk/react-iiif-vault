import type { BoxSelector, ImageCandidate } from '@iiif/helpers';
import React, { Fragment, type ReactNode, useMemo, useContext } from 'react';
import type { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
import { useSmoothedRotation } from '../../hooks/useSmoothedRotation';
import { useScenePresentation, MissingPresentation } from './presentation';
import { useResourceEvents } from '../../hooks/useResourceEvents';
import { useStyles } from '../../hooks/useStyles';
import type { ImageOptions } from './types';
import { StrategyReactContext } from '../../context/StrategyContext';
import { ReactVaultContext } from '../../context/VaultContext';
import { RenderImageService } from './ImageService';

function ImageContent({
  id,
  image,
  thumbnail,
  isStatic,
  x = 0,
  y = 0,
  children,
  selector,
  onClick,
  rotation: _rotation,
  enableSizes,
  enableAnnotations,
  events,
  ...options
}: ImageOptions & {
  events?: Record<string, unknown>;
  id: string;
  image: ImageWithOptionalService;
  thumbnail?: ImageCandidate;
  isStatic?: boolean;
  enableSizes?: boolean;
  enableAnnotations?: boolean;
  selector?: BoxSelector;
  x?: number;
  y?: number;
  children?: ReactNode;
  onClick?: (e: any) => void;
  rotation?: number;
}) {
  const presentation = useScenePresentation();
  const style = { ...image.style, ...options.style };
  const crop = useMemo(() => {
    if (!selector) {
      return undefined;
    }
    return selector.spatial;
  }, [selector]);

  const rotation = useMemo(() => {
    if (typeof image.rotation !== 'undefined') {
      return image.rotation;
    }
    if (!image.annotation) {
      return 0;
    }
    const body: any = Array.isArray(image.annotation.body) ? image.annotation.body?.[0] : image.annotation.body;
    if (body) {
      if (body.selector?.type === 'ImageApiSelector') {
        return Number(body.selector.rotation);
      }
    }
  }, [image]);

  const smoothedRotation = useSmoothedRotation(_rotation);

  const hasImageService = !!image.service;
  let targetX = x + image.target.spatial.x;
  let targetY = y + image.target.spatial.y;

  let targetWidth = image.target.spatial.width;
  let targetHeight = image.target.spatial.height;

  let imageWidth = image.target.spatial.width;
  let imageHeight = image.target.spatial.height;

  if (rotation === 90 || rotation === 270) {
    [imageWidth, imageHeight] = [imageHeight, imageWidth];

    if (!hasImageService) {
      [targetWidth, targetHeight] = [targetHeight, targetWidth];
      targetX += (image.target.spatial.width - targetWidth) / 2;
      targetY += (image.target.spatial.height - targetHeight) / 2;
    }
  }

  return (
    <world-object
      key={id + (hasImageService ? 'server' : 'no-service')}
      x={targetX}
      y={targetY}
      width={targetWidth}
      height={targetHeight}
      onClick={onClick}
      {...events}
      rotation={!image.service ? (typeof smoothedRotation !== 'undefined' ? smoothedRotation : rotation) : undefined}
    >
      {!image.service ? (
        <Fragment key="no-service">
          <world-image
            {...{ style }}
            onClick={onClick}
            uri={image.id}
            target={{ x: 0, y: 0, width: imageWidth, height: imageHeight }}
            display={
              imageWidth && imageHeight
                ? {
                    width: imageWidth,
                    height: imageHeight,
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
            {...options}
            isStatic={isStatic}
            {...{ style }}
            image={image as any}
            thumbnail={thumbnail}
            crop={crop}
            enableSizes={enableSizes}
            rotation={typeof smoothedRotation !== 'undefined' ? smoothedRotation : rotation}
            manualRotation={typeof _rotation !== 'undefined'}
          />
          {children}
        </Fragment>
      )}

      {enableAnnotations && image.annotationPages
        ? image.annotationPages.map((page) =>
            presentation.AnnotationPage ? (
              <presentation.AnnotationPage key={page.id} page={page} />
            ) : (
              <MissingPresentation key={page.id} reason="Image annotations require an AnnotationPage presentation" />
            )
          )
        : null}
    </world-object>
  );
}

export type RenderImageProps = React.ComponentProps<typeof ImageContent>;
export function RenderImage(props: RenderImageProps) {
  const { vault } = useContext(ReactVaultContext);
  return vault ? <StyledImage {...props} /> : <ImageContent {...props} />;
}
function StyledImage(props: RenderImageProps) {
  const { image } = props;
  const strategy = useContext(StrategyReactContext);
  const annotationStyle = useStyles(image.annotation, 'atlas');
  const resourceStyle = useStyles({ id: image.id, type: 'ContentResource' }, 'atlas');
  const annotationEvents = useResourceEvents(image.annotation, ['atlas']);
  const resourceEvents = useResourceEvents({ id: image.id, type: 'ContentResource' }, ['atlas']);
  return (
    <ImageContent
      {...props}
      style={{
        ...annotationStyle,
        ...resourceStyle,
        ...strategy?.imageStyles?.[image.annotationId],
        ...strategy?.imageStyles?.[image.id],
        ...props.style,
      }}
      events={{ ...annotationEvents, ...resourceEvents, ...props.events }}
    />
  );
}

import { createStylesHelper } from '@iiif/vault-helpers/styles';
import { RenderImage } from './Image';
import React, { Fragment, ReactNode, useEffect, useLayoutEffect, useMemo } from 'react';
import { BoxStyle, HTMLPortal } from '@atlas-viewer/atlas';
import { useVirtualAnnotationPageContext } from '../../hooks/useVirtualAnnotationPageContext';
import { StrategyActions, useRenderingStrategy } from '../../hooks/useRenderingStrategy';
import { useVault } from '../../hooks/useVault';
import { useResourceEvents } from '../../hooks/useResourceEvents';
import { useThumbnail } from '../../hooks/useThumbnail';
import { useCanvas } from '../../hooks/useCanvas';
import { RenderAnnotationPage } from './AnnotationPage';
import { Audio } from './Audio';
import { EmptyStrategy, MediaStrategy, RenderingStrategy } from '../../features/rendering-strategy/strategies';
import { Video } from './Video';
import { Model } from './Model';
import { CanvasContext } from '../../context/CanvasContext';
import { SingleImageStrategy } from '../../features/rendering-strategy/image-strategy';
import { CanvasBackground } from './CanvasBackground';
import { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
import { LocaleString } from '@iiif/vault-helpers/react-i18next';
import { useOverlay } from '../context/overlays';
import { useViewerPreset, ViewerPresetContext } from '../../context/ViewerPresetContext';
import { ChoiceDescription } from '@iiif/vault-helpers';
import { useWorldSize } from '../context/world-size';
import { VideoYouTube } from './VideoYouTube';

type CanvasProps = {
  x?: number;
  y?: number;
  onCreated?: any;
  onChoiceChange?: (choice?: ChoiceDescription) => void;
  registerActions?: (actions: StrategyActions) => void;
  defaultChoices?: Array<{ id: string; opacity?: number }>;
  isStatic?: boolean;
  keepCanvasScale?: boolean;
  children?: ReactNode;
  renderViewerControls?: (strategy: SingleImageStrategy | EmptyStrategy) => ReactNode;
  viewControlsDeps?: any[];
  renderMediaControls?: (strategy: MediaStrategy) => ReactNode;
  mediaControlsDeps?: any[];
  strategies?: Array<RenderingStrategy['type']>;
  backgroundStyle?: BoxStyle;
  alwaysShowBackground?: boolean;
  enableSizes?: boolean;
  enableYouTube?: boolean;
  ignoreSize?: boolean;
  throwOnUnknown?: boolean;
  onClickPaintingAnnotation?: (id: string, image: ImageWithOptionalService, e: any) => void;
};

export function RenderCanvas({
  x,
  y,
  onChoiceChange,
  registerActions,
  defaultChoices,
  isStatic,
  renderViewerControls,
  renderMediaControls,
  viewControlsDeps,
  mediaControlsDeps,
  strategies,
  throwOnUnknown,
  backgroundStyle,
  alwaysShowBackground,
  keepCanvasScale = false,
  enableSizes = false,
  enableYouTube = true,
  onClickPaintingAnnotation,
  children,
}: CanvasProps) {
  const canvas = useCanvas();
  const elementProps = useResourceEvents(canvas, ['deep-zoom']);
  const [virtualPage] = useVirtualAnnotationPageContext();
  const preset = useViewerPreset();
  const vault = useVault();
  const helper = useMemo(() => createStylesHelper(vault), [vault]);
  const [strategy, actions] = useRenderingStrategy({
    strategies: strategies || ['images'],
    defaultChoices: defaultChoices?.map(({ id }) => id),
  });
  const choice = strategy.type === 'images' ? strategy.choice : undefined;
  const bestScale = useMemo(() => {
    if (keepCanvasScale) {
      return 1;
    }
    return Math.max(
      1,
      ...(strategy.type === 'images'
        ? strategy.images.map((i) => {
            return (i.width || 0) / i.target?.spatial.width;
          })
        : [])
    );
  }, [keepCanvasScale, strategy]);

  useWorldSize(bestScale);

  useEffect(() => {
    if (registerActions) {
      registerActions(actions);
    }
  }, [strategy.annotations]);

  useEffect(() => {
    if (defaultChoices) {
      for (const choice of defaultChoices) {
        if (typeof choice.opacity !== 'undefined') {
          helper.applyStyles({ id: choice.id }, 'atlas', {
            opacity: choice.opacity,
          });
        }
      }
    }
  }, [defaultChoices]);

  useLayoutEffect(() => {
    if (onChoiceChange) {
      onChoiceChange(choice);
    }
  }, [choice]);

  useOverlay(
    preset &&
      (strategy.type === 'images' ||
        strategy.type === 'empty' ||
        (strategy.type === 'textual-content' && renderViewerControls))
      ? 'overlay'
      : 'none',
    `canvas-portal-controls-${canvas?.id}`,
    ViewerPresetContext.Provider,
    renderViewerControls
      ? {
          value: preset || null,
          children: renderViewerControls(strategy as any),
        }
      : {},
    [canvas, preset, strategy, ...(viewControlsDeps || [])]
  );

  const thumbnail = useThumbnail({ maxWidth: 256, maxHeight: 256 });

  if (!canvas) {
    return null;
  }

  // accompanyingCanvas
  const accompanyingCanvas = canvas.accompanyingCanvas;

  const thumbnailFallbackImage =
    thumbnail && thumbnail.type === 'fixed' ? (
      <world-object height={canvas.height} width={canvas.width} x={x} y={y}>
        <world-image
          uri={thumbnail.id}
          target={{ x: 0, y: 0, width: canvas.width, height: canvas.height }}
          display={
            thumbnail.width && thumbnail.height
              ? {
                  width: thumbnail.width,
                  height: thumbnail.height,
                }
              : undefined
          }
          crop={undefined}
        />
      </world-object>
    ) : null;

  if (strategy.type === 'unknown') {
    if (thumbnailFallbackImage) {
      return thumbnailFallbackImage;
    }

    if (throwOnUnknown) {
      throw new Error(strategy.reason || 'Unknown image strategy');
    }

    return null;
  }

  const annotations = (
    <Fragment>
      {virtualPage ? <RenderAnnotationPage page={virtualPage} /> : null}
      {strategy.annotations && strategy.annotations.pages
        ? strategy.annotations.pages.map((page) => {
            return <RenderAnnotationPage key={page.id} page={page} />;
          })
        : null}
      {children}
    </Fragment>
  );

  return (
    <>
      <world-object
        key={`${canvas.id}/${strategy.type}`}
        height={canvas.height}
        width={canvas.width}
        // scale={bestScale}
        x={x}
        y={y}
        {...elementProps}
      >
        {strategy.type === 'empty' || alwaysShowBackground ? <CanvasBackground style={backgroundStyle} /> : null}
        {strategy.type === 'textual-content'
          ? strategy.items.map((item, n) => {
              return (
                <>
                  <HTMLPortal
                    key={n}
                    // @ts-ignore
                    onClick={
                      onClickPaintingAnnotation
                        ? (e: any) => {
                            e.stopPropagation();
                            onClickPaintingAnnotation(item.annotationId, item as any, e);
                          }
                        : undefined
                    }
                    target={(item.target as any)?.spatial || undefined}
                  >
                    <div data-textual-content={true}>
                      <LocaleString enableDangerouslySetInnerHTML>{item.text}</LocaleString>
                    </div>
                  </HTMLPortal>
                  {annotations}
                </>
              );
            })
          : null}
        {strategy.type === 'images' ? (
          <>
            {strategy.images.map((image, idx) => (
              <RenderImage
                isStatic={isStatic}
                key={image.id}
                image={image}
                id={image.id}
                thumbnail={idx === 0 ? thumbnail : undefined}
                selector={image.selector}
                enableSizes={enableSizes}
                onClick={
                  onClickPaintingAnnotation
                    ? (e) => {
                        e.stopPropagation();
                        onClickPaintingAnnotation(image.annotationId, image, e);
                      }
                    : undefined
                }
              />
            ))}
            {annotations}
          </>
        ) : null}
        {strategy.type === '3d-model' ? <Model model={strategy.model} /> : null}
        {strategy.type === 'media' ? (
          <>
            {strategy.media.type === 'Sound' ? (
              <Audio media={strategy.media} mediaControlsDeps={mediaControlsDeps}>
                {thumbnailFallbackImage}
                {renderMediaControls ? renderMediaControls(strategy) : null}
              </Audio>
            ) : strategy.media.type === 'Video' ? (
              <Video media={strategy.media} mediaControlsDeps={mediaControlsDeps}>
                {thumbnailFallbackImage}
                {renderMediaControls ? renderMediaControls(strategy) : null}
              </Video>
            ) : strategy.media.type === 'VideoYouTube' && enableYouTube ? (
              <VideoYouTube media={strategy.media} mediaControlsDeps={mediaControlsDeps}>
                {thumbnailFallbackImage}
                {renderMediaControls ? renderMediaControls(strategy) : null}
              </VideoYouTube>
            ) : null}
          </>
        ) : null}
        {/* This is required to fix a race condition. */}
      </world-object>
      {strategy.type === 'media' && strategy.media.type === 'Sound' && accompanyingCanvas ? (
        <CanvasContext canvas={accompanyingCanvas.id}>
          <RenderCanvas renderViewerControls={renderViewerControls} />
        </CanvasContext>
      ) : null}
    </>
  );
}

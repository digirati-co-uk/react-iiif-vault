import { createStylesHelper } from '@iiif/vault-helpers';
import { RenderImage } from './Image';
import React, { Fragment, ReactNode, useEffect, useLayoutEffect, useMemo } from 'react';
import { useVirtualAnnotationPageContext } from '../../hooks/useVirtualAnnotationPageContext';
import { ChoiceDescription } from '../../features/rendering-strategy/choice-types';
import { StrategyActions, useRenderingStrategy } from '../../hooks/useRenderingStrategy';
import { useVault } from '../../hooks/useVault';
import { useResourceEvents } from '../../hooks/useResourceEvents';
import { useThumbnail } from '../../hooks/useThumbnail';
import { useCanvas } from '../../hooks/useCanvas';
import { RenderAnnotationPage } from './AnnotationPage';
import { Audio } from './Audio';
import { MediaStrategy } from '../../features/rendering-strategy/strategies';
import { Video } from './Video';

type CanvasProps = {
  x?: number;
  y?: number;
  onCreated?: any;
  onChoiceChange?: (choice?: ChoiceDescription) => void;
  registerActions?: (actions: StrategyActions) => void;
  defaultChoices?: Array<{ id: string; opacity?: number }>;
  isStatic?: boolean;
  renderMediaControls?: (strategy: MediaStrategy) => ReactNode;
};

export function RenderCanvas({
  x,
  y,
  onChoiceChange,
  registerActions,
  defaultChoices,
  isStatic,
  renderMediaControls,
}: CanvasProps) {
  const canvas = useCanvas();
  const elementProps = useResourceEvents(canvas, ['deep-zoom']);
  const [virtualPage] = useVirtualAnnotationPageContext();
  const vault = useVault();
  const helper = useMemo(() => createStylesHelper(vault), [vault]);
  const [strategy, actions] = useRenderingStrategy({
    strategies: ['images', 'media'],
    defaultChoices: defaultChoices?.map(({ id }) => id),
  });
  const choice = strategy.type === 'images' ? strategy.choice : undefined;

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

  const thumbnail = useThumbnail({ maxWidth: 256, maxHeight: 256 });

  if (!canvas) {
    return null;
  }

  if (strategy.type === 'unknown') {
    if (thumbnail && thumbnail.type === 'fixed') {
      return (
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
          />
        </world-object>
      );
    }

    throw new Error(strategy.reason || 'Unknown image strategy');
  }

  const annotations = (
    <Fragment>
      {virtualPage ? <RenderAnnotationPage page={virtualPage} /> : null}
      {strategy.annotations && strategy.annotations.pages
        ? strategy.annotations.pages.map((page) => {
            return <RenderAnnotationPage key={page.id} page={page} />;
          })
        : null}
    </Fragment>
  );

  return (
    <world-object key={strategy.type} height={canvas.height} width={canvas.width} x={x} y={y} {...elementProps}>
      {strategy.type === 'images'
        ? strategy.images.map((image, idx) => {
            return (
              <RenderImage
                isStatic={isStatic}
                key={image.id}
                image={image}
                id={image.id}
                thumbnail={idx === 0 ? thumbnail : undefined}
                annotations={annotations}
              />
            );
          })
        : null}
      {strategy.type === 'media' ? (
        //
        strategy.media.type === 'Sound' ? (
          <Audio media={strategy.media}>{renderMediaControls ? renderMediaControls(strategy) : null}</Audio>
        ) : strategy.media.type === 'Video' ? (
          <Video media={strategy.media}>{renderMediaControls ? renderMediaControls(strategy) : null}</Video>
        ) : null
      ) : null}
      {/* This is required to fix a race condition. */}
    </world-object>
  );
}

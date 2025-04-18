import React, { ReactNode } from 'react';
import { BoxStyle } from '@atlas-viewer/atlas';
import { StrategyActions } from '../../hooks/useRenderingStrategy';
import { AudioComponentProps } from './Audio';
import {
  ComplexTimelineStrategy,
  EmptyStrategy,
  MediaStrategy,
  RenderingStrategy,
} from '../../features/rendering-strategy/strategies';
import { VideoComponentProps } from './Video';
import { SingleImageStrategy } from '../../features/rendering-strategy/image-strategy';
import { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
import { ChoiceDescription } from '@iiif/helpers';
import { CanvasStrategyProvider } from './CanvasStrategyProvider';
import { CanvasWorldObject } from './CanvasWorldObject';
import { RenderEmptyStrategy } from '../strategy/EmptyStrategy';
import { RenderComplexTimelineStrategy } from '../strategy/ComplexTimelineStrategy';
import { RenderTextualContentStrategy } from '../strategy/TextualContentStrategy';
import { RenderImageStrategy } from '../strategy/ImageStrategy';
import { Render3DModelStrategy } from '../strategy/3dModelStrategy';
import { RenderAnnotationStrategy } from '../strategy/AnnotationStrategy';
import { RenderAudioStrategy } from '../strategy/AudioStrategy';
import { RenderAccompanyingCanvas } from '../strategy/AccompanyingCanvas';
import { RenderVideoStrategy } from '../strategy/VideoStrategy';
import { RenderYouTubeStrategy } from '../strategy/YouTubeStrategy';

export type CanvasProps = {
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
  renderComplexTimelineControls?: (strategy: ComplexTimelineStrategy) => ReactNode;
  complexTimelineControlsDeps?: any[];
  mediaControlsDeps?: any[];
  strategies?: Array<RenderingStrategy['type']>;
  backgroundStyle?: BoxStyle;
  alwaysShowBackground?: boolean;
  enableSizes?: boolean;
  enableYouTube?: boolean;
  ignoreSize?: boolean;
  throwOnUnknown?: boolean;
  onClickPaintingAnnotation?: (id: string, image: ImageWithOptionalService, e: any) => void;
  components?: {
    Video?: React.ComponentType<VideoComponentProps>;
    Audio?: React.ComponentType<AudioComponentProps>;
  };
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
  renderComplexTimelineControls,
  complexTimelineControlsDeps,
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
  components = {},
  children,
}: CanvasProps) {
  return (
    <CanvasStrategyProvider
      throwOnUnknown={throwOnUnknown}
      onChoiceChange={onChoiceChange}
      registerActions={registerActions}
      strategies={strategies}
      defaultChoices={defaultChoices}
      mediaControlsDeps={mediaControlsDeps}
      renderMediaControls={renderMediaControls}
      renderViewerControls={renderViewerControls}
      renderComplexTimelineControls={renderComplexTimelineControls}
      complexTimelineControlsDeps={complexTimelineControlsDeps}
      viewControlsDeps={viewControlsDeps}
    >
      <CanvasWorldObject keepCanvasScale={keepCanvasScale} x={x} y={y}>
        <RenderEmptyStrategy alwaysShowBackground={alwaysShowBackground} backgroundStyle={backgroundStyle} />
        <RenderComplexTimelineStrategy />
        <RenderTextualContentStrategy />
        <RenderImageStrategy
          isStatic={isStatic}
          enableSizes={enableSizes}
          onClickPaintingAnnotation={onClickPaintingAnnotation}
        />
        <RenderAnnotationStrategy />
        <Render3DModelStrategy />
        <RenderAudioStrategy as={components.Audio} />
        <RenderVideoStrategy as={components.Video} />
        {enableYouTube ? <RenderYouTubeStrategy /> : null}
        {children}
      </CanvasWorldObject>
      <RenderAccompanyingCanvas />
    </CanvasStrategyProvider>
  );
}

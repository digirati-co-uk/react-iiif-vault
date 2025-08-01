import type { BoxStyle } from '@atlas-viewer/atlas';
import type { ChoiceDescription } from '@iiif/helpers';
import type React from 'react';
import { type ReactNode, useEffect } from 'react';
import { useStore } from 'zustand';
import type { SingleImageStrategy } from '../../features/rendering-strategy/image-strategy';
import type { ImageWithOptionalService } from '../../features/rendering-strategy/resource-types';
import type {
  ComplexTimelineStrategy,
  EmptyStrategy,
  MediaStrategy,
  RenderingStrategy,
} from '../../features/rendering-strategy/strategies';
import type { StrategyActions } from '../../hooks/useRenderingStrategy';
import type { SVGTheme } from '../../hooks/useSvgEditor';
import { useAtlasStore } from '../context/atlas-store-provider';
import { Render3DModelStrategy } from '../strategy/3dModelStrategy';
import { RenderAccompanyingCanvas } from '../strategy/AccompanyingCanvas';
import { RenderAnnotationStrategy } from '../strategy/AnnotationStrategy';
import { RenderAudioStrategy } from '../strategy/AudioStrategy';
import { RenderComplexTimelineStrategy } from '../strategy/ComplexTimelineStrategy';
import { RenderEmptyStrategy } from '../strategy/EmptyStrategy';
import { RenderImageStrategy } from '../strategy/ImageStrategy';
import { RenderTextualContentStrategy } from '../strategy/TextualContentStrategy';
import { RenderVideoStrategy } from '../strategy/VideoStrategy';
import { RenderYouTubeStrategy } from '../strategy/YouTubeStrategy';
import { RenderAnnotationEditing } from './AnnotationEditing';
import type { AudioComponentProps } from './Audio';
import { CanvasStrategyProvider } from './CanvasStrategyProvider';
import { CanvasWorldObject } from './CanvasWorldObject';
import type { VideoComponentProps } from './Video';

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
  renderContextMenu?: (options: { canvasId?: string; position: { x: number; y: number } }) => ReactNode;
  onClickPaintingAnnotation?: (id: string, image: ImageWithOptionalService, e: any) => void;
  components?: {
    Video?: React.ComponentType<VideoComponentProps>;
    Audio?: React.ComponentType<AudioComponentProps>;
  };
  annotationPopup?: React.ReactNode;
  svgTheme?: Partial<SVGTheme>;
  renderAnnotationContextMenu?: (options: { canvasId?: string; position: { x: number; y: number } }) => React.ReactNode;
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
  annotationPopup,
  svgTheme,
  renderContextMenu,
  renderAnnotationContextMenu,
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
      <CanvasWorldObject keepCanvasScale={keepCanvasScale} x={x} y={y} renderContextMenu={renderContextMenu}>
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
        <RenderAnnotationEditing theme={svgTheme} renderContextMenu={renderAnnotationContextMenu}>
          {annotationPopup}
        </RenderAnnotationEditing>
        {children}
      </CanvasWorldObject>
      <RenderAccompanyingCanvas />
    </CanvasStrategyProvider>
  );
}

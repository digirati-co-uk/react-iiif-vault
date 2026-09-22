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
import type { RenderContextProps } from '../../hooks/useAtlasContextMenu';
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

export type CanvasProps = import('../scene/types').ImageOptions & {
  x?: number;
  y?: number;
  onCreated?: any;
  onChoiceChange?: (choice?: ChoiceDescription) => void;
  registerActions?: (actions: StrategyActions) => void;
  emitter?: import("../../hooks/useRenderingStrategy").UseRenderingStrategyOptions["emitter"];
  annotationPageManagerId?: string;
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
  renderContextMenu?: (options: RenderContextProps) => ReactNode;
  onClickPaintingAnnotation?: (id: string, image: ImageWithOptionalService, e: any) => void;
  components?: {
    Video?: React.ComponentType<VideoComponentProps>;
    Audio?: React.ComponentType<AudioComponentProps>;
  };
  rotation?: number;
  annotationPopup?: React.ReactNode;
  svgTheme?: Partial<SVGTheme>;
  renderAnnotationContextMenu?: (options: RenderContextProps) => React.ReactNode;
};

export function RenderCanvas({
  x,
  y,
  onChoiceChange,
  registerActions,
  emitter,
  annotationPageManagerId,
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
  rotation,
  backgroundStyle,
  alwaysShowBackground,
  keepCanvasScale = false,
  enableSizes = false,
  enableThumbnail,
  imageCandidates,
  format,
  useFloorCalc,
  renderOptions,
  style,
  enableYouTube = true,
  onClickPaintingAnnotation,
  components = {},
  children,
  annotationPopup,
  svgTheme,
  renderContextMenu,
  renderAnnotationContextMenu,
}: CanvasProps) {
  const imageOptions = { isStatic, enableSizes, enableThumbnail, imageCandidates, format, useFloorCalc, renderOptions, style };
  return (
    <CanvasStrategyProvider
      throwOnUnknown={throwOnUnknown}
      onChoiceChange={onChoiceChange}
      registerActions={registerActions}
      emitter={emitter}
      annotationPageManagerId={annotationPageManagerId}
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
        <RenderComplexTimelineStrategy imageOptions={imageOptions} />
        <RenderTextualContentStrategy />
        <RenderImageStrategy
          {...imageOptions}
          onClickPaintingAnnotation={onClickPaintingAnnotation}
          rotation={rotation}
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

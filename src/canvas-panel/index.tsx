import type { ViewerMode } from '@atlas-viewer/atlas';
import {
  type FC,
  type ForwardRefExoticComponent,
  forwardRef,
  type ReactNode,
  type RefAttributes,
  useImperativeHandle,
  useMemo,
} from 'react';
import { CanvasContext } from '../context/CanvasContext';
import { VaultProvider } from '../context/VaultContext';
import { useVisibleCanvases } from '../context/VisibleCanvasContext';
import type { RenderContextProps } from '../hooks/useAtlasContextMenu';
import { useExistingVault } from '../hooks/useExistingVault';
import { useManifest } from '../hooks/useManifest';
import type { SVGTheme } from '../hooks/useSvgEditor';
import { SimpleViewerProvider, useSimpleViewer } from '../viewers/SimpleViewerContext';
import type { SimpleViewerContext } from '../viewers/SimpleViewerContext.types';
import { AtlasStoreProvider, getAtlasStoreByName } from './context/atlas-store-provider';
import { RenderAnnotation } from './render/Annotation';
import { RenderAnnotationPage } from './render/AnnotationPage';
import { Audio, AudioHTML } from './render/Audio';
import { type CanvasProps, RenderCanvas } from './render/Canvas';
import { CanvasBackground } from './render/CanvasBackground';
import { RenderImage } from './render/Image';
import { Model, ModelHTML } from './render/Model';
import { PlaceholderCanvas } from './render/PlaceholderCanvas';
import { Video, VideoHTML } from './render/Video';
import { Viewer } from './Viewer';

export interface CanvasPanelProps {
  manifest: string;
  startCanvas?: string;
  rangeId?: string;
  pagingEnabled?: boolean;
  header?: ReactNode;
  children?: ReactNode;
  mode?: ViewerMode;
  reuseAtlas?: boolean;
  runtimeOptions?: any;
  renderPreset?: any;
  name?: string;

  // Inner props
  height?: number;
  spacing?: number;
  components?: {
    ViewerControls?: FC;
    MediaControls?: FC;
    ComplexTimelineControls?: FC;
  };

  // Other components
  canvasProps?: Omit<Partial<CanvasProps>, 'x'>;
  annotations?: ReactNode;
  annotationPopup?: ReactNode;
  svgTheme?: SVGTheme;
  updateViewportTimeout?: number;
  renderContextMenu?: (options: RenderContextProps) => ReactNode;
  keepCanvasScale?: boolean;
  renderAnnotationContextMenu?: (options: RenderContextProps) => ReactNode;
}

interface InnerProps {
  renderPreset?: any;
  runtimeOptions?: any;
  height?: number;
  canvasProps?: CanvasPanelProps['canvasProps'];
  spacing?: number;
  components?: CanvasPanelProps['components'];
  children?: ReactNode;
  annotations?: ReactNode;
  header?: ReactNode;
  reuseAtlas?: boolean;
  mode?: ViewerMode;
  annotationPopup?: ReactNode;
  svgTheme?: SVGTheme;
  updateViewportTimeout?: number;
  renderContextMenu?: (options: RenderContextProps) => ReactNode;
  keepCanvasScale?: boolean;
  renderAnnotationContextMenu?: (options: RenderContextProps) => ReactNode;
}

const Inner = forwardRef<SimpleViewerContext, InnerProps>(function Inner(props, ref) {
  const manifest = useManifest();
  const canvases = useVisibleCanvases();
  const viewer = useSimpleViewer();
  const { ViewerControls, MediaControls, ComplexTimelineControls } = props.components || {};

  useImperativeHandle(ref, () => viewer, [viewer]);

  if (!manifest) {
    return <div />;
  }

  let accumulator = 0;

  const isTopToBottom = manifest.viewingDirection === 'top-to-bottom';
  const isBottomToTop = manifest.viewingDirection === 'bottom-to-top';
  const isLeftToRight = manifest.viewingDirection === 'left-to-right';
  const isRightToLeft = manifest.viewingDirection === 'right-to-left';
  const isContinuous = manifest.behavior.includes('continuous');

  const spacing = isContinuous ? 0 : props.spacing || 0;

  const isReversed = isBottomToTop || isRightToLeft;

  const items = useMemo(() => {
    if (isReversed) {
      return [...canvases].reverse();
    }
    return canvases;
  }, [canvases, isReversed]);

  return (
    <>
      {props.header}
      <CanvasPanel.Viewer
        key={props.reuseAtlas ? '' : viewer.currentSequenceIndex}
        height={props.height}
        mode={props.mode}
        renderPreset={props.renderPreset}
        runtimeOptions={props.runtimeOptions}
        updateViewportTimeout={props.updateViewportTimeout}
      >
        {items.map((canvas, idx) => {
          let marginX = 0;
          let marginY = 0;

          if (isTopToBottom) {
            marginX = accumulator;
            accumulator += canvas.width + spacing;
          } else {
            marginY = accumulator;
            accumulator += canvas.height + spacing;
          }

          return (
            <CanvasContext canvas={canvas.id} key={canvas.id}>
              <CanvasPanel.RenderCanvas
                key={canvas.id}
                strategies={['3d-model', 'media', 'images', 'empty', 'textual-content', 'complex-timeline']}
                renderViewerControls={idx === 0 && ViewerControls ? () => <ViewerControls /> : undefined}
                renderMediaControls={idx === 0 && MediaControls ? () => <MediaControls /> : undefined}
                annotationPopup={props.annotationPopup}
                renderContextMenu={props.renderContextMenu}
                keepCanvasScale={props.keepCanvasScale}
                renderComplexTimelineControls={
                  idx === 0 && ComplexTimelineControls ? () => <ComplexTimelineControls /> : undefined
                }
                renderAnnotationContextMenu={props.renderAnnotationContextMenu}
                x={marginX}
                y={marginY}
                svgTheme={props.svgTheme}
                {...(props.canvasProps || {})}
              >
                {props.annotations}
              </CanvasPanel.RenderCanvas>
            </CanvasContext>
          );
        })}
      </CanvasPanel.Viewer>
      {props.children}
    </>
  );
});

type CanvasPanelType = ForwardRefExoticComponent<CanvasPanelProps & RefAttributes<SimpleViewerContext>> & {
  RenderImage: typeof RenderImage;
  RenderCanvas: typeof RenderCanvas;
  RenderAnnotationPage: typeof RenderAnnotationPage;
  RenderAnnotation: typeof RenderAnnotation;
  Viewer: typeof Viewer;
  CanvasBackground: typeof CanvasBackground;
  Audio: typeof Audio;
  Video: typeof Video;
  Model: typeof Model;
  AudioHTML: typeof AudioHTML;
  VideoHTML: typeof VideoHTML;
  ModelHTML: typeof ModelHTML;
  PlaceholderCanvas: typeof PlaceholderCanvas;
  getAtlasStoreByName: typeof getAtlasStoreByName;
};

export const CanvasPanel = forwardRef<SimpleViewerContext, CanvasPanelProps>(function CanvasPanel(
  {
    children,
    height,
    annotations,
    canvasProps,
    spacing,
    header,
    components,
    mode,
    reuseAtlas,
    renderPreset,
    runtimeOptions,
    annotationPopup,
    name,
    svgTheme,
    updateViewportTimeout,
    renderContextMenu,
    keepCanvasScale,
    renderAnnotationContextMenu,
    ...props
  },
  ref,
) {
  const vault = useExistingVault();

  return (
    <AtlasStoreProvider name={name}>
      <VaultProvider vault={vault}>
        <SimpleViewerProvider {...props}>
          <Inner
            ref={ref}
            height={height}
            components={components}
            spacing={spacing}
            canvasProps={canvasProps}
            annotations={annotations}
            header={header}
            mode={mode}
            reuseAtlas={reuseAtlas}
            renderPreset={renderPreset}
            runtimeOptions={runtimeOptions}
            annotationPopup={annotationPopup}
            svgTheme={svgTheme}
            updateViewportTimeout={updateViewportTimeout}
            renderContextMenu={renderContextMenu}
            keepCanvasScale={keepCanvasScale}
            renderAnnotationContextMenu={renderAnnotationContextMenu}
          >
            {children}
          </Inner>
        </SimpleViewerProvider>
      </VaultProvider>
    </AtlasStoreProvider>
  );
}) as CanvasPanelType;

CanvasPanel.RenderImage = RenderImage;
CanvasPanel.RenderCanvas = RenderCanvas;
CanvasPanel.RenderAnnotationPage = RenderAnnotationPage;
CanvasPanel.RenderAnnotation = RenderAnnotation;
CanvasPanel.Viewer = Viewer;
CanvasPanel.CanvasBackground = CanvasBackground;
CanvasPanel.Audio = Audio;
CanvasPanel.Video = Video;
CanvasPanel.Model = Model;
CanvasPanel.AudioHTML = AudioHTML;
CanvasPanel.VideoHTML = VideoHTML;
CanvasPanel.ModelHTML = ModelHTML;
CanvasPanel.PlaceholderCanvas = PlaceholderCanvas;
CanvasPanel.getAtlasStoreByName = getAtlasStoreByName;

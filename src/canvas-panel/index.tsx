import { FC, forwardRef, ForwardRefExoticComponent, ReactNode, RefAttributes, useImperativeHandle } from 'react';
import { Viewer } from './Viewer';
import { RenderAnnotation } from './render/Annotation';
import { RenderAnnotationPage } from './render/AnnotationPage';
import { CanvasProps, RenderCanvas } from './render/Canvas';
import { RenderImage } from './render/Image';
import { CanvasBackground } from './render/CanvasBackground';
import { SimpleViewerProvider, useSimpleViewer } from '../viewers/SimpleViewerContext';
import { VaultProvider } from '../context/VaultContext';
import { useManifest } from '../hooks/useManifest';
import { useVisibleCanvases } from '../context/VisibleCanvasContext';
import { CanvasContext } from '../context/CanvasContext';
import { useExistingVault } from '../hooks/useExistingVault';
import { SimpleViewerContext } from '../viewers/SimpleViewerContext.types';
import { Audio, AudioHTML } from './render/Audio';
import { Video, VideoHTML } from './render/Video';
import { Model, ModelHTML } from './render/Model';
import { ViewerMode } from '@atlas-viewer/atlas';
import { PlaceholderCanvas } from './render/PlaceholderCanvas';

interface CanvasPanelProps {
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

  // Inner props
  height?: number;
  spacing?: number;
  components?: {
    ViewerControls?: FC;
    MediaControls?: FC;
  };

  // Other components
  canvasProps?: Omit<Partial<CanvasProps>, 'x'>;
  annotations?: ReactNode;
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
}

const Inner = forwardRef<SimpleViewerContext, InnerProps>(function Inner(props, ref) {
  const manifest = useManifest();
  const canvases = useVisibleCanvases();
  const viewer = useSimpleViewer();
  const { ViewerControls, MediaControls } = props.components || {};

  useImperativeHandle(ref, () => viewer, [viewer]);

  if (!manifest) {
    return <div />;
  }

  let accumulator = 0;

  return (
    <>
      {props.header}
      <CanvasPanel.Viewer
        key={props.reuseAtlas ? '' : viewer.currentSequenceIndex}
        height={props.height}
        mode={props.mode}
        renderPreset={props.renderPreset}
        runtimeOptions={props.runtimeOptions}
      >
        {canvases.map((canvas, idx) => {
          const margin = accumulator;
          accumulator += canvas.width + (props.spacing || 0);
          return (
            <CanvasContext canvas={canvas.id} key={canvas.id}>
              <CanvasPanel.RenderCanvas
                key={canvas.id}
                strategies={['3d-model', 'media', 'images', 'empty', 'textual-content']}
                renderViewerControls={idx === 0 && ViewerControls ? () => <ViewerControls /> : undefined}
                renderMediaControls={idx === 0 && MediaControls ? () => <MediaControls /> : undefined}
                x={margin}
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
    ...props
  },
  ref
) {
  const vault = useExistingVault();

  return (
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
        >
          {children}
        </Inner>
      </SimpleViewerProvider>
    </VaultProvider>
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

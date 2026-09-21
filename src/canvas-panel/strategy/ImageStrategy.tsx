import { useRenderControls } from '../../context/ControlsContext';
import { useStrategy } from '../../context/StrategyContext';
import { useViewerPreset, ViewerPresetContext } from '../../context/ViewerPresetContext';
import { useCanvas } from '../../hooks/useCanvas';
import { useOverlay } from '../context/overlays';

export type { ImageStrategyProps } from '../scene/ImageStrategy';
import { RenderImageStrategy as SceneImageStrategy, type ImageStrategyProps } from '../scene/ImageStrategy';
import { ScenePresentationProvider } from '../scene/presentation';
import { NotAuthorised } from '../render/ImageService';
import { RenderAnnotationPage } from '../render/AnnotationPage';
const presentation = {
  Auth: NotAuthorised,
  AnnotationPage: ({ page }: React.ComponentProps<typeof RenderAnnotationPage>) =>
    <RenderAnnotationPage page={page} className="image-service-annotation" ignoreTargetId />,
};
export function RenderImageStrategy(props: ImageStrategyProps) {
  const { strategy } = useStrategy();
  const { renderViewerControls, viewControlsDeps } = useRenderControls();

  const canvas = useCanvas();
  const preset = useViewerPreset();

  useOverlay(
    preset && strategy.type === 'images' && renderViewerControls ? 'overlay' : 'none',
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

  return <ScenePresentationProvider presentation={presentation}><SceneImageStrategy {...props} /></ScenePresentationProvider>;
}

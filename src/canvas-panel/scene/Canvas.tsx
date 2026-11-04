import { useContext, type ReactNode } from 'react';
import { VirtualAnnotationPageContext } from '../../hooks/useVirtualAnnotationPageContext';
import type { BoxStyle } from '@atlas-viewer/atlas';
import { CanvasContext } from '../../context/CanvasContext';
import { useStrategy } from '../../context/StrategyContext';
import { useCanvasContainer } from '../../hooks/useCanvasContainer';
import { getAccompanyingContainer, getPlaceholderContainer } from '../../utility/canvas-compat';
import { CanvasStrategyProvider } from './CanvasStrategyProvider';
import { RenderEmptyStrategy } from '../strategy/EmptyStrategy';
import { CanvasWorldObject, type CanvasWorldObjectProps } from './CanvasWorldObject';
import { RenderImageStrategy, type ImageStrategyProps } from './ImageStrategy';
import { RenderComplexTimelineScene } from './ComplexTimeline';
import {
  MissingPresentation,
  ScenePresentationProvider,
  useScenePresentation,
  type ScenePresentation,
} from './presentation';

export interface CanvasSceneProps extends ImageStrategyProps, CanvasWorldObjectProps {
  presentation?: ScenePresentation;
  backgroundStyle?: BoxStyle;
  alwaysShowBackground?: boolean;
  children?: ReactNode;
}
/** Compose inside CanvasStrategyProvider. Its default supported strategy remains images only. */
export function RenderCanvasScene({ presentation, ...props }: CanvasSceneProps) {
  const inherited = useScenePresentation();
  return (
    <ScenePresentationProvider presentation={presentation || inherited}>
      <CanvasScene {...props} />
    </ScenePresentationProvider>
  );
}
function CanvasScene(props: CanvasSceneProps) {
  const {
    x,
    y,
    keepCanvasScale,
    events,
    onPositionChange,
    backgroundStyle,
    alwaysShowBackground,
    children,
    ...imageOptions
  } = props;
  const { strategy } = useStrategy();
  const presentation = useScenePresentation();
  const Text = presentation.Text;
  const virtualPage = useContext(VirtualAnnotationPageContext)?.fullPage;
  const pages = [...(virtualPage ? [virtualPage] : []), ...(strategy.annotations?.pages || [])];
  const canvas = useCanvasContainer();
  const accompanying = getAccompanyingContainer(canvas) || getPlaceholderContainer(canvas);
  let content: ReactNode = null;
  if (strategy.type === 'complex-timeline')
    content = <RenderComplexTimelineScene strategy={strategy} imageOptions={imageOptions} />;
  else if (strategy.type === 'textual-content')
    content = Text ? (
      strategy.items.map((item) => <Text key={item.annotationId} item={item} />)
    ) : (
      <MissingPresentation strategy={strategy} reason="Text content requires a Text presentation" />
    );
  else if (strategy.type === 'media') {
    const media = strategy.media;
    content =
      presentation.Media && (media.type === 'Video' || media.type === 'Sound') ? (
        <presentation.Media key={media.annotationId} item={media} visible />
      ) : (
        <MissingPresentation
          strategy={strategy}
          reason={`Media requires a compatible Media presentation: ${media.type}`}
        />
      );
  } else if (strategy.type !== 'images' && strategy.type !== 'empty')
    content = (
      <MissingPresentation
        strategy={strategy}
        reason={
          strategy.type === 'unknown' ? strategy.reason || 'Unknown strategy' : `Unsupported strategy: ${strategy.type}`
        }
      />
    );
  return (
    <>
      <CanvasWorldObject
        x={props.x}
        y={props.y}
        keepCanvasScale={props.keepCanvasScale}
        events={props.events}
        onPositionChange={props.onPositionChange}
      >
        <RenderEmptyStrategy
          backgroundStyle={props.backgroundStyle}
          alwaysShowBackground={props.alwaysShowBackground}
        />
        <RenderImageStrategy {...imageOptions} />
        {content}
        {strategy.type === 'images'
          ? pages.map((page) =>
              presentation.AnnotationPage ? (
                <presentation.AnnotationPage key={page.id} page={page} />
              ) : (
                <MissingPresentation
                  key={page.id}
                  strategy={strategy}
                  reason="Canvas annotations require an AnnotationPage presentation"
                />
              )
            )
          : null}
        {props.children}
      </CanvasWorldObject>
      {strategy.type === 'media' &&
      strategy.media.type === 'Sound' &&
      accompanying?.type === 'Canvas' &&
      accompanying.id !== canvas?.id ? (
        <CanvasContext canvas={accompanying.id}>
          <CanvasStrategyProvider>
            <RenderCanvasScene presentation={presentation} />
          </CanvasStrategyProvider>
        </CanvasContext>
      ) : null}
    </>
  );
}

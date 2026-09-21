import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { ComplexTimelineProvider } from '../../context/ComplexTimelineContext';
import type { ComplexTimelineStrategy } from '../../features/rendering-strategy/strategies';
import {
  createComplexTimelineStore,
  type ComplexTimelineController,
} from '../../future-helpers/complex-timeline-store';
import { useCanvasContainer } from '../../hooks/useCanvasContainer';
import { RenderImage } from './Image';
import { MissingPresentation, useScenePresentation } from './presentation';
import type { ImageOptions } from './types';
import { SceneHighlight } from './Highlight';

export function RenderComplexTimelineScene({
  strategy,
  children,
  imageOptions,
}: {
  strategy: ComplexTimelineStrategy;
  children?: ReactNode;
  imageOptions?: ImageOptions;
}) {
  const canvas = useCanvasContainer();
  const [controller, setController] = useState<ComplexTimelineController | null>(null);
  useEffect(() => {
    const next = createComplexTimelineStore({ complexTimeline: strategy });
    setController(next);
    next.store.getState().startClock();
    return next.dispose;
  }, [canvas?.id]);
  useEffect(() => {
    controller?.store.getState().updateTimeline(strategy);
  }, [controller, strategy]);
  if (!controller) return null;
  return (
    <ComplexTimelineProvider store={controller.store}>
      <TimelineItems controller={controller} imageOptions={imageOptions} />
      {children}
    </ComplexTimelineProvider>
  );
}

function TimelineItems({
  controller,
  imageOptions,
}: {
  controller: ComplexTimelineController;
  imageOptions?: ImageOptions;
}) {
  const strategy = useStore(controller.store, (state) => state.complexTimeline);
  const visible = useStore(controller.store, (state) => state.visibleElements);
  const presentation = useScenePresentation();
  const Highlight = presentation.Highlight || SceneHighlight;
  return (
    <>
      {strategy.items.map((item) => {
        const active = !!visible[item.annotationId];
        switch (item.type) {
          case 'Image':
            return active ? (
              <RenderImage
                {...imageOptions}
                key={item.annotationId}
                image={item}
                id={item.annotationId}
                selector={item.selector}
              />
            ) : null;
          case 'Text':
            return active ? (
              presentation.Text ? (
                <presentation.Text key={item.annotationId} item={item} />
              ) : (
                <MissingPresentation
                  key={item.annotationId}
                  strategy={strategy}
                  reason="Timeline text requires a Text presentation"
                />
              )
            ) : null;
          case 'Video':
          case 'Sound':
            return presentation.Media ? (
              <presentation.Media key={item.annotationId} item={item} visible={active} controller={controller} />
            ) : (
              <MissingPresentation
                key={item.annotationId}
                strategy={strategy}
                reason="Timeline media requires a Media presentation"
              />
            );
          default:
            return (
              <MissingPresentation
                key={item.annotationId}
                strategy={strategy}
                reason={`Unsupported timeline item: ${item.type}`}
              />
            );
        }
      })}
      {strategy.highlights.map(({ annotation }) =>
        visible[annotation.id] ? <Highlight key={annotation.id} id={annotation.id} /> : null
      )}
    </>
  );
}

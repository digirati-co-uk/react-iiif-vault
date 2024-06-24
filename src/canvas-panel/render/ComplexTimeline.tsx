import { useLayoutEffect, useMemo, useState } from 'react';
import { ComplexTimelineStrategy } from '../../features/rendering-strategy/strategies';
import { createComplexTimelineStore } from '../../future-helpers/complex-timeline-store';
import { HTMLPortal } from '@atlas-viewer/atlas';
import { RenderImage } from './Image';
import { useStore } from 'zustand';
import { useOverlay } from '../context/overlays';
import { ComplexTimelineProvider } from '../../context/ComplexTimelineContext';

export function RenderComplexTimeline({
  strategy,
  children,
}: {
  strategy: ComplexTimelineStrategy;
  children?: React.ReactNode;
}) {
  const { store } = useMemo(() => {
    return createComplexTimelineStore({ complexTimeline: strategy });
  }, [strategy]);

  const isReady = useStore(store, (s) => s.isReady);
  const visibleElements = useStore(store, (s) => s.visibleElements);
  const actions = useStore(store, (s) => s);
  const { playPause, isPlaying } = actions;

  function refFor(id: string) {
    return (el: HTMLVideoElement) => {
      if (el) {
        store.getState().setElement(id, el);
      }
    };
  }

  useLayoutEffect(() => {
    if (isReady) {
      const { startClock, stopClock } = store.getState();
      startClock();
      return () => {
        stopClock();
      };
    }
  }, [isReady]);

  useOverlay(
    'portal',
    'custom-controls',
    ComplexTimelineProvider,
    {
      store,
      children,
    },
    [isReady]
  );

  return (
    <>
      {strategy.items.map((item) => {
        if (item.type !== 'Image') return null;
        if (!visibleElements[item.annotationId]) return null;
        return <RenderImage key={item.id} image={item} id={item.annotationId} />;
      })}
      {strategy.items.map((item, i) => {
        if (item.type !== 'Video') return null;
        if (!item.target.spatial) return null;
        return (
          <HTMLPortal key={i} target={item.target.spatial as any}>
            <video
              ref={refFor(item.annotationId)}
              src={item.url}
              style={{ height: '100%', width: '100%', opacity: visibleElements[item.annotationId] ? 1 : 0 }}
            />
          </HTMLPortal>
        );
      })}
    </>
  );
}

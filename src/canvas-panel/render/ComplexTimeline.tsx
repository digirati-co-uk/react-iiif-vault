import type { ImageOptions } from '../scene/types';
import { HTMLPortal } from '@atlas-viewer/atlas';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ComplexTimelineProvider, useComplexTimelineStore } from '../../context/ComplexTimelineContext';
import type { ComplexTimelineStrategy } from '../../features/rendering-strategy/strategies';
import { useOverlay } from '../context/overlays';
import { RenderComplexTimelineScene } from '../scene/ComplexTimeline';
import { ScenePresentationProvider, type SceneMediaProps } from '../scene/presentation';
import { RenderAnnotation } from './Annotation';
import { RenderTextualContent } from './TextualContent';
import { NotAuthorised } from './ImageService';

function TimelineMedia({ item, visible, controller }: SceneMediaProps) {
  const [element, setElement] = useState<HTMLMediaElement | null>(null);
  useEffect(() => element && controller ? controller.attachMediaElement(item.annotationId, element) : undefined,
    [controller, item.annotationId, item.url, element]);
  return <HTMLPortal target={'spatial' in item.target ? item.target.spatial as any : undefined}>
    {item.type === 'Video' ? <video ref={setElement} src={item.url} style={{ height: '100%', width: '100%', opacity: visible ? 1 : 0, pointerEvents: visible ? undefined : 'none' }} /> :
      <audio ref={setElement} src={item.url} />}
  </HTMLPortal>;
}
const presentation = {
  Auth: NotAuthorised,
  Media: TimelineMedia,
  Text: ({ item }: { item: import('../../features/rendering-strategy/textual-content-strategy').TextContent }) =>
    <RenderTextualContent strategy={{ type: 'textual-content', items: [item] }} />,
  Highlight: ({ id }: { id: string }) => <RenderAnnotation id={id} ignoreTargetId style={{ outline: '3px solid red' }} className="image-service-annotation" />,
};
function TimelineControls({ children }: { children?: ReactNode }) {
  const store = useComplexTimelineStore();
  const id = useId();
  useOverlay('portal', `timeline-controls-${id}`, ComplexTimelineProvider, { store, children }, [store, children]);
  return null;
}
export function RenderComplexTimeline({ strategy, children, imageOptions }: { strategy: ComplexTimelineStrategy; children?: ReactNode; imageOptions?: ImageOptions }) {
  return <ScenePresentationProvider presentation={presentation}>
    <RenderComplexTimelineScene strategy={strategy} imageOptions={imageOptions}><TimelineControls>{children}</TimelineControls></RenderComplexTimelineScene>
  </ScenePresentationProvider>;
}

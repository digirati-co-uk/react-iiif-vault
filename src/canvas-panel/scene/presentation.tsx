import {
  createContext,
  useContext,
  useEffect,
  type ComponentType,
  type FunctionComponent,
  type ReactNode,
} from 'react';
import type { ImageService, InternationalString } from '@iiif/parser/presentation-3/types';
import type {
  AnnotationPageDescription,
  ImageWithOptionalService,
  SingleAudio,
  SingleVideo,
} from '../../features/rendering-strategy/resource-types';
import type { RenderingStrategy } from '../../features/rendering-strategy/strategies';
import type { TextContent } from '../../features/rendering-strategy/textual-content-strategy';
import type { ComplexTimelineController } from '../../future-helpers/complex-timeline-store';

export interface SceneMediaProps {
  item: SingleAudio | SingleVideo;
  visible: boolean;
  controller?: ComplexTimelineController;
}
export interface UnsupportedSceneProps {
  reason: string;
  strategy?: RenderingStrategy;
}

/** Leaves run in the Atlas tree. Return scene nodes or bind host-owned DOM in effects. */
export interface ScenePresentation {
  Media?: ComponentType<SceneMediaProps>;
  Text?: ComponentType<{ item: TextContent }>;
  Auth?: FunctionComponent<{
    resource: ImageService;
    error: string;
    heading: InternationalString | null;
    note: InternationalString | null;
    extra: (ImageWithOptionalService & { service: ImageService }) | undefined;
  }>;
  AnnotationPage?: ComponentType<{ page: AnnotationPageDescription['pages'][number] }>;
  Highlight?: ComponentType<{ id: string }>;
  Unsupported?: ComponentType<UnsupportedSceneProps>;
}
const ScenePresentationContext = createContext<ScenePresentation>({});
export function ScenePresentationProvider({
  presentation,
  children,
}: {
  presentation: ScenePresentation;
  children?: ReactNode;
}) {
  return <ScenePresentationContext.Provider value={presentation}>{children}</ScenePresentationContext.Provider>;
}
export const useScenePresentation = () => useContext(ScenePresentationContext);

export function MissingPresentation(props: UnsupportedSceneProps) {
  const { Unsupported } = useScenePresentation();
  useEffect(() => {
    if (!Unsupported) console.warn(`[react-iiif-vault/scene] ${props.reason}`, props.strategy);
  }, [Unsupported, props.reason, props.strategy]);
  return Unsupported ? <Unsupported {...props} /> : null;
}

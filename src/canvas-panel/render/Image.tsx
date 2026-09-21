import type { ComponentProps } from 'react';
import { RenderImage as SceneImage } from '../scene/Image';
import { ScenePresentationProvider } from '../scene/presentation';
import { RenderAnnotationPage } from './AnnotationPage';
import { NotAuthorised } from './ImageService';

const presentation = {
  Auth: NotAuthorised,
  AnnotationPage: ({ page }: ComponentProps<typeof RenderAnnotationPage>) =>
    <RenderAnnotationPage page={page} className="image-service-annotation" ignoreTargetId />,
};

export function RenderImage(props: ComponentProps<typeof SceneImage>) {
  return <ScenePresentationProvider presentation={presentation}><SceneImage {...props} /></ScenePresentationProvider>;
}

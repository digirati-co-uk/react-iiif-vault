import { useAnnotation } from '../../hooks/useAnnotation';
import { useStyles } from '../../hooks/useStyles';
import { useResourceEvents } from '../../hooks/useResourceEvents';

/** Scene-only bounds highlight. SVG editing and popups belong to the host. */
export function SceneHighlight({ id }: { id: string }) {
  const annotation = useAnnotation({ id });
  const style = useStyles(annotation, 'atlas');
  const events = useResourceEvents(annotation, ['atlas']);
  const selector = (annotation?.target as any)?.selector;
  return selector?.spatial ? (
    <box target={selector.spatial} style={{ outline: '3px solid red', ...style }} {...events} />
  ) : null;
}

import { type BoxStyle, HTMLPortal, mergeStyles, RegionHighlight } from '@atlas-viewer/atlas';
import React, { type FC, useMemo } from 'react';
import { useAnnotationStyles } from '../../context/AnnotationStylesContext';
import { useAnnotation } from '../../hooks/useAnnotation';
import { useCanvas } from '../../hooks/useCanvas';
import { useResourceEvents } from '../../hooks/useResourceEvents';
import { useStyles } from '../../hooks/useStyles';

export const RenderAnnotation: FC<{
  id: string;
  className?: string;
  style?: BoxStyle;
  interactive?: boolean;
  targetId?: string;
  ignoreTargetId?: boolean;
}> = ({ id, style: defaultStyle, className, interactive, targetId, ignoreTargetId }) => {
  const annotation = useAnnotation({ id });
  const style = useStyles<BoxStyle>(annotation, 'atlas');
  const html = useStyles<{ className?: string; href?: string; title?: string; target?: string }>(annotation, 'html');
  const events = useResourceEvents(annotation as any, ['atlas']);
  const canvas = useCanvas();
  const styles = useAnnotationStyles();

  const allStyles = useMemo(() => {
    return mergeStyles(
      mergeStyles(defaultStyle, style),
      annotation?.motivation?.includes('highlighting') ? styles.highlighted : styles.default,
    );
  }, [defaultStyle, style, styles, annotation?.motivation]);

  const targetIdToCheck = targetId || canvas?.id;

  const isValid =
    canvas &&
    annotation &&
    annotation.target &&
    (annotation.target as any).selector &&
    ((annotation.target as any).selector.type === 'BoxSelector' ||
      (annotation.target as any).selector.type === 'SvgSelector') &&
    (annotation.target as any).source &&
    (ignoreTargetId
      ? true
      : (annotation.target as any).source.id === targetIdToCheck ||
        (annotation.target as any).source === targetIdToCheck);

  console.log('isValid', isValid);

  if (!isValid) {
    return null;
  }

  return (
    <RegionHighlight
      id={annotation.id}
      isEditing={true}
      region={(annotation.target as any).selector.spatial}
      style={allStyles}
      className={html?.className || className}
      interactive={!!(html?.href || interactive)}
      href={html?.href || null}
      title={html?.title || null}
      hrefTarget={html?.target || null}
      onClick={() => void 0}
      {...events}
    />
  );
};

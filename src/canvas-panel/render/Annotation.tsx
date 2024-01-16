import { BoxStyle, HTMLPortal, mergeStyles, RegionHighlight } from '@atlas-viewer/atlas';
import { useResourceEvents } from '../../hooks/useResourceEvents';
import { useStyles } from '../../hooks/useStyles';
import React, { FC, useMemo } from 'react';
import { useAnnotation } from '../../hooks/useAnnotation';
import { useCanvas } from '../../hooks/useCanvas';

export const RenderAnnotation: FC<{ id: string; className?: string; style?: BoxStyle; interactive?: boolean }> = ({
  id,
  style: defaultStyle,
  className,
  interactive,
}) => {
  const annotation = useAnnotation({ id });
  const style = useStyles<BoxStyle>(annotation, 'atlas');
  const html = useStyles<{ className?: string; href?: string; title?: string; target?: string }>(annotation, 'html');
  const events = useResourceEvents(annotation as any, ['atlas']);
  const canvas = useCanvas();

  const allStyles = useMemo(() => {
    return mergeStyles(defaultStyle, style);
  }, [defaultStyle, style]);

  const isValid =
    canvas &&
    annotation &&
    annotation.target &&
    (annotation.target as any).selector &&
    (annotation.target as any).selector.type === 'BoxSelector' &&
    (annotation.target as any).source &&
    ((annotation.target as any).source.id === canvas.id || (annotation.target as any).source === canvas.id);

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

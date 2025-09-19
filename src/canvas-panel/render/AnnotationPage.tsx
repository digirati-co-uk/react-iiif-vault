import type { BoxStyle } from '@atlas-viewer/atlas';
import type { AnnotationPage } from '@iiif/presentation-3';
import type { AnnotationPageNormalized } from '@iiif/presentation-3-normalized';
import React, { type FC, Fragment } from 'react';
import { useAnnotationPage } from '../../hooks/useAnnotationPage';
import { useStyles } from '../../hooks/useStyles';
import { useVaultSelector } from '../../hooks/useVaultSelector';
import { RenderAnnotation } from './Annotation';

export const RenderAnnotationPage: FC<{
  page: { id: string; type: string } | AnnotationPage | AnnotationPageNormalized;
  className?: string;
  targetId?: string;
  ignoreTargetId?: boolean;
}> = ({ className, page: _page, targetId, ignoreTargetId }) => {
  const page = useAnnotationPage({ id: _page.id }) || (_page as AnnotationPageNormalized);
  const style = useStyles<BoxStyle>(page, 'atlas');
  const html = useStyles<{ className?: string }>(page, 'html');

  useVaultSelector((state) => (page.id ? state.iiif.entities.AnnotationPage[page.id] : null), []);

  return (
    <Fragment>
      {page.items?.map((annotation) => {
        return (
          <RenderAnnotation
            key={annotation.id}
            id={annotation.id}
            style={style}
            className={html?.className || className}
            targetId={targetId}
            ignoreTargetId={ignoreTargetId}
          />
        );
      })}
    </Fragment>
  );
};

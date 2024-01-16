import { AnnotationPage } from '@iiif/presentation-3';
import { AnnotationPageNormalized } from '@iiif/presentation-3-normalized';
import { RenderAnnotation } from './Annotation';
import { BoxStyle } from '@atlas-viewer/atlas';
import { useStyles } from '../../hooks/useStyles';
import { useVaultSelector } from '../../hooks/useVaultSelector';
import React, { FC, Fragment } from 'react';
import { useAnnotationPage } from '../../hooks/useAnnotationPage';

export const RenderAnnotationPage: FC<{ page: AnnotationPage | AnnotationPageNormalized; className?: string }> = ({
  className,
  page: _page,
}) => {
  const page = useAnnotationPage({ id: _page.id }) || _page;
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
          />
        );
      })}
    </Fragment>
  );
};

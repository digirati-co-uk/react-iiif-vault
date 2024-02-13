import { useThumbnail } from '../hooks/useThumbnail';
import { useCanvas } from '../hooks/useCanvas';
import { LazyLoadComponent } from 'react-lazy-load-image-component';
import { LocaleString } from '../utility/i18n-utils';
import { SizeParameter } from '@atlas-viewer/iiif-image-api';
import { CanvasContext } from '../context/CanvasContext';
import { getValue } from '@iiif/helpers/i18n';

interface SingleCanvasThumbnailProps {
  canvasId?: string;
  size?: Partial<SizeParameter>;
  visible?: boolean;
  alt?: string;
  dereference?: boolean;

  // Style
  figure?: boolean;
  showLabel?: boolean;
  classes?: {
    figure?: string;
    img?: string;
    label?: string;
    imageWrapper?: string;
  };

  // Slots.
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SingleCanvasThumbnail(props: SingleCanvasThumbnailProps) {
  const { size, visible, classes, canvasId, figure } = props;
  const width = size?.width || 128;
  const height = size?.height || size?.width || 128;

  const inner = <Inner {...props} />;

  const lazy = (
    <LazyLoadComponent threshold={300} style={{ height, width }} visibleByDefault={visible}>
      {canvasId ? <CanvasContext canvas={canvasId}>{inner}</CanvasContext> : inner}
    </LazyLoadComponent>
  );

  if (figure) {
    return <figure className={classes?.figure}>{lazy}</figure>;
  }

  return lazy;
}

function Inner({ fallback, size, classes, showLabel, alt, dereference = false }: SingleCanvasThumbnailProps) {
  const canvas = useCanvas();
  const width = size?.width || 128;
  const height = size?.height || size?.width || 128;
  const imageAlt = alt || getValue(canvas?.label) || '';

  const thumbnail = useThumbnail({ width, height }, dereference);

  if (!thumbnail || thumbnail.type !== 'fixed') {
    return <>{fallback}</>;
  }

  return (
    <>
      <div className={classes?.imageWrapper}>
        <img className={classes?.img} src={thumbnail.id} alt={imageAlt} />
      </div>
      {showLabel ? (
        <LocaleString as="figcaption" className={classes?.label}>
          {canvas?.label}
        </LocaleString>
      ) : null}
    </>
  );
}

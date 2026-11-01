import type { CSSProperties } from 'react';
import type { InputShape } from 'polygon-editor';
import { polygonPath } from '../../utility/polygon-path';

/** A curve-preserving SVG preview, also useful outside Atlas. */
export function PolygonPreview({
  shape,
  image,
  stroke = '#2563eb',
  strokeWidth = 2,
  fill = '#2563eb22',
  onClick,
  style,
  className,
}: {
  shape: InputShape;
  image: { width: number; height: number };
  stroke?: string;
  strokeWidth?: number | string;
  fill?: string;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${image.width} ${image.height}`}
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}
      aria-label="Annotation shape"
      className={className}
    >
      <path
        d={polygonPath(shape.points, shape.open)}
        fill={shape.open ? 'none' : fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        onClick={onClick}
        style={{ pointerEvents: onClick ? 'visiblePainted' : 'none', cursor: onClick ? 'pointer' : undefined }}
      />
    </svg>
  );
}

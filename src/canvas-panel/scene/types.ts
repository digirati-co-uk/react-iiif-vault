import type { CompositeResourceProps } from '@atlas-viewer/atlas';

/** Shared image options. Hosts translate legacy skip/disable flags into enable flags. */
export interface ImageOptions {
  isStatic?: boolean;
  enableSizes?: boolean;
  enableThumbnail?: boolean;
  /** Additional, already resolved image candidates (including virtual sizes). */
  imageCandidates?: Array<{ id: string; width: number; height: number }>;
  useFloorCalc?: boolean;
  format?: string;
  renderOptions?: CompositeResourceProps;
  style?: { opacity?: number; [key: string]: unknown };
}

import type { CanvasProps as FiberCanvasProps } from '@react-three/fiber';
import type { SceneTarget, MatrixTuple } from '@iiif/helpers/scenes';
import type { Vault4 } from '@iiif/helpers/vault-4';
import type { Annotation, AnnotationPage, Manifest, Scene } from '@iiif/parser/presentation-4/types';
import type {
  AnnotationNormalized,
  AnnotationPageNormalized,
  ManifestNormalized,
  SceneNormalized,
} from '@iiif/parser/presentation-4-normalized/types';
import type React from 'react';

export type SceneInput = string | { id: string; type: 'Scene' } | Scene | SceneNormalized;
export type ManifestInput = string | { id: string; type: 'Manifest' } | Manifest | ManifestNormalized;

export type SceneDiagnostic = {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  resourceId?: string;
  cause?: unknown;
};

export type SceneClockSnapshot = { time: number; playing: boolean; playbackRate: number };
export interface SceneClock {
  getSnapshot(): SceneClockSnapshot;
  subscribe(listener: () => void): () => void;
  play(): void;
  pause(): void;
  seek(time: number): void;
  setPlaybackRate(rate: number): void;
}

export type SceneResourceState = {
  visible: boolean;
  disabled: boolean;
  selected: boolean;
  playing: boolean;
  activeAnimation?: string | null;
};

export type SceneRuntimeSnapshot = {
  sceneId: string;
  duration: number;
  currentTime: number;
  playing: boolean;
  playbackRate: number;
  activeCamera: string | null;
  selectedAnnotation: string | null;
  audio: { locked: boolean; muted: boolean; volume: number };
  resources: Record<string, SceneResourceState>;
  errors: Record<string, string>;
};

export type ActivationResult = {
  ok: boolean;
  annotationIds: string[];
  error?: string;
};

export interface ScenePanelHandle {
  play(): void;
  pause(): void;
  seek(time: number): void;
  setPlaybackRate(rate: number): void;
  reset(): void;
  resetView(): void;
  selectCamera(id: string): void;
  selectAnnotation(id: string | null): void;
  activate(target: string | { id: string; type: string }): ActivationResult;
  getSnapshot(): SceneRuntimeSnapshot;
}

export type SceneResourceRegistration = {
  path: string;
  ids: readonly string[];
  type: string;
  supportedActions?: readonly string[];
  initial?: Partial<SceneResourceState>;
  interactionMode?: readonly string[];
  getBounds?: () => readonly [number, number, number] | null;
};

export type SceneResourceRendererContext = {
  resource: Record<string, unknown> & { id: string; type: string };
  annotation: AnnotationNormalized;
  target: SceneTarget;
};

export type SceneResourceRendererProps = SceneResourceRendererContext & {
  path: string;
  matrix: MatrixTuple;
  state: SceneResourceState;
  clock: SceneClockSnapshot;
  register(registration: SceneResourceRegistration): () => void;
  activate(): ActivationResult;
  onDiagnostic(diagnostic: SceneDiagnostic): void;
};

export interface SceneResourceRenderer {
  id: string;
  supports(context: SceneResourceRendererContext): boolean;
  Component: React.ComponentType<SceneResourceRendererProps>;
}

export type SceneTransitionOptions = {
  /** Transition duration in seconds. Defaults to 0.6. */
  duration?: number;
};

export type SceneCameraZoomOptions = {
  /** Duration in seconds for one normalized wheel step. Defaults to 0.1. */
  duration?: number;
  /** Multiplier over Atlas's 5% zoom per normalized wheel step. Defaults to 1. */
  sensitivity?: number;
  /** Easing applied to normalized progress. Defaults to Atlas's easeOutExpo. */
  easing?: (progress: number) => number;
  /** Keep the world point beneath the cursor anchored. Enabled by default. */
  zoomToCursor?: boolean;
};

export type SceneStageOptions = {
  backgroundColor?: string;
  floorColor?: string;
  /** Floor opacity. Defaults to 0.62 so Scene background colours remain visible. */
  floorOpacity?: number;
  gridColor?: string;
  size?: number;
};

export type SceneDebugOptions = {
  /** Show light origins, colours, types, and directional rays. */
  lights?: boolean;
};

export interface ScenePanelProps {
  manifest?: ManifestInput;
  scene?: SceneInput;
  startScene?: string;
  vault?: Vault4;
  children?: React.ReactNode;
  overlay?: React.ReactNode;
  controls?: boolean | React.ReactNode;
  annotations?: 'auto' | 'none';
  renderers?: readonly SceneResourceRenderer[];
  clock?: SceneClock;
  /** Smooth resource visibility and camera changes. Enabled by default. */
  transitions?: boolean | SceneTransitionOptions;
  /** A neutral floor and grid that make the Scene origin legible. Enabled by default. */
  stage?: boolean | SceneStageOptions;
  /** Development visualizations. Disabled by default. */
  debug?: boolean | SceneDebugOptions;
  /** Default annotation marker diameter in CSS pixels. Defaults to 16. */
  annotationMarkerSize?: number;
  /** Viewer-wide default marker; an Annotation3D marker prop still takes precedence. */
  annotationMarker?: React.ComponentType<AnnotationMarkerProps> | false;
  /** Viewer-wide default popover; an Annotation3D popover prop still takes precedence. */
  annotationPopover?: React.ComponentType<AnnotationPopoverProps> | false;
  /** Play a small, one-time camera cue after an automatically framed model loads. Enabled by default. */
  cameraCue?: boolean;
  /** Padding multiplier used when automatically framing a Scene without an authored camera. Defaults to 1.4. */
  cameraPadding?: number;
  /** Atlas-style smooth wheel zoom options. */
  cameraZoom?: SceneCameraZoomOptions;
  /** Directory containing the Three.js KTX2/Basis transcoder files. A pinned jsDelivr path is used by default. */
  ktx2TranscoderPath?: string;
  canvasProps?: Omit<FiberCanvasProps, 'children'>;
  className?: string;
  style?: React.CSSProperties;
  /** Content rendered during server rendering, before Scene loading begins on the client. */
  ssrFallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  onReady?: (scene: SceneNormalized) => void;
  onDiagnostic?: (diagnostic: SceneDiagnostic) => void;
}

export type AnnotationReference = { id: string; type: 'Annotation' };
export type AnnotationPageReference = { id: string; type: 'AnnotationPage' };

export type AnnotationMarkerProps = {
  annotation: AnnotationNormalized;
  point: [number, number, number];
  selected: boolean;
  /** Requested marker diameter in CSS pixels. */
  size: number;
  activate(): void;
};

export type AnnotationPopoverProps = {
  annotation: AnnotationNormalized;
  /** Resolved Scene position for the popover anchor. */
  point: [number, number, number];
  selected: boolean;
  close(): void;
};

export type Annotation3DRenderContext = AnnotationMarkerProps;

export interface Annotation3DProps {
  annotation: string | AnnotationReference | Annotation | AnnotationNormalized;
  marker?: React.ComponentType<AnnotationMarkerProps> | false;
  popover?: React.ComponentType<AnnotationPopoverProps> | false;
  children?: (context: Annotation3DRenderContext) => React.ReactNode;
  onSelect?: (annotation: AnnotationNormalized) => void;
}

export interface AnnotationPage3DProps extends Omit<Annotation3DProps, 'annotation'> {
  page: string | AnnotationPageReference | AnnotationPage | AnnotationPageNormalized;
}

export type SceneProviderProps = Pick<
  ScenePanelProps,
  | 'manifest'
  | 'scene'
  | 'startScene'
  | 'vault'
  | 'renderers'
  | 'clock'
  | 'annotations'
  | 'transitions'
  | 'stage'
  | 'debug'
  | 'annotationMarkerSize'
  | 'annotationMarker'
  | 'annotationPopover'
  | 'cameraCue'
  | 'cameraPadding'
  | 'cameraZoom'
  | 'ktx2TranscoderPath'
  | 'onReady'
  | 'onDiagnostic'
> & {
  children: React.ReactNode;
  ssrFallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
};

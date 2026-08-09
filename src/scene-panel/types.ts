import type { CanvasProps as FiberCanvasProps } from '@react-three/fiber';
import type { SceneTarget, MatrixTuple, ScenePaintableType } from '@iiif/helpers/scenes';
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
  /** Registered instance path when a repeated Annotation instance is selected. */
  selectedAnnotationPath: string | null;
  audio: { locked: boolean; muted: boolean; volume: number };
  resources: Record<string, SceneResourceState>;
  errors: Record<string, string>;
};

export type SceneBounds = {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
};

export type SceneTransformMode = 'translate' | 'rotate' | 'scale';
export type SceneTransformSpace = 'local' | 'world';

export type SceneTransformValue = {
  annotationId: string;
  translation: [number, number, number];
  /** Presentation 4 authored x/y/z degrees and transform order. */
  rotation: [number, number, number];
  scale: [number, number, number];
};

export type SceneEditingOptions = {
  enabled: boolean;
  mode: SceneTransformMode;
  space?: SceneTransformSpace;
  selectedAnnotation?: string | null;
  translationSnap?: number | null;
  /** Degrees, matching Presentation 4 RotateTransform values. */
  rotationSnap?: number | null;
  scaleSnap?: number | null;
  showSelectionOutline?: boolean;
  showLightHelpers?: boolean;
  showCameraHelpers?: boolean;
  /** Painting resource categories that pointer editing may select. Defaults to all categories. */
  editableTypes?: readonly ScenePaintableType[];
  onSelectAnnotation?: (annotation: AnnotationNormalized | null) => void;
  onTransformChange?: (value: SceneTransformValue) => void;
  onTransformCommit?: (value: SceneTransformValue) => void;
  onTransformCancel?: (annotationId: string) => void;
};

export type SceneView = {
  projection: 'perspective' | 'orthographic';
  position: [number, number, number];
  /** Presentation 4 authored x/y/z degrees and transform order. */
  rotation: [number, number, number];
  target: [number, number, number];
  fieldOfView?: number;
  viewHeight?: number;
  near: number;
  far: number;
};

export type SceneResourceStatus = {
  /** Complete rendered instance path; callback entries are ordered by registration. */
  path: string;
  annotationId: string;
  resourceId: string;
  resourceType: string;
  status: 'loading' | 'ready' | 'error';
  error?: SceneDiagnostic;
  bounds?: Pick<SceneBounds, 'min' | 'max'>;
};

export type ActivationResult = {
  ok: boolean;
  annotationIds: string[];
  error?: string;
};

export type SceneAnnotationRef = string | { id: string; path?: string };

export interface ScenePanelHandle {
  play(): void;
  pause(): void;
  seek(time: number): void;
  setPlaybackRate(rate: number): void;
  reset(): void;
  resetView(): void;
  selectCamera(id: string): void;
  selectAnnotation(annotation: SceneAnnotationRef | null): void;
  frameAnnotation(annotation: SceneAnnotationRef, options?: { padding?: number }): void;
  frameAll(options?: { padding?: number }): void;
  /** Bounds are expressed in root Scene coordinates. */
  getAnnotationBounds(annotation: SceneAnnotationRef): SceneBounds | null;
  getView(): SceneView;
  setView(view: SceneView, options?: { transition?: boolean }): void;
  activate(target: string | { id: string; type: string; path?: string }): ActivationResult;
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
  /** Full world-space bounds. Renderer helpers must not be included. */
  getBoundingBox?: () => SceneBounds | null;
  /** Current camera view, for camera registrations used with renderer-owned overrides. */
  getView?: () => SceneView | null;
  annotationId?: string;
  resourceId?: string;
  resourceType?: string;
  /** Whether frameAll() should include this resource. Defaults to true for custom renderers. */
  frameable?: boolean;
  /** Complete root-to-instance prefix for resources inside a repeated Scene. */
  instancePath?: string;
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
  /** Publish loading, retry, ready, or error state for this rendered path. */
  setStatus(status: SceneResourceStatus['status'], details?: Pick<SceneResourceStatus, 'error' | 'bounds'>): void;
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

export type SceneCameraControlMode = 'manifest' | 'orbit' | 'fly';

export type SceneCameraControlsOptions = {
  /** Use the authored camera interaction, or override it with a renderer-owned free view. Defaults to `manifest`. */
  mode?: SceneCameraControlMode;
  /** Fly-through movement in Scene units per second. Defaults to 1. */
  movementSpeed?: number;
  /** Pointer-look sensitivity in radians per CSS pixel. Defaults to 0.005. */
  lookSpeed?: number;
  /** Invert fly-through look direction. Disabled by default. */
  invertLook?: boolean;
  /** Only look around while the pointer is dragged. Enabled by default. */
  dragToLook?: boolean;
  /** Move forward without holding W. Disabled by default. */
  autoForward?: boolean;
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
  /** Built-in or custom controls. Disabled by default. */
  controls?: boolean | React.ReactNode;
  annotations?: 'auto' | 'none';
  renderers?: readonly SceneResourceRenderer[];
  clock?: SceneClock;
  /** Controlled painting Annotation selection. `editing.selectedAnnotation` takes precedence; removing control clears selection. */
  selectedAnnotation?: string | null;
  onSelectAnnotation?: (annotation: AnnotationNormalized | null) => void;
  editing?: SceneEditingOptions;
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
  /** Optional renderer-owned camera interaction override. Authored Manifest camera behavior is used by default. */
  cameraControls?: SceneCameraControlsOptions;
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
  /** Path-granular status for every painted body; sibling bodies are never aggregated. */
  onResourceStatusChange?: (resources: SceneResourceStatus[]) => void;
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
  /** Internal instance prefix used when a Scene is painted more than once. */
  instancePath?: string;
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
  | 'selectedAnnotation'
  | 'onSelectAnnotation'
  | 'editing'
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
  | 'cameraControls'
  | 'ktx2TranscoderPath'
  | 'onReady'
  | 'onDiagnostic'
  | 'onResourceStatusChange'
> & {
  children: React.ReactNode;
  ssrFallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
};

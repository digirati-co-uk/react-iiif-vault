// Public type names from main (0a8619f), retained for source compatibility.
import type {
  AnnotationPageDescription,
  AnnotationRequest,
  AnnotationRequestOptions,
  AnnotationResponse,
  AnnotationStrategyProps,
  AnnotationStyles,
  AnnotationThemeDefinition,
  AtlasStore,
  AtlasStoreEvents,
  AudioSequence,
  AuthAccessState,
  AuthContextActions,
  AuthContextCurrentActions,
  AuthContextState,
  AuthState,
  BoxSelector,
  BoxStyle,
  CanvasPanelProps,
  ChoiceEvents,
  ComplexTimelineStrategy,
  ControlsContext,
  CreateAtlasStoreProps,
  CreateCustomShapeProps,
  EasingInput,
  EasingPreset,
  EmptyStrategy,
  ImageProps,
  ImageServiceLoaderType,
  ImageServiceRequestOptions,
  ImageStrategyProps,
  ImageWithOptionalService,
  MediaPlayerActions,
  MediaPlayerState,
  MediaStrategy,
  MetadataProps,
  ParsedSelector,
  PointSelector,
  PolygonSelectorProps,
  ProbeStore,
  Rect,
  RenderContextProps,
  RenderingStrategy,
  ResourceContextType,
  ResourceRequestOptions,
  RotationSelector,
  SVGTheme,
  SelectorElement,
  SelectorHelperEventTypes,
  SelectorStyle,
  SelectorTransform,
  SimpleViewerActions,
  SimpleViewerActionsType,
  SimpleViewerContext,
  SimpleViewerProps,
  SimpleViewerReducerState,
  Single3DModelStrategy,
  SingleAudio,
  SingleImageStrategy,
  SingleVideo,
  SingleYouTubeVideo,
  StrategyActions,
  StrategyContext,
  SupportedSelector,
  SupportedSelectors,
  SupportedTarget,
  SvgSelector,
  SvgShapeType,
  SvgTheme,
  TemporalBoxSelector,
  TemporalSelector,
  TextContent,
  TextualContentStrategy,
  TimelineKeyframe,
  TransformPoint,
  TransformUnit,
  Transition,
  UnknownStrategy,
  UseRenderingStrategy,
  UseRenderingStrategyOptions,
  UseViewportScrollOptions,
  UseViewportTourOptions,
  VaultActivatedAnnotation,
  VideoSequence,
} from '../src';

import * as root from '../src';
import * as p4 from '../src/presentation-4';
import type { Reference, RangeNormalized, ManifestNormalized } from '../src';
import type { RangeNormalized as Range4, ManifestNormalized as Manifest4 } from '../src/presentation-4';
import type { PointSelector as HelperPoint, SvgSelector as HelperSvg } from '@iiif/helpers/annotation-targets';

// Compile-only consumers; never invoke hooks outside React.
function legacySignatures(optionalVault?: root.Vault) {
  root.useExistingVault(optionalVault) satisfies root.Vault;
  root.useExistingVault(undefined) satisfies root.Vault;
  root.useCanvasSequence({}).items satisfies Reference<'Canvas'>[];
  root.useContainerSequence({}).items satisfies { id: string; type: 'Canvas' | 'Timeline' }[];
  p4.useCanvasSequence({}).items satisfies { id: string; type: 'Canvas' | 'Timeline' }[];
  root.ImageService satisfies typeof import('../src/components/ImageService').ImageService;
  root.ResourceProvider satisfies typeof import('../src/context/ResourceContext').ResourceProvider;
}
function ranges(vault: root.Vault, manifest: ManifestNormalized, range: RangeNormalized, vault4: p4.Vault, manifest4: Manifest4, range4: Range4) {
  root.findManifestSelectedRange(vault, manifest, 'canvas') satisfies RangeNormalized | null;
  root.findSelectedRange(vault, range, 'canvas') satisfies RangeNormalized | null;
  p4.findManifestSelectedRange(vault4, manifest4, 'canvas') satisfies Range4 | null;
  p4.findSelectedRange(vault4, range4, 'canvas') satisfies Range4 | null;
}
function selectors(point: root.PointSelector, svg: root.SvgSelector) {
  point satisfies HelperPoint;
  svg satisfies HelperSvg;
}

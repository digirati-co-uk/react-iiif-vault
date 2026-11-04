import { upgrade as parserUpgrade } from '@iiif/parser/upgrader';
import { Traverse as ParserTraverse } from '@iiif/parser/presentation-3';
import type { Presentation3Resource as ParserPresentation3Resource } from '@iiif/parser/presentation-3';
import type {
  Annotation,
  AnnotationCollection,
  AnnotationPage,
  Canvas,
  ChoiceBody,
  ChoiceTarget,
  Collection,
  ContentResource,
  Manifest,
  NavPlaceExtension,
  Range,
  ResourceProvider,
  Service,
  SpecificResource,
} from '@iiif/parser/presentation-3/types';

export type GeoJSON = NonNullable<NavPlaceExtension['navPlace']>;

export { createThumbnailHelper, imageServiceLoader } from '@iiif/helpers/thumbnail';
export { fetch } from '@iiif/helpers/fetch';
export { getAvailableLanguagesFromResource, getValue } from '@iiif/helpers/i18n';
export { decodeContentState, encodeContentState } from '@iiif/helpers/content-state';
export { parseSelector } from '@iiif/helpers/annotation-targets';
export type { ParsedSelector, SupportedSelector, SupportedTarget } from '@iiif/helpers/annotation-targets';
export { createRangeHelper } from '@iiif/helpers/ranges';
export type { RangeTableOfContentsNode } from '@iiif/helpers/ranges';
export { createPaintingAnnotationsHelper } from '@iiif/helpers/painting-annotations';
export { serialize, serializeConfigPresentation2, serializeConfigPresentation3 } from '@iiif/parser/presentation-3';
export type { SerializeConfig } from '@iiif/parser/presentation-3';

export type { Presentation3Resource, TraversalContext, Traversal, AllTraversal, TraversalMap, TraverseOptions } from '@iiif/parser/presentation-3';
export type TraverseConstructor = typeof ParserTraverse;
export const Traverse: typeof ParserTraverse = ParserTraverse;

export const upgrade: (entity: unknown) => Manifest | Collection = parserUpgrade;

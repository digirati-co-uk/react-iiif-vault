import { upgrade as parserUpgrade } from '@iiif/parser/upgrader';
import { Traverse as ParserTraverse } from '@iiif/parser/presentation-3';
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

export type Presentation3Resource =
  | Collection
  | Manifest
  | Canvas
  | AnnotationCollection
  | AnnotationPage
  | Annotation
  | ContentResource
  | ChoiceTarget
  | ChoiceBody
  | Range
  | Service
  | ResourceProvider
  | SpecificResource
  | GeoJSON;

export type TraversalContext = {
  parent?: Presentation3Resource;
};

export type Traversal<Resource extends Presentation3Resource = Presentation3Resource> = (
  resource: Resource,
  context: TraversalContext
) => Resource | void;

export type AllTraversal = <Resource extends Presentation3Resource>(
  resource: Resource,
  context?: TraversalContext
) => Resource | void;

export type TraversalMap = {
  collection?: Array<Traversal<Collection>>;
  manifest?: Array<Traversal<Manifest>>;
  canvas?: Array<Traversal<Canvas>>;
  annotationCollection?: Array<Traversal<AnnotationCollection>>;
  annotationPage?: Array<Traversal<AnnotationPage>>;
  annotation?: Array<Traversal<Annotation>>;
  contentResource?: Array<Traversal<ContentResource>>;
  choice?: Array<Traversal<ChoiceTarget | ChoiceBody>>;
  range?: Array<Traversal<Range>>;
  service?: Array<Traversal<Service>>;
  agent?: Array<Traversal<ResourceProvider>>;
  specificResource?: Array<Traversal<SpecificResource>>;
  geoJson?: Array<Traversal<GeoJSON>>;
};

export type TraverseOptions = {
  allowUndefinedReturn: boolean;
};

export interface Traverse {
  traverseCollection(resource: Collection, parent?: Presentation3Resource): Collection;
  traverseManifest(resource: Manifest, parent?: Presentation3Resource): Manifest;
  traverseCanvas(resource: Canvas, parent?: Presentation3Resource): Canvas;
  traverseGeoJson(resource: GeoJSON, parent?: Presentation3Resource): GeoJSON;
  traverseAnnotationPage(resource: AnnotationPage, parent?: Presentation3Resource): AnnotationPage;
  traverseAnnotation(resource: Annotation, parent?: Presentation3Resource): Annotation;
  traverseContentResource(resource: ContentResource, parent?: Presentation3Resource): ContentResource;
  traverseSpecificResource(
    resource: SpecificResource,
    typeHint?: string,
    parent?: Presentation3Resource
  ): SpecificResource;
  traverseRange(resource: Range, parent?: Presentation3Resource): Range;
  traverseAgent(resource: ResourceProvider, parent?: Presentation3Resource): ResourceProvider;
  traverseService(resource: Service, parent?: Presentation3Resource): Service;
  traverseUnknown(
    resource: unknown,
    options?: { parent?: Presentation3Resource; typeHint?: string }
  ): Presentation3Resource;
}

export interface TraverseConstructor {
  new (traversals: TraversalMap, options?: Partial<TraverseOptions>): Traverse;
  all(traversal: AllTraversal): Traverse;
}

export const Traverse: TraverseConstructor = ParserTraverse;

export const upgrade: (entity: unknown) => Manifest | Collection = parserUpgrade;

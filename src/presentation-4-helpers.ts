import { createActivationsHelper } from '@iiif/helpers/activations';
import { createSceneHelper } from '@iiif/helpers/scenes';
import {
  Traverse as ParserTraverse,
  traverse as parserTraverse,
  upgradePresentation3To4 as parserUpgradePresentation3To4,
  upgradeToPresentation4 as parserUpgradeToPresentation4,
} from '@iiif/parser/presentation-4';
import type {
  Agent,
  Annotation,
  AnnotationCollection,
  AnnotationPage,
  Canvas,
  Collection,
  CollectionPage,
  ContentResourceLike,
  Manifest,
  Quantity,
  Range,
  Scene,
  Selector,
  Service,
  SpecificResource,
  Timeline,
  Transform,
} from '@iiif/parser/presentation-4/types';
import type { Collection as Collection3, Manifest as Manifest3 } from '@iiif/parser/presentation-3/types';
import type { Collection as Collection2, Manifest as Manifest2 } from '@iiif/parser/presentation-2/types';

export { createThumbnailHelper, imageServiceLoader } from '@iiif/helpers/thumbnail';
export { getAvailableLanguagesFromResource, getValue } from '@iiif/helpers/i18n';
export { decodeContentState, encodeContentState } from '@iiif/helpers/content-state';
export { parseSelector } from '@iiif/helpers/annotation-targets';
export type { ParsedSelector, SupportedSelector, SupportedTarget } from '@iiif/helpers/annotation-targets';
export { createRangeHelper } from '@iiif/helpers/ranges';
export type { RangeTableOfContentsNode } from '@iiif/helpers/ranges';
export { createPaintingAnnotationsHelper } from '@iiif/helpers/painting-annotations';
export { createActivationsHelper, createSceneHelper };
export {
  createSerializeConfigPresentation4,
  serialize,
  serializeConfigPresentation3,
  serializeConfigPresentation4,
} from '@iiif/parser/presentation-4';
export type { SerializeConfig, SerializePresentation4Options } from '@iiif/parser/presentation-4';

export type Presentation4Resource =
  | Collection
  | CollectionPage
  | Manifest
  | Timeline
  | Canvas
  | Scene
  | AnnotationPage
  | AnnotationCollection
  | Annotation
  | ContentResourceLike
  | Range
  | Service
  | Agent
  | SpecificResource
  | Selector
  | Quantity
  | Transform;

export type TraversalContext = {
  parent?: Presentation4Resource;
  path: string;
  typeHint?: string;
};

export type Traversal<Resource extends Presentation4Resource = Presentation4Resource> = (
  resource: Resource,
  context: TraversalContext
) => Resource | void;

export type AllTraversal = <Resource extends Presentation4Resource>(
  resource: Resource,
  context: TraversalContext
) => Resource | void;

export type TraversalMap = {
  collection?: Array<Traversal<Collection>>;
  collectionPage?: Array<Traversal<CollectionPage>>;
  manifest?: Array<Traversal<Manifest>>;
  timeline?: Array<Traversal<Timeline>>;
  canvas?: Array<Traversal<Canvas>>;
  scene?: Array<Traversal<Scene>>;
  annotationCollection?: Array<Traversal<AnnotationCollection>>;
  annotationPage?: Array<Traversal<AnnotationPage>>;
  annotation?: Array<Traversal<Annotation>>;
  contentResource?: Array<Traversal<ContentResourceLike>>;
  range?: Array<Traversal<Range>>;
  service?: Array<Traversal<Service>>;
  agent?: Array<Traversal<Agent>>;
  specificResource?: Array<Traversal<SpecificResource>>;
  selector?: Array<Traversal<Selector>>;
  quantity?: Array<Traversal<Quantity>>;
  transform?: Array<Traversal<Transform>>;
};

export type TraverseOptions = {
  allowUndefinedReturn: boolean;
  coerceContainerTargetsToSpecificResources: boolean;
  legacyPresentation3Behavior: boolean;
  coerceLegacyPointSelectorTime: boolean;
};

export interface Traverse {
  traverseCollection(resource: Collection, parent?: Presentation4Resource, path?: string): Collection;
  traverseCollectionPage(resource: CollectionPage, parent?: Presentation4Resource, path?: string): CollectionPage;
  traverseManifest(resource: Manifest, parent?: Presentation4Resource, path?: string): Manifest;
  traverseTimeline(resource: Timeline, parent?: Presentation4Resource, path?: string): Timeline;
  traverseCanvas(resource: Canvas, parent?: Presentation4Resource, path?: string): Canvas;
  traverseScene(resource: Scene, parent?: Presentation4Resource, path?: string): Scene;
  traverseAnnotationPage(resource: AnnotationPage, parent?: Presentation4Resource, path?: string): AnnotationPage;
  traverseAnnotationCollection(
    resource: AnnotationCollection,
    parent?: Presentation4Resource,
    path?: string
  ): AnnotationCollection;
  traverseAnnotation(resource: Annotation, parent?: Presentation4Resource, path?: string): Annotation;
  traverseSelector(resource: Selector, parent?: Presentation4Resource, path?: string): Selector;
  traverseQuantity(resource: Quantity, parent?: Presentation4Resource, path?: string): Quantity;
  traverseTransform(resource: Transform, parent?: Presentation4Resource, path?: string): Transform;
  traverseSpecificResource(
    resource: SpecificResource,
    typeHint?: string,
    parent?: Presentation4Resource,
    path?: string
  ): SpecificResource;
  traverseContentResource(
    resource: ContentResourceLike,
    parent?: Presentation4Resource,
    path?: string
  ): ContentResourceLike;
  traverseRange(resource: Range, parent?: Presentation4Resource, path?: string): Range;
  traverseAgent(resource: Agent, parent?: Presentation4Resource, path?: string): Agent;
  traverseService(resource: Service, parent?: Presentation4Resource, path?: string): Service;
  traverseUnknown(
    resource: unknown,
    options: { parent?: Presentation4Resource; path: string; typeHint?: string }
  ): Presentation4Resource;
}

export interface TraverseConstructor {
  new (traversals?: TraversalMap, options?: Partial<TraverseOptions>): Traverse;
  all(traversal: AllTraversal): Traverse;
}

export const Traverse: TraverseConstructor = ParserTraverse;
export const traverse: Traverse = parserTraverse;

export interface UpgradePresentation3To4 {
  (entity: Manifest3): Manifest;
  (entity: Collection3): Collection;
  (entity: unknown): Manifest | Collection;
}

export interface UpgradeToPresentation4 extends UpgradePresentation3To4 {
  (entity: Manifest): Manifest;
  (entity: Collection): Collection;
  (entity: Manifest2): Manifest;
  (entity: Collection2): Collection;
  (entity: unknown): Manifest | Collection;
}

export const upgradePresentation3To4: UpgradePresentation3To4 = parserUpgradePresentation3To4;
export const upgradeToPresentation4: UpgradeToPresentation4 = parserUpgradeToPresentation4;
export const upgrade = upgradeToPresentation4;

export function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Manifest | Collection> {
  return globalThis
    .fetch(input, init)
    .then((response) => response.json())
    .then(parserUpgradeToPresentation4);
}

export { fetch as fetchPresentation4 };

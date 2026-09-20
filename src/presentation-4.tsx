import { useContainerSequence } from './viewers/SimpleViewerContext.hooks';
import { useVirtualAnnotationPage as useBaseVirtualAnnotationPage } from './hooks/useVirtualAnnotationPage';
import { VirtualAnnotationPageContext } from './hooks/useVirtualAnnotationPageContext';
import { Vault4, type Vault4Options } from '@iiif/helpers/vault-4';
import type {
  AnnotationNormalized,
  AnnotationPageNormalized,
  CanvasNormalized,
  CollectionNormalized,
  ManifestNormalized,
  RangeNormalized,
} from '@iiif/parser/presentation-4-normalized/types';
import { useContext, useMemo, type DependencyList, type ReactNode } from 'react';
import { VaultProvider as BaseVaultProvider } from './context/VaultContext';
import { VisibleCanvasReactContext } from './context/VisibleCanvasContext';
import { createVaultHooks } from './hooks/createVaultHooks';
import { useExternalResource, type ResourceRequestOptions } from './hooks/useExternalResource';
import { useResourceContext, type ResourceContextType } from './context/ResourceContext';

export * from './shared';
export type * from '@iiif/parser/presentation-4/types';
export type * from '@iiif/parser/presentation-4-normalized/types';
export type {
  AnimationSelector,
  ImageService as IIIFImageService,
  PointSelector,
  PolygonZSelector,
  ResourceProvider as IIIFResourceProvider,
  WktSelector,
} from '@iiif/parser/presentation-4/types';
export { ImageService } from './components/ImageService';
export { ResourceProvider } from './context/ResourceContext';
export { Vault4, Vault4 as Vault } from '@iiif/helpers/vault-4';

const hooks = createVaultHooks(4);

export const useVault = hooks.useVault;
export const useExistingVault = hooks.useExistingVault;
export const useVaultEffect = hooks.useVaultEffect;
export const useVaultSelector = hooks.useVaultSelector;

function useSelectedResource<Resource, Selected>(
  resource: Resource | undefined,
  selector: ((resource: Resource) => Selected) | undefined,
  deps: DependencyList
): Resource | Selected | undefined {
  return useMemo(() => (resource && selector ? selector(resource) : resource), [resource, selector, ...deps]);
}

export function useManifest(options?: { id?: string; selector?: undefined }): ManifestNormalized | undefined;
export function useManifest<Selected>(
  options: { id?: string; selector: (manifest: ManifestNormalized) => Selected },
  deps?: DependencyList
): Selected | undefined;
export function useManifest<Selected>(
  { id, selector }: { id?: string; selector?: (manifest: ManifestNormalized) => Selected } = {},
  deps: DependencyList = []
): ManifestNormalized | Selected | undefined {
  const context = useResourceContext();
  const manifestId = id || context.manifest;
  const manifest = hooks.useVaultSelector(
    (state, vault) =>
      manifestId && state.iiif.mapping[manifestId] === 'Manifest'
        ? vault.get({ id: manifestId, type: 'Manifest' })
        : undefined,
    [manifestId]
  );
  return useSelectedResource(manifest, selector, deps);
}

export function useCollection(options?: { id?: string; selector?: undefined }): CollectionNormalized | undefined;
export function useCollection<Selected>(
  options: { id?: string; selector: (collection: CollectionNormalized) => Selected },
  deps?: DependencyList
): Selected | undefined;
export function useCollection<Selected>(
  { id, selector }: { id?: string; selector?: (collection: CollectionNormalized) => Selected } = {},
  deps: DependencyList = []
): CollectionNormalized | Selected | undefined {
  const context = useResourceContext();
  const collectionId = id || context.collection;
  const collection = hooks.useVaultSelector(
    (state, vault) =>
      collectionId && state.iiif.mapping[collectionId] === 'Collection'
        ? vault.get({ id: collectionId, type: 'Collection' })
        : undefined,
    [collectionId]
  );
  return useSelectedResource(collection, selector, deps);
}

export function useCanvas(options?: { id?: string; selector?: undefined }): CanvasNormalized | undefined;
export function useCanvas<Selected>(
  options: { id?: string; selector: (canvas: CanvasNormalized) => Selected },
  deps?: DependencyList
): Selected | undefined;
export function useCanvas<Selected>(
  { id, selector }: { id?: string; selector?: (canvas: CanvasNormalized) => Selected } = {},
  deps: DependencyList = []
): CanvasNormalized | Selected | undefined {
  const context = useResourceContext();
  const canvasId = id || context.canvas;
  const canvas = hooks.useVaultSelector(
    (state, vault) =>
      canvasId && state.iiif.mapping[canvasId] === 'Canvas' ? vault.get({ id: canvasId, type: 'Canvas' }) : undefined,
    [canvasId]
  );
  return useSelectedResource(canvas, selector, deps);
}

export function useAnnotationPage(options?: {
  id?: string;
  selector?: undefined;
}): AnnotationPageNormalized | undefined;
export function useAnnotationPage<Selected>(
  options: { id?: string; selector: (page: AnnotationPageNormalized) => Selected },
  deps?: DependencyList
): Selected | undefined;
export function useAnnotationPage<Selected>(
  { id, selector }: { id?: string; selector?: (page: AnnotationPageNormalized) => Selected } = {},
  deps: DependencyList = []
): AnnotationPageNormalized | Selected | undefined {
  const context = useResourceContext();
  const pageId = id || context.annotationPage;
  const page = hooks.useVaultSelector(
    (state, vault) =>
      pageId && state.iiif.mapping[pageId] === 'AnnotationPage'
        ? vault.get({ id: pageId, type: 'AnnotationPage' })
        : undefined,
    [pageId]
  );
  return useSelectedResource(page, selector, deps);
}

export function useAnnotation(options?: { id?: string; selector?: undefined }): AnnotationNormalized | undefined;
export function useAnnotation<Selected>(
  options: { id?: string; selector: (annotation: AnnotationNormalized) => Selected },
  deps?: DependencyList
): Selected | undefined;
export function useAnnotation<Selected>(
  { id, selector }: { id?: string; selector?: (annotation: AnnotationNormalized) => Selected } = {},
  deps: DependencyList = []
): AnnotationNormalized | Selected | undefined {
  const context = useResourceContext();
  const annotationId = id || context.annotation;
  const annotation = hooks.useVaultSelector(
    (state, vault) =>
      annotationId && state.iiif.mapping[annotationId] === 'Annotation'
        ? vault.get({ id: annotationId, type: 'Annotation' })
        : undefined,
    [annotationId]
  );
  return useSelectedResource(annotation, selector, deps);
}

export function useRange(options?: { id?: string; selector?: undefined }): RangeNormalized | undefined;
export function useRange<Selected>(
  options: { id?: string; selector: (range: RangeNormalized) => Selected },
  deps?: DependencyList
): Selected | undefined;
export function useRange<Selected>(
  { id, selector }: { id?: string; selector?: (range: RangeNormalized) => Selected } = {},
  deps: DependencyList = []
): RangeNormalized | Selected | undefined {
  const context = useResourceContext();
  const rangeId = id || context.range;
  const range = hooks.useVaultSelector(
    (state, vault) =>
      rangeId && state.iiif.mapping[rangeId] === 'Range' ? vault.get({ id: rangeId, type: 'Range' }) : undefined,
    [rangeId]
  );
  return useSelectedResource(range, selector, deps);
}

export function useExternalManifest(idOrRef: string | { id: string; type: string }, options?: ResourceRequestOptions) {
  hooks.useVault();
  const { resource, ...state } = useExternalResource<ManifestNormalized>(idOrRef, options);
  return { ...state, manifest: resource };
}

export function useExternalCollection(
  idOrRef: string | { id: string; type: string },
  options?: ResourceRequestOptions
) {
  hooks.useVault();
  const { resource, ...state } = useExternalResource<CollectionNormalized>(idOrRef, options);
  return { ...state, collection: resource };
}

export function useVisibleCanvases(): CanvasNormalized[] {
  const ids = useContext(VisibleCanvasReactContext);
  return hooks.useVaultSelector(
    (state, vault) =>
      ids.flatMap((id) => (state.iiif.mapping[id] === 'Canvas' ? [vault.get({ id, type: 'Canvas' })] : [])),
    [ids]
  );
}

export type VaultProviderProps = {
  vault?: Vault4;
  useGlobal?: false;
  vaultOptions?: Vault4Options;
  resources?: ResourceContextType;
  children: ReactNode;
};

export function VaultProvider(props: VaultProviderProps) {
  return <BaseVaultProvider {...props} version={4} />;
}

/** Native normalized annotations, without the root hook's legacy target expansion. */
export function usePaintingAnnotations(
  options: { canvasId?: string; enableSingleAnnotation?: boolean } = {}
): AnnotationNormalized[] {
  const context = useResourceContext();
  const id = options.canvasId || context.canvas;
  return hooks.useVaultSelector(
    (state, vault) => {
      if (options.enableSingleAnnotation && context.annotation) {
        return [vault.get({ id: context.annotation, type: 'Annotation' })];
      }
      if (!id) return [];
      const type = state.iiif.mapping[id];
      if (type !== 'Canvas' && type !== 'Timeline') return [];
      const container = type === 'Canvas' ? vault.get({ id, type: 'Canvas' }) : vault.get({ id, type: 'Timeline' });
      return container.items.flatMap((page) =>
        vault
          .get({ id: page.id, type: 'AnnotationPage' })
          .items.map((annotation) => vault.get({ id: annotation.id, type: 'Annotation' }))
      );
    },
    [id, context.annotation, options.enableSingleAnnotation]
  );
}

// Preserve the existing hook's unfiltered behavior; timing filtering is separate work.
export function useAnnotationsAtTime(_time: number, options: { canvasId?: string } = {}): AnnotationNormalized[] {
  return usePaintingAnnotations(options);
}

export function useCanvasSubset(idsOrRefs?: Array<string | { id: string }>) {
  const manifest = useManifest();
  const ids = idsOrRefs?.map((item) => (typeof item === 'string' ? item : item.id));
  return useMemo(
    () => manifest?.items.filter((item) => !ids || ids.includes(item.id)) || [],
    [manifest, ids?.join('/')]
  );
}

function useNativeVirtualPage(page: { id: string } | null) {
  return hooks.useVaultSelector(
    (_state, vault) => (page ? vault.get({ id: page.id, type: 'AnnotationPage' }) : null),
    [page?.id]
  );
}

export function useVirtualAnnotationPage() {
  hooks.useVault();
  const [page, actions] = useBaseVirtualAnnotationPage();
  const nativePage = useNativeVirtualPage(page);
  return [
    nativePage,
    {
      addAnnotation: (annotation: string | { id: string }, atIndex?: number) =>
        actions.addAnnotation(typeof annotation === 'string' ? annotation : annotation.id, atIndex),
      removeAnnotation: (annotation: string | { id: string }) =>
        actions.removeAnnotation(typeof annotation === 'string' ? annotation : annotation.id),
    },
  ] as const;
}

export function useVirtualAnnotationPageContext() {
  const context = useContext(VirtualAnnotationPageContext);
  const page = useNativeVirtualPage(context?.fullPage || null);
  if (!context) throw new Error('VirtualAnnotationProvider not found.');
  return [
    page,
    {
      addAnnotation: (annotation: string | { id: string }, atIndex?: number) =>
        context.addAnnotation(typeof annotation === 'string' ? annotation : annotation.id, atIndex),
      removeAnnotation: (annotation: string | { id: string }) =>
        context.removeAnnotation(typeof annotation === 'string' ? annotation : annotation.id),
    },
  ] as const;
}

/** @deprecated Use useContainerSequence for Canvas and Timeline navigation. */
export const useCanvasSequence = useContainerSequence;

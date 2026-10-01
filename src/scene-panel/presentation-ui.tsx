import { createPaintingAnnotationsHelper } from '@iiif/helpers/painting-annotations';
import { expandTarget } from '@iiif/helpers/annotation-targets';
import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useCreateLocaleString } from '../utility/i18n-utils';
import { sanitizeIiifHtml } from './annotation-sanitizers';
import { getSceneAnnotations } from './annotations';
import { useSceneRuntime, useSceneStore } from './context';

type AuxiliaryKind = 'placeholder' | 'accompanying';

function resolveResource(vault: ReturnType<typeof useSceneRuntime>['vault'], reference: any) {
  if (!reference) return null;
  return (
    vault.get<any>(reference, { skipSelfReturn: false }) ||
    (typeof reference === 'object' && Object.keys(reference).length > 2 ? reference : null)
  );
}

function useAuxiliaryContainer(reference: any) {
  const runtime = useSceneRuntime();
  const vaultState = useSyncExternalStore(
    (listener) => runtime.vault.getStore().subscribe(listener),
    () => runtime.vault.getState(),
    () => runtime.vault.getState()
  );
  const container = useMemo(() => resolveResource(runtime.vault, reference), [reference, runtime.vault, vaultState]);
  const id = typeof reference === 'string' ? reference : reference?.id;
  useEffect(() => {
    if (!id || container) return;
    let active = true;
    runtime.vault.load<any>(id).catch((cause) => {
      if (active)
        runtime.diagnostic({
          code: 'auxiliary-container-load-failed',
          severity: 'warning',
          message: `Failed to load auxiliary Container ${id}`,
          resourceId: id,
          cause,
        });
    });
    return () => {
      active = false;
    };
  }, [container, id, runtime]);
  return container;
}

function safeMediaSource(value: unknown) {
  if (typeof value !== 'string' || /^\s*(?:javascript|vbscript):/i.test(value)) return '';
  return value;
}

function targetStyle(target: unknown, container: any): React.CSSProperties | undefined {
  if (container.type !== 'Canvas') return undefined;
  let spatial = (target as any)?.spatial;
  try {
    spatial ||= expandTarget(target as any, { defaultType: 'Canvas' })?.selector?.spatial;
  } catch {
    return undefined;
  }
  const width = Number(container.width || 0);
  const height = Number(container.height || 0);
  if (!spatial || width <= 0 || height <= 0) return { inset: 0 };
  return {
    left: `${(Number(spatial.x || 0) / width) * 100}%`,
    top: `${(Number(spatial.y || 0) / height) * 100}%`,
    width: `${(Number(spatial.width || width) / width) * 100}%`,
    height: `${(Number(spatial.height || height) / height) * 100}%`,
  };
}

function AuxiliaryBody({ item, container }: { item: any; container: any }) {
  const createLocaleString = useCreateLocaleString();
  const resource = item.resource;
  const label = createLocaleString(resource.label, '', ' ');
  const source = safeMediaSource(resource.id);
  const className = 'riv-scene-container-body';
  const style = targetStyle(item.target, container);

  if (resource.type === 'Image' && source) return <img className={className} style={style} src={source} alt={label} />;
  if (resource.type === 'Video' && source)
    return <video className={className} style={style} src={source} aria-label={label || undefined} controls />;
  if ((resource.type === 'Sound' || resource.type === 'Audio') && source)
    return <audio className={className} src={source} aria-label={label || undefined} controls />;
  if (resource.type === 'Svg' || resource.format === 'image/svg+xml') {
    const svgSource = resource.value
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(String(resource.value))}`
      : source;
    return svgSource ? <img className={className} style={style} src={svgSource} alt={label} /> : null;
  }
  if (resource.type === 'TextualBody' || resource.type === 'Text') {
    const value = String(resource.value || '');
    const html = resource.format === 'text/html' ? sanitizeIiifHtml(value) : '';
    return (
      <div className={`${className} riv-scene-container-text`} style={style}>
        {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : value}
      </div>
    );
  }
  return source ? (
    <a className={className} href={source}>
      {label || source}
    </a>
  ) : null;
}

export function SceneAuxiliaryContainer({ kind, reference }: { kind: AuxiliaryKind; reference: any }) {
  const runtime = useSceneRuntime();
  const createLocaleString = useCreateLocaleString();
  const container = useAuxiliaryContainer(reference);
  const paintables = useMemo(() => {
    if (!container || !['Canvas', 'Timeline'].includes(container.type)) return [];
    try {
      return createPaintingAnnotationsHelper(runtime.vault).getPaintables(container).items;
    } catch {
      return [];
    }
  }, [container, runtime.vault]);
  if (!container) return null;
  const label = createLocaleString(container.label, kind === 'placeholder' ? 'Scene ready to play' : '', ' ');
  const width = Number(container.width || 0);
  const height = Number(container.height || 0);
  const contents = (
    <figure className={`riv-scene-container riv-scene-container-${container.type.toLowerCase()}`}>
      {label ? <figcaption>{label}</figcaption> : null}
      <div
        className="riv-scene-container-content"
        style={width > 0 && height > 0 ? { aspectRatio: `${width} / ${height}` } : undefined}
      >
        {paintables.map((item: any, index: number) => (
          <AuxiliaryBody key={`${item.annotationId}-${index}`} item={item} container={container} />
        ))}
      </div>
    </figure>
  );
  return kind === 'placeholder' ? (
    <div className="riv-scene-placeholder" role="status" aria-label="Scene placeholder">
      {contents}
    </div>
  ) : (
    <aside className="riv-scene-accompanying" aria-label="Accompanying content">
      {contents}
    </aside>
  );
}

function requiredStatementResources(runtime: ReturnType<typeof useSceneRuntime>, includePlaceholder: boolean) {
  const state = runtime.store.getState();
  const resources: any[] = [];
  const seen = new Set<any>();
  const add = (input: any) => {
    const resource = resolveResource(runtime.vault, input) || input;
    if (!resource || typeof resource !== 'object') return;
    const identity = resource.id ? `${resource.type || 'Resource'}:${resource.id}` : resource;
    if (seen.has(identity)) return;
    seen.add(identity);
    resources.push(resource);

    if (resource.environmentMap) add(resource.environmentMap);
    if (resource.source) add(resource.source);
    if (resource.body) {
      const bodies = runtime.vault.get<any>(resource.body, { parent: resource, skipSelfReturn: false });
      for (const body of Array.isArray(bodies) ? bodies : bodies ? [bodies] : []) add(body);
    }
    if (resource.type === 'Canvas' || resource.type === 'Timeline') {
      try {
        for (const item of createPaintingAnnotationsHelper(runtime.vault).getPaintables(resource).items) {
          add(item.annotation);
          add(item.resource);
        }
      } catch {
        // Invalid painting content is handled by the Container renderer.
      }
    }
  };
  add(runtime.manifest);
  add(runtime.scene);
  for (const [path, status] of Object.entries(state.resourceStatuses)) {
    if (state.resources[path]?.hidden) continue;
    add(status.annotationId);
    add(status.resourceId);
  }
  if (runtime.annotations === 'auto' && state.annotationVisible) {
    for (const annotation of getSceneAnnotations(runtime.vault, runtime.scene, runtime.manifest)) {
      add(annotation);
    }
  }
  const references = [
    ...(includePlaceholder ? [runtime.scene.placeholderContainer] : []),
    runtime.scene.accompanyingContainer,
  ];
  for (const reference of references) {
    const container = resolveResource(runtime.vault, reference);
    if (!container) continue;
    add(container);
  }
  return resources.filter((resource) => resource.requiredStatement);
}

function RequiredStatement({ resource }: { resource: any }) {
  const createLocaleString = useCreateLocaleString();
  const statement = resource.requiredStatement;
  const label = createLocaleString(statement.label, 'Required statement', ' ');
  const resourceLabel = createLocaleString(resource.label, '', ' ');
  const value = createLocaleString(statement.value, '', '\n');
  const html = sanitizeIiifHtml(value);
  return (
    <article className="riv-scene-required-statement" data-resource-id={resource.id}>
      <strong>
        {label || 'Required statement'}
        {resourceLabel ? ` — ${resourceLabel}` : ''}
      </strong>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

export function SceneRequiredStatements({ includePlaceholder }: { includePlaceholder: boolean }) {
  const runtime = useSceneRuntime();
  const [dismissedScene, setDismissedScene] = React.useState<string | null>(null);
  const resources = useSceneStore((state) => ({
    resourceStatuses: state.resourceStatuses,
    resources: state.resources,
    annotationVisible: state.annotationVisible,
  }));
  const vaultState = useSyncExternalStore(
    (listener) => runtime.vault.getStore().subscribe(listener),
    () => runtime.vault.getState(),
    () => runtime.vault.getState()
  );
  const statements = useMemo(
    () => requiredStatementResources(runtime, includePlaceholder),
    [includePlaceholder, resources, runtime, vaultState]
  );
  if (!statements.length || dismissedScene === runtime.scene.id) return null;
  return (
    <section className="riv-scene-required-statements" aria-label="Required statements">
      <button
        type="button"
        className="riv-scene-required-statements-close"
        aria-label="Dismiss required statements"
        onClick={() => setDismissedScene(runtime.scene.id)}
      >
        ×
      </button>
      {statements.map((resource, index) => (
        <RequiredStatement
          key={resource.id ? `${resource.type}:${resource.id}` : `embedded:${index}`}
          resource={resource}
        />
      ))}
    </section>
  );
}

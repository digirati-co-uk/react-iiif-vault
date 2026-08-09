import { resolveAnnotationValues } from '@iiif/helpers';
import { expandTarget, resolveSelectorStyle } from '@iiif/helpers/annotation-targets';
import { parseSceneTarget, type GeoJSONGeometry } from '@iiif/helpers/scenes';
import type { AnnotationNormalized } from '@iiif/parser/presentation-4-normalized/types';
import { Html } from '@react-three/drei';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { Vector3 } from 'three';
import { DefaultMarker, GeometryMarker, SvgAnnotationMarker, geometryPoints } from './annotation-markers';
import { prepareSvgAnnotationSelector, sanitizeIiifHtml } from './annotation-sanitizers';
import { useSceneRuntime, useSceneStore } from './context';
import { isTemporallyVisible } from './timing';
import type { Annotation3DProps, AnnotationMarkerProps, AnnotationPage3DProps, AnnotationPopoverProps } from './types';

export { prepareSvgAnnotationSelector, sanitizeIiifHtml, sanitizeSvgSelector } from './annotation-sanitizers';
export { createGeometryMarkerBuffers, GeometryMarker } from './annotation-markers';

function hydrateAnnotation(runtime: ReturnType<typeof useSceneRuntime>, input: Annotation3DProps['annotation']) {
  const id = typeof input === 'string' ? input : input.id;
  let annotation = runtime.vault.get<any>(id) as AnnotationNormalized | undefined;
  if (!annotation && typeof input === 'object' && Object.keys(input).length > 2) {
    annotation = runtime.vault.loadSync<any>(id, input) as AnnotationNormalized | undefined;
  }
  return annotation;
}

function hydrateTarget(runtime: ReturnType<typeof useSceneRuntime>, annotation: AnnotationNormalized, target: unknown) {
  return (
    runtime.vault.get<any>(target as any, {
      parent: annotation,
      skipSelfReturn: false,
      preserveSpecificResources: true,
    }) || target
  );
}

function geometryCenter(geometry: GeoJSONGeometry | null): [number, number, number] | null {
  if (!geometry) return null;
  const points = geometryPoints(geometry);
  if (!points.length) return null;
  const minimum = [...points[0]];
  const maximum = [...points[0]];
  for (const point of points.slice(1)) {
    for (let axis = 0; axis < 3; axis++) {
      minimum[axis] = Math.min(minimum[axis], point[axis]);
      maximum[axis] = Math.max(maximum[axis], point[axis]);
    }
  }
  return minimum.map((value, axis) => (value + maximum[axis]) / 2) as [number, number, number];
}

function resolvePopoverPoint(
  runtime: ReturnType<typeof useSceneRuntime>,
  annotation: AnnotationNormalized,
  fallback: [number, number, number]
): [number, number, number] {
  const target = parseSceneTarget(
    hydrateTarget(runtime, annotation, (annotation as any).position || annotation.target),
    {
      id: runtime.scene.id,
      type: 'Scene',
    }
  );
  return [
    ...(target.point || geometryCenter(target.geometry) || runtime.resolvePoint(target.source.id) || fallback),
  ] as [number, number, number];
}

export function Annotation3D({
  annotation: input,
  marker: Marker,
  popover: Popover,
  children,
  onSelect,
  instancePath,
}: Annotation3DProps) {
  const runtime = useSceneRuntime();
  const annotation = hydrateAnnotation(runtime, input);
  const marker = Marker === undefined ? runtime.annotationMarker : Marker;
  const popover = Popover === undefined ? runtime.annotationPopover : Popover;
  return annotation ? (
    <ResolvedAnnotation3D
      annotation={annotation}
      marker={marker}
      popover={popover}
      onSelect={onSelect}
      instancePath={instancePath}
    >
      {children}
    </ResolvedAnnotation3D>
  ) : null;
}

function ResolvedAnnotation3D({
  annotation,
  marker: Marker,
  popover: Popover,
  children,
  onSelect,
  instancePath,
}: Omit<Annotation3DProps, 'annotation'> & { annotation: AnnotationNormalized }) {
  const runtime = useSceneRuntime();
  const selectedId = useSceneStore((state) => state.selectedAnnotation);
  const selectedPath = useSceneStore((state) => state.selectedAnnotationPath);
  const time = useSceneStore((state) => state.time);
  const annotationVisible = useSceneStore((state) => state.annotationVisible);

  // A missing target is not shorthand for the Scene origin. Keep the annotation
  // available to host UI through useSceneAnnotations(), but do not register or
  // draw it until the application gives it spatial meaning.
  const hasTarget =
    !!annotation.target &&
    (Array.isArray(annotation.target)
      ? annotation.target.length > 0
      : annotation.target.type !== 'List' ||
        ('items' in annotation.target && Array.isArray(annotation.target.items) && annotation.target.items.length > 0));
  const hydratedTarget = hydrateTarget(runtime, annotation, annotation.target);
  const target = parseSceneTarget(hydratedTarget, { id: runtime.scene.id, type: 'Scene' });
  const svg = useMemo(
    () => resolveSvgSelector(runtime, annotation, hydratedTarget),
    [annotation, hydratedTarget, runtime.vault]
  );
  const registeredPoint = useSceneStore((state) => {
    if (!hasTarget || target.point || target.geometry || svg || !state.idIndex[target.source.id]?.length) return null;
    return runtime.resolvePoint(target.source.id);
  });
  const spatial = hasTarget && !!(target.point || target.geometry || svg || registeredPoint);
  const point = [...(target.point || geometryCenter(target.geometry) || registeredPoint || [0, 0, 0])] as [
    number,
    number,
    number,
  ];
  const path = `${instancePath || runtime.scene.id}/supplementary/${annotation.id}`;
  const resourceState = useSceneStore((state) => state.resources[path]);
  const selected = selectedId === annotation.id && (!selectedPath || selectedPath === path);
  const group = useRef<Group>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasSelected = useRef(false);
  const visible = annotationVisible && !resourceState?.hidden && isTemporallyVisible(time, target.temporal);
  const activate = () => {
    if (resourceState?.disabled) return;
    runtime.selectAnnotation({ id: annotation.id, path });
    onSelect?.(annotation as any);
  };
  const markerProps: AnnotationMarkerProps = {
    annotation: annotation as any,
    point,
    selected,
    size: runtime.annotationMarkerSize,
    activate,
  };
  const popoverPoint = resolvePopoverPoint(runtime, annotation, point);

  useEffect(() => {
    if (wasSelected.current && !selected) trigger.current?.focus();
    wasSelected.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!hasTarget) return;
    return runtime.register({
      path,
      ids: [annotation.id],
      type: 'annotation',
      supportedActions: ['show', 'hide', 'enable', 'disable', 'select'],
      frameable: false,
      instancePath: instancePath || runtime.scene.id,
      annotationId: annotation.id,
      getBounds: () => {
        const object = group.current;
        if (!object) return point;
        object.updateWorldMatrix(true, false);
        return new Vector3(...point).applyMatrix4(object.matrixWorld).toArray();
      },
    });
  }, [annotation.id, hasTarget, path, point[0], point[1], point[2], runtime.register]);

  if (!spatial) return null;
  return (
    <group ref={group}>
      {visible ? (
        <>
          {children ? (
            children(markerProps)
          ) : Marker === false ? null : Marker ? (
            <Marker {...markerProps} />
          ) : svg ? (
            <SvgAnnotationMarker selector={svg} point={point} selected={selected} activate={activate} />
          ) : target.geometry ? (
            <GeometryMarker
              geometry={target.geometry}
              selected={selected}
              size={runtime.annotationMarkerSize}
              activate={activate}
            />
          ) : (
            <DefaultMarker {...markerProps} />
          )}
          <Html position={point} wrapperClass="riv-scene-annotation-accessibility">
            <button
              ref={trigger}
              type="button"
              className="riv-scene-sr-only"
              onClick={(event) => {
                event.stopPropagation();
                activate();
              }}
            >
              {languageText((annotation as any).label) || 'Open annotation'}
            </button>
          </Html>
          {selected && Popover !== false ? (
            Popover ? (
              <Popover
                annotation={annotation as any}
                point={popoverPoint}
                selected
                close={() => runtime.selectAnnotation(null)}
              />
            ) : (
              <DefaultPopover
                annotation={annotation as any}
                point={popoverPoint}
                selected
                close={() => runtime.selectAnnotation(null)}
              />
            )
          ) : null}
        </>
      ) : null}
    </group>
  );
}

function stylesheetMap(runtime: ReturnType<typeof useSceneRuntime>, annotation: AnnotationNormalized) {
  const output: Record<string, string> = {};
  const sheets = Array.isArray((annotation as any).stylesheet)
    ? (annotation as any).stylesheet
    : (annotation as any).stylesheet
      ? [(annotation as any).stylesheet]
      : [];
  for (const reference of sheets) {
    const sheet = runtime.vault.get<any>(reference, { skipSelfReturn: false }) || reference;
    if (sheet?.type === 'CssStylesheet' && sheet.value)
      output[sheet.id || `inline-${Object.keys(output).length}`] = Array.isArray(sheet.value)
        ? sheet.value.join('\n')
        : String(sheet.value);
  }
  return output;
}

function resolveSvgSelector(
  runtime: ReturnType<typeof useSceneRuntime>,
  annotation: AnnotationNormalized,
  target: any
) {
  const selectors = parseSceneTarget(target, { id: runtime.scene.id, type: 'Scene' }).selectors;
  const raw = selectors.flat().find((selector: any) => selector.type === 'SvgSelector') as any;
  if (!raw) return null;
  try {
    const loadedStylesheets = stylesheetMap(runtime, annotation);
    const expanded = expandTarget(
      {
        type: 'SpecificResource',
        source: { id: runtime.scene.id, type: 'Scene' },
        styleClass: target?.styleClass,
        selector: raw,
      } as any,
      {
        defaultType: 'Scene',
        loadedStylesheets,
      }
    ) as any;
    if (expanded.selector?.type !== 'SvgSelector') return null;
    return prepareSvgAnnotationSelector(
      {
        ...expanded.selector,
        // Intrinsic SVG paint belongs in the SVG. Only the target's IIIF
        // stylesheet class should affect the surrounding annotation surface.
        boxStyle: resolveSelectorStyle(target?.styleClass, loadedStylesheets),
      },
      raw
    );
  } catch {
    return null;
  }
}

function annotationBody(runtime: ReturnType<typeof useSceneRuntime>, annotation: AnnotationNormalized) {
  const hydrated = runtime.vault.get<any>(annotation.body as any, {
    parent: annotation,
    skipSelfReturn: false,
    preserveSpecificResources: true,
  });
  const inputs = [hydrated, annotation.body].filter(Boolean);
  for (const input of inputs) {
    for (const { value, specificResources } of resolveAnnotationValues(input)) {
      let body =
        runtime.vault.get<any>(value as any, {
          parent: annotation,
          skipSelfReturn: false,
          preserveSpecificResources: true,
        }) || value;
      const wrapper = specificResources[specificResources.length - 1] as any;
      if (wrapper?.source) body = runtime.vault.get<any>(wrapper.source, { skipSelfReturn: false }) || wrapper.source;
      if (body?.type === 'SpecificResource')
        body = runtime.vault.get<any>(body.source, { skipSelfReturn: false }) || body.source;
      if (body && Object.prototype.hasOwnProperty.call(body, 'value')) return body;
    }
  }
  return null;
}

function languageText(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  return Object.values(value as Record<string, unknown>)
    .flat()
    .map(String)
    .join(' · ');
}

export function dismissAnnotationPopover(event: React.SyntheticEvent, close: () => void) {
  event.preventDefault();
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
  close();
}

function DefaultPopover({ annotation, point, close }: AnnotationPopoverProps) {
  const runtime = useSceneRuntime();
  const body = annotationBody(runtime, annotation);
  const hasValue = body?.value !== null && body?.value !== undefined && String(body.value).trim() !== '';
  const html = hasValue && body?.format === 'text/html' ? sanitizeIiifHtml(String(body.value)) : '';
  const heading = languageText((body as any)?.label) || languageText((annotation as any).label) || 'Annotation';
  const text = hasValue ? String(body.value) : 'No textual body is available for this annotation.';
  const closePopover = (event: React.SyntheticEvent) => dismissAnnotationPopover(event, close);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => dialog.current?.focus(), []);
  return (
    <Html position={point} style={{ transform: 'translate3d(-50%, 18px, 0)' }}>
      <aside
        ref={dialog}
        className="riv-scene-popover"
        role="dialog"
        aria-modal="false"
        aria-label={heading}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') dismissAnnotationPopover(event, close);
        }}
      >
        <button
          type="button"
          className="riv-scene-popover-close"
          aria-label="Close annotation"
          onPointerDown={closePopover}
          onClick={closePopover}
        >
          ×
        </button>
        <strong className="riv-scene-popover-title">{heading}</strong>
        {html ? (
          <div className="riv-scene-popover-body" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="riv-scene-popover-body">{text}</p>
        )}
      </aside>
    </Html>
  );
}

export function AnnotationPage3D({ page: input, ...annotationProps }: AnnotationPage3DProps) {
  const runtime = useSceneRuntime();
  const id = typeof input === 'string' ? input : (input as any).id;
  let page = runtime.vault.get<any>(id);
  if (!page && typeof input === 'object' && Object.keys(input).length > 2) page = runtime.vault.loadSync(id, input);
  const annotations = page ? runtime.vault.get<any>(page.items, { parent: page }) || [] : [];
  return (
    <>
      {annotations.map((annotation: AnnotationNormalized) => (
        <Annotation3D key={annotation.id} annotation={annotation} {...annotationProps} />
      ))}
    </>
  );
}

export function useSceneAnnotations() {
  const runtime = useSceneRuntime();
  return useMemo(() => createSceneAnnotations(runtime), [runtime.scene.id, runtime.vault]);
}

function createSceneAnnotations(runtime: ReturnType<typeof useSceneRuntime>) {
  const pages = runtime.vault.get<any>(runtime.scene.annotations as any, { parent: runtime.scene }) || [];
  return pages
    .flatMap((page: any) => runtime.vault.get<any>(page.items, { parent: page }) || [])
    .filter(isSupplementaryAnnotation);
}

export function isSupplementaryAnnotation(annotation: AnnotationNormalized) {
  const motivations = Array.isArray(annotation.motivation)
    ? annotation.motivation
    : annotation.motivation
      ? [annotation.motivation]
      : [];
  return !motivations.includes('painting') && !motivations.includes('activating');
}

export function useExternalAnnotationPage(id: string) {
  const runtime = useSceneRuntime();
  const cached = runtime.vault.get<any>(id);
  const [loaded, setLoaded] = useState<{ id: string; value: any } | null>(null);
  useEffect(() => {
    if (cached) return;
    let active = true;
    Promise.resolve()
      .then(() => runtime.vault.load(id))
      .then((value) => {
        if (active) setLoaded({ id, value });
      })
      .catch((cause) => {
        if (active)
          runtime.diagnostic({
            code: 'annotation-page-load-failed',
            severity: 'warning',
            message: `Failed to load annotation page ${id}`,
            resourceId: id,
            cause,
          });
      });
    return () => {
      active = false;
    };
  }, [cached, id, runtime.diagnostic, runtime.vault]);
  return cached || (loaded?.id === id ? loaded.value : undefined);
}

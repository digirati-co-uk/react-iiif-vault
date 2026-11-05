import React, { useEffect, useMemo, useState } from 'react';
import { useLoadImageServiceFn, useLoadImageServiceFnSync } from '../context/ImageServicesContext';
import { authDetailsForResource } from '../future-helpers/auth';
import { useAuthResource } from '../hooks/useAuthResource';
import { useSceneRuntime } from './context';

/** Share the enclosing Auth store and keep denied texture loaders unmounted. */
export function CanvasImageAuthGate({
  resource,
  children,
}: {
  resource: any;
  children: (protectedImage: boolean) => React.ReactNode;
}) {
  const { vault, diagnostic } = useSceneRuntime();
  const loadSync = useLoadImageServiceFnSync();
  const load = useLoadImageServiceFn();
  const request = useMemo(() => {
    const services = Array.isArray(resource.service) ? resource.service : resource.service ? [resource.service] : [];
    const hydrated = services.map(
      (reference: any) => vault.get<any>(reference, { skipSelfReturn: false }) || reference
    );
    const service = hydrated.find((value: any) => /ImageService/.test(String(value?.type || value?.['@type'] || '')));
    const size = { width: Number(resource.width || 1), height: Number(resource.height || 1) };
    return { service, size, initial: service ? loadSync(service, size) : null };
  }, [resource, vault, loadSync]);
  const [result, setResult] = useState<{ request: typeof request; service: any }>();
  useEffect(() => {
    let active = true;
    if (request.service && !request.initial) {
      void load(request.service, request.size).then(
        (service) => {
          if (active) setResult({ request, service });
        },
        (cause) => {
          if (active)
            diagnostic({
              code: 'canvas-image-service-load-failed',
              severity: 'warning',
              message: 'The Canvas image service could not be loaded.',
              resourceId: resource.id,
              cause,
            });
        }
      );
    }
    return () => {
      active = false;
    };
  }, [request, load, diagnostic, resource.id]);
  const service = request.initial || (result?.request === request ? result.service : null);
  // Discover Auth in info.json through main's image-service loader before any
  // texture request, including when the manifest contains only a service stub.
  if (request.service && !service) return null;
  const protectedResource = authDetailsForResource(resource).hasAuth
    ? resource
    : service && authDetailsForResource(service).hasAuth
      ? service
      : null;
  return protectedResource ? (
    <ProtectedCanvasImage resource={protectedResource}>{children}</ProtectedCanvasImage>
  ) : (
    children(false)
  );
}

function ProtectedCanvasImage({
  resource,
  children,
}: {
  resource: any;
  children: (protectedImage: boolean) => React.ReactNode;
}) {
  const [, probe] = useAuthResource(resource, { registerOnSuccess: true, scope: 'scene', acceptRedirects: false });
  // Image redirects/substitutes require image-specific selection; never load the
  // original image merely because a Model-style signed location was accepted.
  const allowed =
    probe.status === 'success' && probe.shouldDisplayResource && !probe.shouldRedirect && !probe.shouldSubstitute;
  return allowed ? children(true) : null;
}

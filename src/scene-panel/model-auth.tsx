import React, { createContext, useEffect, useLayoutEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { authDetailsForResource } from '../future-helpers/auth';
import { useAuthResource } from '../hooks/useAuthResource';
import { useSceneRuntime } from './context';
import type { ScenePaintable } from '@iiif/helpers/scenes';
import { disposeProtectedModel, loadProtectedModel } from './protected-model-loader';

export const ProtectedModelContext = createContext<GLTF | null>(null);

/** Kept above model suspension so auth discovery always commits before content GETs. */
export function ModelAuthGate(props: {
  paintable: ScenePaintable;
  path: string;
  children: React.ReactNode;
  loader?: 'gltf' | 'unsupported';
}) {
  if (!authDetailsForResource(props.paintable.resource).hasAuth) return props.children;
  return <ProtectedModelAuthGate {...props} />;
}

function ProtectedModelAuthGate({
  paintable,
  path,
  children,
  loader = 'gltf',
}: {
  paintable: ScenePaintable;
  path: string;
  children: React.ReactNode;
  loader?: 'gltf' | 'unsupported';
}) {
  const [, probe, protectedResource] = useAuthResource(paintable.resource, { registerOnSuccess: true, scope: 'scene' });
  const { setResourceStatus } = useSceneRuntime();
  const { annotationId, rawType } = paintable;
  const resourceId = paintable.resource.id;
  const location = probe.shouldRedirect ? probe.redirectResource : null;
  const format = String((location as { format?: string } | null)?.format || '').toLowerCase();
  const locationServices =
    (location as { service?: unknown; services?: unknown } | null)?.service ||
    (location as { services?: unknown } | null)?.services ||
    [];
  const redirectSupported =
    !!location &&
    location.type === 'Model' &&
    Array.isArray(locationServices) &&
    locationServices.every(
      (service) => service && typeof service === 'object' && service.type !== 'AuthProbeService2'
    ) &&
    (!format || format === 'model/gltf+json' || format === 'model/gltf-binary');
  const allowed =
    probe.status === 'success' &&
    !probe.shouldSubstitute &&
    (probe.shouldRedirect ? redirectSupported : probe.shouldDisplayResource);
  useLayoutEffect(() => {
    if (!protectedResource || (allowed && loader === 'gltf')) return;
    setResourceStatus(path, {
      annotationId,
      resourceId,
      resourceType: rawType,
      status: allowed || (probe.status === 'success' && probe.shouldRedirect) ? 'error' : 'auth-required',
      ...(probe.status === 'success' && probe.shouldRedirect && !redirectSupported
        ? {
            error: {
              code: 'unsupported-model-auth-redirect',
              severity: 'warning' as const,
              message: 'The authorized redirect is not a supported Model or requires another access service.',
              resourceId,
            },
          }
        : allowed && loader === 'unsupported'
          ? {
              error: {
                code: 'unsupported-protected-model-format',
                severity: 'warning' as const,
                message: 'Authenticated models currently require the built-in glTF renderer.',
                resourceId,
              },
            }
          : probe.shouldRedirect || probe.shouldSubstitute
            ? {
                error: {
                  code: 'model-auth-alternative-unsupported',
                  severity: 'warning' as const,
                  message:
                    'This model requires an Auth2 redirect or substitute which the model renderer cannot display safely.',
                  resourceId,
                },
              }
            : {}),
    });
  }, [
    setResourceStatus,
    path,
    annotationId,
    resourceId,
    rawType,
    protectedResource,
    allowed,
    loader,
    redirectSupported,
    probe.status,
    probe.shouldRedirect,
    probe.shouldSubstitute,
  ]);
  if (!protectedResource) return children;
  if (!allowed || loader === 'unsupported') return null;
  // A fresh instance is mounted after each revocation/retry. No protected cache
  // is shared between resources, auth contexts, choices, or session generations.
  return (
    <ProtectedModelLoad
      key={`${resourceId}:${probe.token || ''}:${location?.id || ''}`}
      paintable={paintable}
      path={path}
      loadUrl={location?.id || resourceId}
      credentials={location ? 'omit' : 'include'}
    >
      {children}
    </ProtectedModelLoad>
  );
}

function ProtectedModelLoad({
  paintable,
  path,
  children,
  loadUrl,
  credentials,
}: {
  paintable: ScenePaintable;
  path: string;
  children: React.ReactNode;
  loadUrl: string;
  credentials: 'include' | 'omit';
}) {
  const { setResourceStatus, ktx2TranscoderPath } = useSceneRuntime();
  const { annotationId, rawType } = paintable;
  const resourceId = paintable.resource.id;
  const gl = useThree((state) => state.gl);
  const [result, setResult] = useState<GLTF | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let owned: GLTF | undefined;
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 60000);
    const status = (value: 'loading' | 'error', cause?: unknown) =>
      setResourceStatus(path, {
        annotationId,
        resourceId,
        resourceType: rawType,
        status: value,
        ...(cause
          ? {
              error: {
                code: 'protected-model-load-failed',
                severity: 'warning' as const,
                message: 'Authorized model could not load. Retry access or reselect the model to try again.',
                resourceId,
                cause,
              },
            }
          : {}),
      });
    status('loading');
    const transcoderPath = new URL(ktx2TranscoderPath, globalThis.location?.href).href;
    const ktx = new KTX2Loader().setTranscoderPath(transcoderPath).detectSupport(gl);
    void loadProtectedModel(
      loadUrl,
      controller.signal,
      (loader) => {
        ktx.manager = loader.manager;
        loader.setKTX2Loader(ktx);
      },
      { ktx2TranscoderPath: transcoderPath, credentials }
    )
      .then(
        (gltf) => {
          if (!active) {
            disposeProtectedModel(gltf);
            return;
          }
          owned = gltf;
          setResult(gltf);
        },
        (cause) => {
          if (active) status('error', cause);
        }
      )
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
      ktx.dispose();
      if (owned) disposeProtectedModel(owned);
    };
  }, [resourceId, annotationId, rawType, path, setResourceStatus, ktx2TranscoderPath, gl, loadUrl, credentials]);
  return result ? <ProtectedModelContext.Provider value={result}>{children}</ProtectedModelContext.Provider> : null;
}

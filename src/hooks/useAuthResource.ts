import { useEffect, useMemo, useState } from 'react';
import { authDetailsForResource, createProbe, hasAuth } from '../future-helpers/auth';
import { useStore } from 'zustand';
import { useLoadImageService } from './useLoadImageService';
import { useAuthTokens } from '../context/AuthContext';

export function useAuthResource<T = any>(resource: T) {
  const details = useMemo(() => authDetailsForResource(resource), [resource]);
  const token = useAuthTokens(details.services.access?.id);
  const probeStore = useMemo(() => {
    return createProbe(details.services.probe);
  }, [details.services.probe]);

  const probe = useStore(probeStore);

  useEffect(() => {
    if (probe.status === 'unknown' && !token) {
      probe.probe();
    }
  }, [details.services.probe, probe.status]);

  useEffect(() => {
    if (token) {
      probe.setToken(token);
      probe.probe();
    }
  }, [token]);

  return [resource, probe, details.hasAuth] as const;
}

import { useEffect, useMemo } from 'react';
import { authDetailsForResource, createProbe, getAccessServiceId, type AuthAccessState } from '../future-helpers/auth';
import { useStore } from 'zustand';
import { useAuthStore } from '../context/AuthContext';
import type { AuthAccessService2 } from '@iiif/parser/presentation-3/types';

export function useAuthResource<T = any>(resource: T) {
  const details = useMemo(() => authDetailsForResource(resource), [resource]);
  const authStore = useAuthStore();
  const probeStore = useMemo(() => createProbe(details.services.probe), [details.services.probe]);
  const probe = useStore(probeStore);

  useEffect(() => {
    if (!details.services.probe) return;
    let cancelled = false;
    const registered: AuthAccessService2[] = [];
    const attempted = new Map<string, AuthAccessState['session']>();
    const probeId = details.services.probe.id;

    async function refresh() {
      if (cancelled) return;
      const items = () =>
        registered.map((service) =>
          authStore.getState().authItems.find((item) => item.id === getAccessServiceId(service))
        );
      const token = probeStore.getState().token;
      if (token && !items().some((item) => item?.session?.token === token)) {
        probeStore.setState({ token: null });
        attempted.clear();
        await probeStore.getState().probe();
      }
      if (cancelled || probeStore.getState().status === 'success') return;
      for (const item of items()) {
        if (cancelled) return;
        const session = item?.session;
        if (!item || !session || session.expires <= Date.now() || attempted.get(item.id) === session) continue;
        attempted.set(item.id, session);
        probeStore.getState().setToken(session.token);
        await probeStore.getState().probe();
        if (cancelled || probeStore.getState().status === 'success') return;
      }
      // A valid token may still lack access; offer the next active route.
      const state = authStore.getState();
      if (state.authItems[state.currentAuth]?.isLoggedIn) {
        const next = state.authItems.findIndex(
          (item) =>
            item.type === 'active' &&
            item.instances > 0 &&
            !item.isLoggedIn &&
            registered.some((service) => getAccessServiceId(service) === item.id)
        );
        if (next !== -1) state.setAuth(next);
      }
    }

    async function initialize() {
      await probeStore.getState().probe();
      for (const service of details.services.accessServices) {
        if (cancelled || probeStore.getState().status === 'success') return;
        registered.push(service);
        await authStore.getState().addService(service, probeId);
        await refresh();
      }
    }

    // Serialize token changes with discovery so probes cannot race one another.
    let queue = initialize();
    const unsubscribe = authStore.subscribe((state, previous) => {
      if (
        registered.some((service) => {
          const id = getAccessServiceId(service);
          return (
            state.authItems.find((item) => item.id === id)?.session !==
            previous.authItems.find((item) => item.id === id)?.session
          );
        })
      ) {
        queue = queue.then(refresh);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
      for (const service of registered) authStore.getState().removeService(service, probeId);
    };
  }, [authStore, details, probeStore]);

  return [resource, probe, details.hasAuth] as const;
}

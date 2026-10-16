import { useEffect, useId, useMemo } from 'react';
import { authDetailsForResource, createProbe, getAccessServiceId, getTokenService, type AuthAccessState } from '../future-helpers/auth';
import { useResourceContext } from '../context/ResourceContext';
import { useStore } from 'zustand';
import { useAuthStore } from '../context/AuthContext';

export function useAuthResource<T = any>(resource: T) {
  const key = useId();
  const { canvas: canvasId } = useResourceContext();
  const details = useMemo(() => authDetailsForResource(resource), [resource]);
  const authStore = useAuthStore();
  const probeStore = useMemo(() => createProbe(details.services.probe), [details.services.probe]);
  const probe = useStore(probeStore);

  useEffect(() => {
    if (!details.services.probe) return;
    let cancelled = false;
    let registered = false;
    const services = details.services.accessServices;
    const attempted = new Set<AuthAccessState['session']>();
    const probeId = details.services.probe.id;
    const items = () => services.map((service) => authStore.getState().authItems.find((item) => item.id === getAccessServiceId(service)));
    const publish = () => {
      if (!cancelled) authStore.setState((state) => ({ resources: { ...state.resources, [key]: { resource, canvasId, probe: probeStore.getState() } } }));
    };
    const unsubscribeProbe = probeStore.subscribe(publish);

    async function refresh() {
      if (cancelled) return;
      if (items().some((item) => item?.isPending)) {
        probeStore.setState({ status: 'probing', shouldDisplayResource: false });
        return;
      }
      const token = probeStore.getState().token;
      if (token && !items().some((item) => item?.session?.token === token && item.session.expires > Date.now())) {
        probeStore.setState({ token: null });
        attempted.clear();
        await probeStore.getState().probe();
      }
      if (cancelled || probeStore.getState().status === 'success') return;
      for (const item of items()) {
        if (cancelled) return;
        const session = item?.session;
        if (!session || session.expires <= Date.now() || attempted.has(session)) continue;
        attempted.add(session);
        probeStore.getState().setToken(session.token);
        await probeStore.getState().probe();
        if (cancelled || probeStore.getState().status === 'success') return;
      }
      // A failed interaction still needs a settled item result.
      if (!cancelled && probeStore.getState().status === 'probing') await probeStore.getState().probe();
      const state = authStore.getState();
      if (state.authItems[state.currentAuth]?.isLoggedIn) {
        const next = state.authItems.findIndex((item) => item.type === 'active' && item.instances > 0 && !item.isLoggedIn &&
          services.some((service) => getAccessServiceId(service) === item.id));
        if (next !== -1) state.setAuth(next);
      }
    }

    async function check() {
      if (cancelled) return;
      probeStore.setState({ discovering: true, token: null });
      attempted.clear();
      await probeStore.getState().probe();
      if (cancelled || probeStore.getState().status === 'success') {
        if (!cancelled) probeStore.setState({ discovering: false });
        return;
      }
      if (!registered) {
        registered = true;
        for (const service of services) authStore.getState().addService(service, probeId, false);
      }
      await refresh();
      const triedEndpoints = new Set<string>();
      for (const service of services) {
        if (cancelled || probeStore.getState().status === 'success') break;
        if (service.profile === 'active') continue;
        const endpoint = getTokenService(service)?.id;
        if (!endpoint || triedEndpoints.has(endpoint)) continue;
        triedEndpoints.add(endpoint);
        // Reuse addService's protocol flow without retaining another registration.
        const attempt = authStore.getState().addService(service, probeId);
        authStore.getState().removeService(service, probeId);
        await attempt;
        await refresh();
      }
      if (!cancelled) probeStore.setState({ discovering: false });
    }

    let queue = Promise.resolve();
    const enqueue = (run: () => Promise<void>) => { queue = queue.then(run); return queue; };
    probeStore.setState({ retry: () => enqueue(check) });
    publish();
    const unsubscribe = authStore.subscribe((state, previous) => {
      if (services.some((service) => {
        const id = getAccessServiceId(service);
        const next = state.authItems.find((item) => item.id === id);
        const old = previous.authItems.find((item) => item.id === id);
        return next?.session !== old?.session || next?.isPending !== old?.isPending;
      })) {
        // Hide a previously allowed image immediately when its session is revoked.
        if (probeStore.getState().token && !items().some((item) => item?.session?.token === probeStore.getState().token)) {
          probeStore.setState({ status: 'probing', shouldDisplayResource: false });
        }
        void enqueue(refresh);
      }
    });
    void enqueue(check);
    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeProbe();
      probeStore.getState().cancel();
      if (registered) for (const service of services) authStore.getState().removeService(service, probeId);
      authStore.setState((state) => {
        const resources = { ...state.resources };
        delete resources[key];
        return { resources };
      });
    };
  }, [authStore, canvasId, details, key, probeStore, resource]);

  return [resource, probe, details.hasAuth] as const;
}

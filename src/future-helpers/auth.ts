import {
  Auth2LocationResource,
  Auth2SubstituteResource,
  AuthAccessService2,
  AuthAccessToken2,
  AuthAccessTokenService2,
  AuthLogoutService2,
  AuthProbeResult2,
  AuthProbeService2,
  InternationalString,
} from '@iiif/parser/presentation-3/types';
import type { FunctionComponent } from 'react';
import { createStore } from 'zustand/vanilla';

export function hasAuth(resource: any) {
  const services = resource.service || resource.services || [];

  for (const service of services) {
    // Probe service
    if (service.type === 'AuthProbeService2') {
      return true;
    }
  }

  return false;
}

export interface ProbeStore {
  service?: AuthProbeService2;
  status: 'unknown' | 'probing' | 'error' | 'success';
  responseStatus: number | null;
  discovering: boolean;
  retry: () => Promise<void>;
  cancel: () => void;
  shouldRedirect: boolean;
  redirectResource: Auth2LocationResource | null;
  shouldSubstitute: boolean;
  substituteResource: Auth2SubstituteResource | null;
  error: string | null;
  errorHeading: InternationalString | null;
  errorNote: InternationalString | null;

  shouldDisplayResource: boolean;
  token: string | null;
  probe: () => Promise<void>;
  setToken: (token: string) => void;
}

export interface AuthContextState {
  currentAuth: number; // Should only be active ones.
  authItems: AuthAccessState[];
  resources: Record<string, { resource: any; canvasId?: string; probe: ProbeStore }>;
  errorComponent?: FunctionComponent<AuthPresentationProps>;
}

export interface AuthPresentationProps {
  resource: any;
  extra?: any;
  error: string;
  heading: InternationalString | null;
  note: InternationalString | null;
  probe: ProbeStore;
}

export interface AuthContextCurrentActions {
  login(id?: string): void;
  logout(id?: string): void;
  dispose(): void;
  nextAuth(): void;
  previousAuth(): void;
  setAuth(index: number): void;
}

export interface AuthContextActions {
  addService(service: AuthAccessService2, probeId: string, automatic?: boolean): void;
  removeService(service: AuthAccessService2, probeId: string): void;
}

export interface AuthAccessState {
  id: string;
  type: 'external' | 'kiosk' | 'active';
  service: AuthAccessService2;
  probeId: string;
  isPending: boolean;
  isLoggedIn: boolean;
  canAuthenticate: boolean;
  instances: number;
  error?: string;
  errorHeading?: InternationalString;
  errorNote?: InternationalString;
  errorProfile?: string;
  phase?: "access" | "token" | "logout";
  session: null | {
    token: string;
    expires: number;
  };
}

function updateAuthItems(
  id: string,
  state: AuthContextState['authItems'],
  callback: (state: AuthAccessState) => AuthAccessState
): AuthContextState['authItems'] {
  const index = state.findIndex((item) => item.id === id);
  if (index === -1) {
    return state;
  }

  const newAuthItems = [...state];
  const possiblyNew = callback(newAuthItems[index]);
  if (possiblyNew === newAuthItems[index]) {
    return state;
  }

  newAuthItems[index] = possiblyNew;
  return newAuthItems;
}

// External services may omit an ID; use their token service as a fallback identity.
export function getAccessServiceId(service: AuthAccessService2) {
  return service.id || `external:${service.service.find((s) => s.type === 'AuthAccessTokenService2')?.id}`;
}

function isActive(item: AuthAccessState) {
  return item.type === 'active' && item.instances > 0;
}

export function getTokenService(service: AuthAccessService2) {
  return service.service.find((s) => s.type === 'AuthAccessTokenService2') as AuthAccessTokenService2 | undefined;
}

export class AuthRequestError extends Error {
  constructor(message: string, public profile: string, public heading?: InternationalString, public note?: InternationalString) {
    super(message);
  }
}

export const createAuthStateStore = () => {
  const pending = new Map<string, { promise: Promise<void>; controller: AbortController }>();
  const expiry = new Map<string, ReturnType<typeof setTimeout>>();
  return createStore<AuthContextCurrentActions & AuthContextState & AuthContextActions>((set, get) => {
    const tokenId = (item: AuthAccessState) => getTokenService(item.service)?.id;
    function update(id: string, changes: Partial<AuthAccessState>) {
      set((state) => ({ authItems: state.authItems.map((item) => tokenId(item) === id ? { ...item, ...changes } : item) }));
    }
    function authenticate(service: AuthAccessService2) {
      const tokenService = getTokenService(service);
      if (!tokenService) return Promise.resolve();
      const id = tokenService.id;
      const existing = pending.get(id);
      if (existing) return existing.promise;
      const controller = new AbortController();
      const signal = controller.signal;
      update(id, { isPending: true, error: undefined, errorHeading: undefined, errorNote: undefined, errorProfile: undefined,
        phase: service.profile === 'external' ? 'token' : 'access' });
      const promise = (async () => {
        try {
          if (service.profile !== 'external') await makeAccessServiceRequest(service, { signal });
          if (signal.aborted) return;
          update(id, { phase: 'token' });
          const token = await makeAccessTokenRequest(tokenService, { signal });
          if (signal.aborted) return;
          const session = { token: token.accessToken, expires: Date.now() + token.expiresIn * 1000 };
          clearTimeout(expiry.get(id));
          expiry.set(id, setTimeout(() => {
            expiry.delete(id);
            update(id, { session: null, isLoggedIn: false });
          }, Math.min(token.expiresIn * 1000, 2147483647)));
          update(id, { isLoggedIn: true, isPending: false, canAuthenticate: true, session, phase: undefined });
        } catch (error) {
          if (signal.aborted) return;
          update(id, { isPending: false, phase: undefined });
          set((state) => ({ authItems: updateAuthItems(getAccessServiceId(service), state.authItems, (item) => ({ ...item,
            error: error instanceof Error ? error.message : String(error),
            errorHeading: error instanceof AuthRequestError ? error.heading : undefined,
            errorNote: error instanceof AuthRequestError ? error.note : undefined,
            errorProfile: error instanceof AuthRequestError ? error.profile : undefined })) }));
        }
      })();
      pending.set(id, { promise, controller });
      void promise.then(() => { if (pending.get(id)?.controller === controller) pending.delete(id); });
      return promise;
    }
    return {
      currentAuth: -1,
      authItems: [],
      resources: {},
      dispose: () => {
        for (const request of pending.values()) request.controller.abort();
        for (const timer of expiry.values()) clearTimeout(timer);
        pending.clear();
        expiry.clear();
      },
      login: (id) => {
        const current = id ? get().authItems.find((item) => item.id === id) : get().authItems[get().currentAuth];
        if (!current || current.type !== 'active' || current.isPending) return;
        void authenticate(current.service);
      },
      logout: (id) => {
        const current = id ? get().authItems.find((item) => item.id === id) : get().authItems[get().currentAuth];
        if (!current || current.type !== 'active' || (!current.session && current.errorProfile !== 'logoutFailed')) return;
        const logoutService = current.service.service.find((s) => s.type === 'AuthLogoutService2') as AuthLogoutService2 | undefined;
        const tokenService = getTokenService(current.service);
        if (!logoutService || !tokenService) return;
        const key = tokenService.id;
        pending.get(key)?.controller.abort();
        pending.delete(key);
        clearTimeout(expiry.get(key));
        expiry.delete(key);
        update(key, { session: null, isLoggedIn: false, isPending: true, phase: 'logout', error: undefined,
          errorHeading: undefined, errorNote: undefined, errorProfile: undefined });
        const controller = new AbortController();
        const promise = makeAccessServiceRequest(logoutService, { signal: controller.signal }).then(() => {
          if (!controller.signal.aborted) update(key, { isPending: false, phase: undefined });
        }).catch((error) => {
          if (!controller.signal.aborted) update(key, { isPending: false, phase: undefined, error: error.message,
            errorProfile: 'logoutFailed' });
        });
        pending.set(key, { promise, controller });
        void promise.then(() => { if (pending.get(key)?.controller === controller) pending.delete(key); });
      },
      nextAuth: () => {
        const next = get().authItems.findIndex((item, index) => index > get().currentAuth && isActive(item));
        if (next !== -1) set({ currentAuth: next });
      },
      previousAuth: () => {
        let previous = get().currentAuth - 1;
        while (previous >= 0 && !isActive(get().authItems[previous])) previous--;
        if (previous >= 0) set({ currentAuth: previous });
      },
      setAuth: (index) => {
        if (index === -1 || (get().authItems[index] && isActive(get().authItems[index]))) set({ currentAuth: index });
      },
      addService: async (service, probeId, automatic = true) => {
        if (!getTokenService(service)) return;
        const id = getAccessServiceId(service);
        const existing = get().authItems.find((item) => item.id === id);
        const shared = get().authItems.find((item) => tokenId(item) === getTokenService(service)?.id && item.session && item.session.expires > Date.now());
        set((state) => {
          const authItems = existing
            ? updateAuthItems(id, state.authItems, (item) => ({ ...item, instances: item.instances + 1 }))
            : [...state.authItems, { id, type: service.profile, service, probeId, canAuthenticate: true, instances: 1,
                isPending: !!pending.get(getTokenService(service)!.id), isLoggedIn: !!shared,
                session: shared?.session || null }];
          return { authItems, currentAuth: state.currentAuth === -1 ? authItems.findIndex(isActive) : state.currentAuth };
        });
        if (automatic && service.profile !== 'active') {
          const session = get().authItems.find((item) => item.id === id)?.session;
          if (!session || session.expires <= Date.now()) await authenticate(service);
        }
      },
      removeService: (service, _probeId) => {
        const id = getAccessServiceId(service);
        set((state) => {
          const authItems = updateAuthItems(id, state.authItems, (item) => ({ ...item, instances: Math.max(0, item.instances - 1) }));
          return { authItems, currentAuth: authItems[state.currentAuth] && isActive(authItems[state.currentAuth])
            ? state.currentAuth : authItems.findIndex(isActive) };
        });
      },
    };
  });
};

export const createProbe = (service?: AuthProbeService2, token?: string) => {
  let controller: AbortController | undefined;
  return createStore<ProbeStore>((set, get) => ({
    service, status: service ? 'unknown' : 'success', responseStatus: null, discovering: !!service,
    shouldRedirect: false, redirectResource: null, shouldSubstitute: false, substituteResource: null,
    error: null, errorHeading: null, errorNote: null, shouldDisplayResource: !service, token: token || null,
    retry: async () => { await get().probe(); },
    cancel: () => { controller?.abort(); },
    async probe() {
      if (!service) return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 15000);
      set({ status: 'probing', responseStatus: null, shouldDisplayResource: false,
        error: null, errorHeading: null, errorNote: null, shouldRedirect: false, redirectResource: null,
        shouldSubstitute: false, substituteResource: null });
      try {
        const token = get().token;
        const response = await fetch(service.id, { signal: request.signal,
          headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (response.ok === false) throw new Error('Unable to check access');
        const result: AuthProbeResult2 = await response.json();
        if (controller !== request) return;
        if (!Number.isInteger(result.status)) throw new Error('Invalid access response');
        const allowed = result.status === 200;
        set({ status: allowed ? 'success' : 'error', responseStatus: result.status, shouldDisplayResource: allowed,
          error: allowed ? null : result.status === 403 ? 'Forbidden' : result.status === 401 ? 'Unauthorized' : 'Access unavailable',
          errorHeading: allowed ? null : result.heading || service.errorHeading || null,
          errorNote: allowed ? null : result.note || service.errorNote || null,
          shouldRedirect: result.status >= 300 && result.status < 400 && !!result.location,
          redirectResource: result.location || null, shouldSubstitute: !!result.substitute, substituteResource: result.substitute || null });
      } catch (error) {
        if (controller !== request) return;
        set({ status: 'error', responseStatus: null, shouldDisplayResource: false,
          error: error instanceof Error ? error.message : 'Unable to check access',
          errorHeading: service.errorHeading || null, errorNote: service.errorNote || null });
      } finally { clearTimeout(timeout); }
    },
    setToken(token: string) { set({ token }); },
  }));
};

export function authDetailsForResource(resource: any) {
  const services = resource.service || resource.services || [];
  const state: {
    hasAuth?: boolean;
    services: {
      probe?: AuthProbeService2;
      access?: AuthAccessService2;
      accessServices: AuthAccessService2[];
    };
  } = { hasAuth: false, services: { accessServices: [] } };

  for (const service of services) {
    // Probe service
    if (service.type === 'AuthProbeService2') {
      state.services.probe = service;
      state.hasAuth = true;

      const accessServices = (service.service || []).filter(
        (s: any) => s.type === 'AuthAccessService2'
      ) as AuthAccessService2[];

      const order = { external: 0, kiosk: 1, active: 2 };
      state.services.accessServices = [...accessServices].sort((a, b) => order[a.profile] - order[b.profile]);
      if (accessServices[0]) {
        state.services.access = accessServices[0];
      }
    }
  }

  return state;
}

function serviceUrl(id: string, parameters: Record<string, string>) {
  const url = new URL(id, window.location.href);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Invalid access service URL');
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url;
}

export async function makeAccessTokenRequest<T extends AuthAccessTokenService2>(
  service: T, { strict = true, signal, timeoutMs = 10000 }: { strict?: boolean; signal?: AbortSignal; timeoutMs?: number } = {}
) {
  return new Promise<AuthAccessToken2>((resolve, reject) => {
    const messageId = crypto.randomUUID();
    const url = serviceUrl(service.id, { messageId, origin: window.location.origin });
    const iframe = document.createElement('iframe');
    let timeout: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
      signal?.removeEventListener('abort', aborted);
      iframe.remove();
    };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const aborted = () => fail(new AuthRequestError('Access check cancelled', 'cancelled'));
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (event.origin !== url.origin || event.source !== iframe.contentWindow || !data || data.messageId !== messageId) return;
      if (data.type === 'AuthAccessTokenError2') {
        fail(new AuthRequestError('Access could not be confirmed', data.profile, data.heading || service.errorHeading, data.note || service.errorNote));
      } else if ((strict && data.type !== 'AuthAccessToken2') || typeof data.accessToken !== 'string' || !data.accessToken ||
          !Number.isFinite(data.expiresIn) || data.expiresIn <= 0) {
        fail(new AuthRequestError('Invalid access response', 'invalidResponse', service.errorHeading, service.errorNote));
      } else { cleanup(); resolve(data); }
    };
    if (signal?.aborted) { aborted(); return; }
    iframe.src = url.href;
    iframe.title = 'Access check';
    iframe.style.display = 'none';
    window.addEventListener('message', handleMessage);
    signal?.addEventListener('abort', aborted, { once: true });
    timeout = setTimeout(() => fail(new AuthRequestError('Access check timed out', 'timeout', service.errorHeading, service.errorNote)), timeoutMs);
    document.body.appendChild(iframe);
  });
}

export async function makeAccessServiceRequest<T extends { id: string }>(
  service: T, { signal, timeoutMs = 300000 }: { signal?: AbortSignal; timeoutMs?: number } = {}
) {
  const url = serviceUrl(service.id, { origin: window.location.origin });
  if (signal?.aborted) throw new AuthRequestError('Access cancelled', 'cancelled');
  const windowRef = window.open(url.href);
  if (!windowRef) throw new AuthRequestError('The access tab could not be opened', 'blocked');
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearInterval(interval); clearTimeout(timeout); signal?.removeEventListener('abort', aborted); };
    const aborted = () => { cleanup(); reject(new AuthRequestError('Access cancelled', 'cancelled')); };
    const interval = setInterval(() => { if (windowRef.closed) { cleanup(); resolve(); } }, 500);
    const timeout = setTimeout(() => { cleanup(); reject(new AuthRequestError('The access step timed out. Please close the access tab and try again.', 'timeout')); }, timeoutMs);
    signal?.addEventListener('abort', aborted, { once: true });
  });
}

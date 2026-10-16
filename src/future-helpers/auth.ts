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
}

export interface AuthContextCurrentActions {
  login(): void;
  logout(): void;
  nextAuth(): void;
  previousAuth(): void;
  setAuth(index: number): void;
}

export interface AuthContextActions {
  addService(service: AuthAccessService2, probeId: string): void;
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

export const createAuthStateStore = () => {
  const pending = new Map<string, Promise<void>>();
  return createStore<AuthContextCurrentActions & AuthContextState & AuthContextActions>((set, get) => {
    function authenticate(service: AuthAccessService2) {
      const id = getAccessServiceId(service);
      const existing = pending.get(id);
      if (existing) return existing;

      const update = (changes: Partial<AuthAccessState>) =>
        set((state) => ({ authItems: updateAuthItems(id, state.authItems, (item) => ({ ...item, ...changes })) }));
      update({ isPending: true, error: undefined });
      const request = (async () => {
        try {
          const tokenService = service.service.find((s) => s.type === 'AuthAccessTokenService2') as
            | AuthAccessTokenService2
            | undefined;
          if (!tokenService) throw new Error('Token service not found');
          if (service.profile !== 'external') await makeAccessServiceRequest(service);
          const token = await makeAccessTokenRequest(tokenService);
          update({
            isLoggedIn: true,
            isPending: false,
            canAuthenticate: true,
            session: { token: token.accessToken, expires: Date.now() + token.expiresIn * 1000 },
          });
        } catch (error) {
          update({
            isLoggedIn: false,
            isPending: false,
            canAuthenticate: service.profile === 'active',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      pending.set(id, request);
      void request.then(() => pending.delete(id));
      return request;
    }

    return {
      currentAuth: -1,
      authItems: [],
      login: () => {
        const current = get().authItems[get().currentAuth];
        if (!current || !isActive(current) || current.isPending || current.isLoggedIn) return;
        void authenticate(current.service);
      },
      logout: () => {
        const current = get().authItems[get().currentAuth];
        if (!current || !isActive(current) || current.isPending || !current.isLoggedIn) return;
        const logoutService = current.service.service.find((s) => s.type === 'AuthLogoutService2') as
          | AuthLogoutService2
          | undefined;
        if (!logoutService) return;
        window.open(`${logoutService.id}?origin=${getOrigin()}`);
        set((state) => ({
          authItems: updateAuthItems(current.id, state.authItems, (item) => ({
            ...item,
            isLoggedIn: false,
            session: null,
            isPending: false,
          })),
        }));
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
        if (index === -1 || (get().authItems[index] && isActive(get().authItems[index]))) {
          set({ currentAuth: index });
        }
      },
      addService: async (service, probeId) => {
        if (!service.service) return;
        const id = getAccessServiceId(service);
        const existing = get().authItems.find((item) => item.id === id);
        set((state) => {
          const authItems = existing
            ? updateAuthItems(id, state.authItems, (item) => ({ ...item, instances: item.instances + 1 }))
            : [
                ...state.authItems,
                {
                  id,
                  type: service.profile,
                  service,
                  probeId,
                  canAuthenticate: true,
                  instances: 1,
                  isPending: false,
                  isLoggedIn: false,
                  session: null,
                },
              ];
          return {
            authItems,
            currentAuth: state.currentAuth === -1 ? authItems.findIndex(isActive) : state.currentAuth,
          };
        });
        if (pending.has(id)) return pending.get(id);
        if (service.profile !== 'active' && (!existing || existing.instances === 0)) {
          if (!existing?.session || existing.session.expires <= Date.now()) await authenticate(service);
        }
      },
      removeService: (service, _probeId) => {
        const id = getAccessServiceId(service);
        set((state) => {
          const authItems = updateAuthItems(id, state.authItems, (item) => ({
            ...item,
            instances: Math.max(0, item.instances - 1),
          }));
          return {
            authItems,
            currentAuth:
              authItems[state.currentAuth] && isActive(authItems[state.currentAuth])
                ? state.currentAuth
                : authItems.findIndex(isActive),
          };
        });
      },
    };
  });
};

export const createProbe = (service?: AuthProbeService2, token?: string) =>
  createStore<ProbeStore>((set, get) => ({
    service,
    // Status of the probe.
    status: service ? 'unknown' : 'success',

    // Redirection (LATER)
    shouldRedirect: false,
    redirectResource: null as Auth2LocationResource | null,

    // Substitution (LATER)
    shouldSubstitute: false,
    substituteResource: null as Auth2SubstituteResource | null,

    // Error message
    error: null as string | null,
    errorHeading: null,
    errorNote: null,

    shouldDisplayResource: false,

    token: token || null,
    async probe() {
      if (!get().service) {
        return;
      }
      const serviceId = get().service?.id;
      if (!serviceId) {
        set({ status: 'error', error: 'Service ID not found', errorHeading: { en: ['Service ID not found'] } });
        return;
      }

      // Set status to probing
      set({ status: 'probing' });

      const token = get().token;

      // Probe the service
      try {
        const response: AuthProbeResult2 = await fetch(serviceId, {
          headers: token
            ? {
                // Has token.
                Authorization: `Bearer ${get().token}`,
                Accept: 'application/json',
              }
            : {
                // No token.
                Accept: 'application/json',
              },
        }).then((r) => r.json());

        // Success
        if (response.status === 200) {
          set({
            status: 'success',
            shouldDisplayResource: true,
            error: null,
            errorHeading: null,
            errorNote: null,
            shouldSubstitute: false,
            shouldRedirect: false,
          });
        }
        // Redirect
        else if (response.status < 400 && response.status >= 300) {
          if (!response.location) {
            throw new Error('Redirect location not found');
          }
          set({
            status: 'error',
            shouldDisplayResource: false,
            shouldRedirect: true,
            redirectResource: response.location || null,
          });
        }
        // Access denied, including server-specific explanations for forbidden resources.
        else if (response.status === 401 || response.status === 403) {
          const error = response.status === 403 ? 'Forbidden' : 'Unauthorized';
          set({
            status: 'error',
            shouldDisplayResource: false,
            shouldRedirect: false,
            shouldSubstitute: !!response.substitute,
            substituteResource: response.substitute || null,
            error,
            errorHeading: response.heading || { en: [error] },
            errorNote: response.note || null,
          });
        }
        // Error
        else {
          throw new Error('Unknown error');
        }

        //
      } catch (e: any) {
        set({ status: 'error', error: e.message, errorHeading: { en: ['Unknown error'] } });
      }
    },
    setToken(token: string) {
      set({ token });
    },
  }));

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

export async function makeAccessTokenRequest<T extends AuthAccessTokenService2>(
  service: T,
  { strict = true }: { strict?: boolean } = {}
) {
  return new Promise<AuthAccessToken2>((resolve, error) => {
    const messageId = Math.random().toString(36).substring(7);
    const url = `${service.id}?messageId=${messageId}&origin=${window.location.origin}`;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as AuthAccessToken2;
      if (!data || data.messageId !== messageId) {
        return;
      }

      // Strict mode.
      if (strict) {
        if (data.type !== 'AuthAccessToken2') {
          cleanup();
          error(new Error('Invalid response, expected type=AuthAccessToken2'));
          return;
        }
      }
      if (!data.accessToken) {
        cleanup();
        error(new Error('Invalid response, expected accessToken'));
        return;
      }
      cleanup();
      resolve(data);
    };
    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      iframe.remove();
    };

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.display = 'none';
    window.addEventListener('message', handleMessage);
    document.body.appendChild(iframe);
  });
}

function getOrigin(url?: string) {
  const location = window.location;
  if (url) {
    const urlHolder = document.createElement('a');
    urlHolder.href = url;
    return urlHolder.protocol + '//' + urlHolder.hostname + (urlHolder.port ? ':' + urlHolder.port : '');
  }
  return location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '');
}

export async function makeAccessServiceRequest<T extends AuthAccessService2>(service: T) {
  // Open window in a new tab.
  // Wait for window to close.
  const url = `${service.id}?origin=${getOrigin()}`;
  const windowRef = window.open(url);
  if (!windowRef) {
    throw new Error('Failed to open window');
  }

  return new Promise<void>((resolve, error) => {
    // Resolve when window closes.
    const interval = setInterval(() => {
      if (windowRef.closed) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });
}

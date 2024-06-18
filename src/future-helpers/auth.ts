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
} from '@iiif/presentation-3';
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
  const index = state.findIndex((item) => item.service.id === id);
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

export const createAuthStateStore = () =>
  createStore<AuthContextCurrentActions & AuthContextState & AuthContextActions>((set, get) => ({
    // Migrate the reducer + component below into a single zustand store.
    currentAuth: -1,
    authItems: [],
    login: () => {
      const current = get().authItems[get().currentAuth];
      if (!current || current.isPending || current.isLoggedIn) {
        return;
      }

      if (current.type !== 'active') {
        throw new Error('Cannot login to non-active service');
      }

      const tokenService = current.service.service.find((s) => s.type === 'AuthAccessTokenService2') as
        | AuthAccessTokenService2
        | undefined;

      if (!tokenService) {
        throw new Error('Token service not found');
      }

      set(() => ({
        authItems: updateAuthItems(current.id, get().authItems, (item) => ({ ...item, isPending: true })),
      }));

      makeAccessServiceRequest(current.service).then(() => {
        makeAccessTokenRequest(tokenService)
          .then((token) => {
            const expires = token.expiresIn;
            const expiresTimestamp = Date.now() + expires * 1000;
            set(() => ({
              authItems: updateAuthItems(current.id, get().authItems, (item) => ({
                ...item,
                isLoggedIn: true,
                isPending: false,
                session: {
                  token: token.accessToken,
                  expires: expiresTimestamp,
                },
              })),
            }));
          })
          .catch((error) => {
            set(() => ({
              authItems: updateAuthItems(current.id, get().authItems, (item) => ({
                ...item,
                isLoggedIn: false,
                isPending: false,
                error: error.message,
              })),
            }));
          });
      });
    },
    logout: () => {
      const current = get().authItems[get().currentAuth];
      if (!current || current.isPending || !current.isLoggedIn) {
        return;
      }

      if (current.type !== 'active') {
        throw new Error('Cannot logout of non-active service');
      }

      const logoutService = current.service.service.find((s) => s.type === 'AuthLogoutService2') as
        | AuthLogoutService2
        | undefined;

      if (!logoutService) {
        return;
      }

      const url = `${logoutService.id}?origin=${getOrigin()}`;
      const windowRef = window.open(url);
      set(() => ({
        authItems: updateAuthItems(current.id, get().authItems, (item) => ({
          ...item,
          isLoggedIn: false,
          session: null,
          isPending: false,
        })),
      }));
      if (!windowRef) {
        // Silent fail? Still log out anyway.
        // throw new Error('Failed to open window');
      }
    },
    nextAuth: () => {
      const total = get().authItems.length;
      const next = get().currentAuth + 1;
      if (next >= total) {
        return;
      }

      set(() => ({
        currentAuth: next,
      }));
    },
    previousAuth: () => {
      const previous = get().currentAuth - 1;
      if (previous < 0) {
        return;
      }

      set(() => ({
        currentAuth: previous,
      }));
    },
    setAuth: (index: number) => {
      if (index !== -1) {
        if (index < 0 || index >= get().authItems.length) {
          return;
        }
      }
      set(() => ({
        currentAuth: index,
      }));
    },

    addService: (service: AuthAccessService2, probeId: string) => {
      // First step - have we already got this service?
      // If we do, then we just increment the count (instances).
      // And return.
      if (!service.service) {
        return;
      }

      // It will be either external, kiosk, or active.
      const tokenService = service.service.find((s) => s.type === 'AuthAccessTokenService2') as
        | AuthAccessTokenService2
        | undefined;
      const accessService = service;

      const existing = get().authItems.find((item) => item.service.id === service.id);

      if (existing) {
        set(() => ({
          authItems: updateAuthItems(service.id, get().authItems, (item) => ({
            ...item,
            instances: item.instances + 1,
          })),
        }));
        return;
      }

      // add service.
      set(() => ({
        currentAuth: accessService.profile === 'active' ? 0 : get().currentAuth,
        authItems: [
          {
            id: service.id,
            type: service.profile,
            service: service,
            probeId: probeId,
            canAuthenticate: true,
            instances: 1,
            isPending: false,
            isLoggedIn: false,
            session: null,
          },
          ...get().authItems,
        ],
      }));

      // If its external, we just open the token service.
      if (service.profile === 'external') {
        if (!tokenService) {
          throw new Error('Token service not found');
        }
        makeAccessTokenRequest(tokenService)
          .then((token) => {
            // Make as resolved, so the image service should retry the probe.
            set(() => ({
              authItems: updateAuthItems(service.id, get().authItems, (item) => ({
                ...item,
                isLoggedIn: true,
                isPending: false,
                session: {
                  token: token.accessToken,
                  expires: token.expiresIn,
                },
              })),
            }));
          })
          .catch((error) => {
            // Make as an error.
            set(() => ({
              authItems: updateAuthItems(service.id, get().authItems, (item) => ({
                ...item,
                isLoggedIn: false,
                isPending: false,
                canAuthenticate: false,
                error: error.message,
              })),
            }));
          });
        //
      }

      // If its kiosk, we open the access service, then the token service.
      if (service.profile === 'kiosk') {
        if (!tokenService) {
          throw new Error('Token service not found');
        }
        set(() => ({
          authItems: updateAuthItems(service.id, get().authItems, (item) => ({
            ...item,
            isPending: true,
          })),
        }));
        makeAccessServiceRequest(accessService).then(() => {
          // Access
          makeAccessTokenRequest(tokenService)
            .then((token) => {
              // Make as resolved, so the image service should retry the probe.
              // And set the token.
              set(() => ({
                authItems: updateAuthItems(service.id, get().authItems, (item) => ({
                  ...item,
                  isLoggedIn: true,
                  isPending: false,
                  session: {
                    token: token.accessToken,
                    expires: token.expiresIn,
                  },
                })),
              }));
            })
            .catch((error) => {
              // Make as an error.
              set(() => ({
                authItems: updateAuthItems(service.id, get().authItems, (item) => ({
                  ...item,
                  isLoggedIn: false,
                  isPending: false,
                  error: error.message,
                })),
              }));
            });
        });
      }

      if (service.profile === 'active') {
        // Just wait for the user interaction.
      }

      return;
    },
    removeService: (service: AuthAccessService2, probeId: string) => {
      console.log('removeService', service, probeId);
      // Is it active?
      const isCurrent = get().currentAuth === get().authItems.findIndex((item) => item.service.id === service.id);
      let currentAuth = get().currentAuth;
      if (isCurrent) {
        const active = get().authItems.find((item) => item.service.id === service.id);
        const isActive = active && active.instances > 1;
        if (!isActive) {
          const nextActive = get().authItems.findIndex((item) => item.service.id !== service.id && item.instances > 0);

          currentAuth = nextActive;
        }
      }

      set(() => ({
        authItems: updateAuthItems(service.id, get().authItems, (item) => ({
          ...item,
          instances: item.instances - 1,
        })),
        currentAuth,
      }));
    },
  }));

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
        // Unauthorized
        else if (response.status === 401) {
          set({
            status: 'error',
            shouldDisplayResource: false,
            shouldRedirect: false,
            shouldSubstitute: !!response.substitute,
            substituteResource: response.substitute || null,
            error: 'Unauthorized',
            errorHeading: response.heading || { en: ['Unauthorized'] },
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
    };
  } = { hasAuth: false, services: {} };

  for (const service of services) {
    // Probe service
    if (service.type === 'AuthProbeService2') {
      state.services.probe = service;
      state.hasAuth = true;

      const accessServices = service.service.filter(
        (s: any) => s.type === 'AuthAccessService2'
      ) as AuthAccessService2[];

      // @todo support all access services.
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
      if (data.messageId !== messageId) {
        return;
      }

      // Strict mode.
      if (strict) {
        if (data.type !== 'AuthAccessToken2') {
          cleanup();
          error('Invalid response, expected type=AuthAccessToken2');
          return;
        }
      }
      if (!data.accessToken) {
        cleanup();
        error('Invalid response, expected accessToken');
        return;
      }
      cleanup();
      resolve(data);
    };
    const cleanup = () => window.removeEventListener('message', handleMessage);

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    window.addEventListener('message', handleMessage);
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

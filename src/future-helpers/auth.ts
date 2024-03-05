import { AuthAccessService2, InternationalString } from '@iiif/presentation-3';
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

type AuthState = {
  hasAuth?: boolean;
  services: {
    probe?: AuthProbeService2;
    access?: AuthAccessService2;
  };
};

type LocationResource = {
  id: string;
  type: string;
  service: any[];
};
type SubstituteResource = Array<{
  id: string;
  label: InternationalString;
  type: string;
  service: any[];
}>;

interface ProbeStore {
  service?: AuthProbeService2;
  status: 'unknown' | 'probing' | 'error' | 'success';
  shouldRedirect: boolean;
  redirectResource: LocationResource | null;
  shouldSubstitute: boolean;
  substituteResource: SubstituteResource | null;
  error: string | null;
  errorHeading: InternationalString | null;
  errorNote: InternationalString | null;

  shouldDisplayResource: boolean;
  token: string | null;
  probe: () => Promise<void>;
  setToken: (token: string) => void;
}

interface AuthProbeResult2 {
  '@context': 'http://iiif.io/api/auth/2/context.json';

  type: 'AuthProbeResult2';
  status: number;
  substitute: SubstituteResource;
  location: LocationResource;

  // Error
  heading: InternationalString;
  note: InternationalString;
}

interface AuthAccessTokenService2 {
  id: string;
  type: 'AuthAccessTokenService2';
  errorHeading?: InternationalString;
  errorNote?: InternationalString;
}

export const createProbe = (service?: AuthProbeService2) =>
  createStore<ProbeStore>((set, get) => ({
    service,
    // Status of the probe.
    status: service ? 'unknown' : 'success',

    // Redirection (LATER)
    shouldRedirect: false,
    redirectResource: null as LocationResource | null,

    // Substitution (LATER)
    shouldSubstitute: false,
    substituteResource: null as SubstituteResource | null,

    // Error message
    error: null as string | null,
    errorHeading: null,
    errorNote: null,

    shouldDisplayResource: false,

    token: null as string | null,
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
  const state: AuthState = { hasAuth: false, services: {} };

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

// types

interface AuthProbeService2 {
  id: string;
  type: 'AuthProbeService2';
  service: any[];
  errorHeading?: InternationalString;
  errorNote?: InternationalString;
}

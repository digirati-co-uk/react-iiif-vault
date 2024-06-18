import { AuthAccessService2, InternationalString } from '@iiif/presentation-3';
import { FunctionComponent, ReactNode, createContext, useContext, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { StoreApi } from 'zustand/vanilla';
import {
  AuthContextActions,
  AuthContextCurrentActions,
  AuthContextState,
  createAuthStateStore,
} from '../future-helpers/auth';
import { useAuthResource } from '../hooks/useAuthResource';

export interface AuthState {
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

export const AuthRContext = createContext<StoreApi<
  AuthContextState & AuthContextCurrentActions & AuthContextActions
> | null>(null);

export const AuthReactContext = createContext<(AuthContextState & AuthContextCurrentActions) | null>(null);
AuthReactContext.displayName = 'CurrentAuth';
export const AuthReactContextActions = createContext<AuthContextActions | null>(null);
AuthReactContextActions.displayName = 'AuthActions';

export function AuthProvider({ children }: { children: ReactNode }) {
  const authStateStore = useMemo(() => {
    return createAuthStateStore();
  }, []);

  return <AuthRContext.Provider value={authStateStore}>{children}</AuthRContext.Provider>;
}

export function useIsAuthEnabled() {
  return !!useContext(AuthRContext);
}

export function useAuthStore() {
  const store = useContext(AuthRContext);
  if (!store) {
    throw new Error('useAuthActions must be used within a AuthProvider');
  }
  return store;
}

export function useAuthActions() {
  const store = useAuthStore();
  const actions = useStore(store, (state) => ({
    login: state.login,
    logout: state.logout,
    nextAuth: state.nextAuth,
    previousAuth: state.previousAuth,
    setAuth: state.setAuth,
    addService: state.addService,
    removeService: state.removeService,
  }));

  return actions;
}

export function useCurrentAuth() {
  const store = useAuthStore();
  return useStore(store, (state) => state);
}

export function useAuthService(id: string) {
  const store = useAuthStore();
  const service = useStore(store, (state) => state.authItems.find((item) => item.service.id === id));
  return service;
}

export function useAuthTokens(id?: string) {
  const store = useAuthStore();
  const token = useStore(store, (state) => state.authItems.find((item) => item.id === id)?.session?.token);
  return token;
}

export function useAuthToken(id: string) {
  const store = useAuthStore();
  const token = useStore(store, (state) => {
    const auth = state.authItems.find((item) => item.service.id === id);
    if (!auth) {
      return null;
    }

    if (!auth.isLoggedIn) {
      return null;
    }
    if (!auth.session) {
      return null;
    }
    return auth.session?.token || null;
  });
  return token;
}

interface AccessServiceProps {
  probeId: string;
  service: AuthAccessService2;
  children: ReactNode;
}

function AccessService(props: AccessServiceProps) {
  const actions = useAuthActions();
  const auth = useAuthService(props.service.id);

  useEffect(() => {
    actions?.addService(props.service, props.probeId);
    return () => {
      actions?.removeService(props.service, props.probeId);
    };
  }, [props.service]);

  if (!auth) {
    // Is it maybe loading?
    return null;
  }

  if (auth.error) {
    // Show error?
    return props.children;
  }

  if (!auth.isLoggedIn) {
    return props.children;
  }

  // @todo come back to this.. definitely.
  return props.children;
}

interface AuthProps<T, Extra> {
  // Probe service, the top level one on resources.
  resource: T;

  extra?: Extra;

  // This is the protected resource.
  children: (service: T) => ReactNode;

  // Fallback, when there is a degraded resource. Usually self reference of the parent.
  fallbackComponent?: FunctionComponent<any> | null;

  // Loading component, when we are waiting for stuff.
  loadingComponent?: FunctionComponent<any> | null;

  // Error component, specific for an error.
  errorComponent?: FunctionComponent<{
    resource: T;
    error: string;
    heading: InternationalString | null;
    note: InternationalString | null;
    extra: Extra | undefined;
  }> | null;
}

function FallbackElement() {
  return null;
}

export function Auth<Element, Extra = any>(props: AuthProps<Element, Extra>) {
  const [service, probe, hasAuth] = useAuthResource(props.resource);
  const Fallback = props.fallbackComponent || FallbackElement;
  const Loading = props.loadingComponent || FallbackElement;
  const Error = props.errorComponent || FallbackElement;

  const probeService = probe.service;

  let inner = null;

  if (!hasAuth || !probeService) {
    return props.children(service);
  }

  const accessServices = probeService.service.filter((s) => s.type === 'AuthAccessService2') as AuthAccessService2[];

  if (probe.status === 'error') {
    inner = (
      <Error
        resource={props.resource}
        error={probe.error || ''}
        heading={probe.errorHeading}
        note={probe.errorNote}
        extra={props.extra}
      />
    );
  }

  if (probe.status === 'unknown' || probe.status === 'probing') {
    inner = <Loading />;
  }

  if (probe.status === 'success') {
    inner = props.children(service);
  }

  for (const service of accessServices) {
    inner = (
      <AccessService key={service.id} service={service} probeId={probeService.id}>
        {inner}
      </AccessService>
    );
  }

  return inner;
}

// Whats the usage?
// const {} = useCurrentAuth();
// use this to render the UI for the user.
// It will need to have actions for login or logout actions.

// Maybe it's: (NO, because probe needs to conditionally render the children - AND render the AccessService components)
// <Probe service={service} fallback={Fallback}>
//   <AccessService service={service2} errorComponent={..} fallback={...}>
//     <AccessService service={service3} errorComponent={..} fallback={...}>
//        <ImageService ... />
//     </AccessService>
//   </AccessService>
// </Probe>
//
// Which as a user-facing option:
//
// <Auth service={service} fallbackComponent={Fallback}>
//   <ImageService ... />
// </Auth>

//
// If you want to get the status of an AccessService:
//
//  const { isAuthorized, login, logout, service } = useAccessService('id');
//
//
// The hook will _also_ push up the access service to the AuthContext.
// It will need to unregister after the component unmounts, and the AuthContext would
// need to remove the service from the list of services (and keep a count), in order to
// support shared services.

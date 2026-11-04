import { AuthAccessService2, InternationalString } from '@iiif/parser/presentation-3/types';
import { FunctionComponent, ReactNode, createContext, useContext, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { StoreApi } from 'zustand/vanilla';
import {
  AuthContextActions,
  AuthPresentationProps,
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

export function AuthProvider({ children, errorComponent }: { children: ReactNode; errorComponent?: FunctionComponent<AuthPresentationProps> }) {
  const authStateStore = useMemo(() => {
    const store = createAuthStateStore();
    store.setState({ errorComponent });
    return store;
  }, []);

  useEffect(() => { authStateStore.setState({ errorComponent }); }, [authStateStore, errorComponent]);
  useEffect(() => () => authStateStore.getState().dispose(), [authStateStore]);

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
  const service = useStore(store, (state) => state.authItems.find((item) => item.id === id));
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
    const auth = state.authItems.find((item) => item.id === id);
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
  const configuredError = useStore(useAuthStore(), (state) => state.errorComponent);
  const Error = configuredError || props.errorComponent || FallbackElement;

  const probeService = probe.service;

  let inner = null;

  if (!hasAuth || !probeService) {
    return props.children(service);
  }

  if (probe.status === 'error') {
    inner = (
      <Error
        resource={props.resource}
        error={probe.error || ''}
        heading={probe.errorHeading}
        note={probe.errorNote}
        probe={probe}
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

  return inner;
}

import {
  AuthAccessService2,
  AuthAccessTokenService2,
  AuthLogoutService2,
  InternationalString,
} from '@iiif/presentation-3';
import { FunctionComponent, ReactNode, createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { useAuthResource } from '../hooks/useAuthResource';
import { makeAccessTokenRequest, makeAccessServiceRequest, createAuthStateStore } from '../future-helpers/auth';
import { StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

interface AuthContextState {
  currentAuth: number; // Should only be active ones.
  authItems: AuthState[];
}

interface AuthContextCurrentActions {
  login(): void;
  logout(): void;
  nextAuth(): void;
  previousAuth(): void;
  setAuth(index: number): void;
}

interface AuthContextActions {
  addService(service: AuthAccessService2, probeId: string): void;
  removeService(service: AuthAccessService2, probeId: string): void;
}

interface AuthState {
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

type AuthContextActionTypes =
  | { type: 'login.start'; payload: { id: string } }
  | { type: 'login.success'; payload: { id: string; token: string; expires: number } }
  | { type: 'login.error'; payload: { id: string; error: string } }
  | { type: 'logout'; payload: { id: string } }
  | { type: 'session.expire'; payload: { id: string } }
  | { type: 'service.add'; payload: { service: AuthAccessService2; probeId: string } }
  | { type: 'service.remove'; payload: AuthAccessService2 }
  | { type: 'list.next' }
  | { type: 'list.previous' }
  | { type: 'list.set'; payload: number };

function updateAuthState(
  id: string,
  state: AuthContextState,
  callback: (state: AuthState) => AuthState
): AuthContextState {
  const index = state.authItems.findIndex((item) => item.service.id === id);
  if (index === -1) {
    return state;
  }

  const newAuthItems = [...state.authItems];
  const possiblyNew = callback(newAuthItems[index]);
  if (possiblyNew === newAuthItems[index]) {
    return state;
  }

  newAuthItems[index] = possiblyNew;

  return {
    ...state,
    authItems: newAuthItems,
  };
}

function authStateReducer(state: AuthContextState, action: AuthContextActionTypes): AuthContextState {
  switch (action.type) {
    case 'login.start': {
      return updateAuthState(action.payload.id, state, (item) => ({
        ...item,
        isPending: true,
      }));
    }
    case 'login.success': {
      return updateAuthState(action.payload.id, state, (item) => ({
        ...item,
        isLoggedIn: true,
        isPending: false,
        session: {
          token: action.payload.token,
          expires: action.payload.expires,
        },
      }));
    }
    case 'login.error': {
      return updateAuthState(action.payload.id, state, (item) => ({
        ...item,
        isLoggedIn: false,
        isPending: false,
        canAuthenticate: false,
        error: action.payload.error,
      }));
    }
    case 'session.expire': {
      return updateAuthState(action.payload.id, state, (item) => ({
        ...item,
        isPending: false,
        isLoggedIn: false,
        session: null,
      }));
    }

    case 'logout':
      return updateAuthState(action.payload.id, state, (item) => ({
        ...item,
        isLoggedIn: false,
        session: null,
        isPending: false,
      }));

    case 'service.add': {
      const alreadyExists = state.authItems.find((item) => item.service.id === action.payload.service.id);
      if (alreadyExists) {
        return updateAuthState(action.payload.service.id, state, (item) => ({
          ...item,
          instances: item.instances + 1,
        }));
      }

      return {
        ...state,
        currentAuth: action.payload.service.profile === 'active' ? 0 : state.currentAuth,
        authItems: [
          {
            id: action.payload.service.id,
            type: action.payload.service.profile,
            service: action.payload.service,
            probeId: action.payload.probeId,
            canAuthenticate: true,
            instances: 1,
            isPending: false,
            isLoggedIn: false,
            session: null,
          },
          ...state.authItems,
        ],
      };
    }
    case 'service.remove': {
      // Is it active?
      const isCurrent =
        state.currentAuth === state.authItems.findIndex((item) => item.service.id === action.payload.id);
      let currentAuth = state.currentAuth;
      if (isCurrent) {
        const active = state.authItems.find((item) => item.service.id === action.payload.id);
        const isActive = active && active.instances > 1;
        if (!isActive) {
          const nextActive = state.authItems.findIndex(
            (item) => item.service.id !== action.payload.id && item.instances > 0
          );

          currentAuth = nextActive;
        }
      }

      return {
        ...updateAuthState(action.payload.id, state, (item) => ({
          ...item,
          instances: item.instances - 1,
        })),
        currentAuth,
      };
    }

    // Come back to this.
    case 'list.next': {
      const total = state.authItems.length;
      const next = state.currentAuth + 1;
      if (next >= total) {
        return state;
      }

      return {
        ...state,
        currentAuth: next,
      };
    }
    case 'list.previous': {
      const previous = state.currentAuth - 1;
      if (previous < 0) {
        return state;
      }

      return {
        ...state,
        currentAuth: previous,
      };
    }
    case 'list.set': {
      if (action.payload !== -1) {
        if (action.payload < 0 || action.payload >= state.authItems.length) {
          return state;
        }
      }
      return {
        ...state,
        currentAuth: action.payload,
      };
    }
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const authStateStore = useMemo(() => {
    return createAuthStateStore();
  }, []);

  console.log('authStateStore', authStateStore);

  return <AuthRContext.Provider value={authStateStore}>{children}</AuthRContext.Provider>;
}

export function AuthProvider_Old({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authStateReducer, {
    currentAuth: -1,
    authItems: [],
  });

  // External -> Open Token Service
  // Kiosk -> Open Access Service -> Open Token Service
  // Active -> Wait for user -> Open Access Service -> Open Token Service

  const addService = (service: AuthAccessService2, probeId: string) => {
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

    // add service.
    dispatch({ type: 'service.add', payload: { service, probeId } });

    // If its external, we just open the token service.
    if (service.profile === 'external') {
      if (!tokenService) {
        throw new Error('Token service not found');
      }
      makeAccessTokenRequest(tokenService)
        .then((token) => {
          // Make as resolved, so the image service should retry the probe.
          dispatch({
            type: 'login.success',
            payload: { id: service.id, token: token.accessToken, expires: token.expiresIn },
          });
        })
        .catch((error) => {
          // Make as an error.
          dispatch({ type: 'login.error', payload: { id: service.id, error: error.message } });
        });
      //
    }

    // If its kiosk, we open the access service, then the token service.
    if (service.profile === 'kiosk') {
      if (!tokenService) {
        throw new Error('Token service not found');
      }
      dispatch({ type: 'login.start', payload: { id: service.id } });
      makeAccessServiceRequest(accessService)
        .then(() => {
          // Access service.
          makeAccessTokenRequest(tokenService)
            .then((token) => {
              // Make as resolved, so the image service should retry the probe.
              // And set the token.
              dispatch({
                type: 'login.success',
                payload: { id: service.id, token: token.accessToken, expires: token.expiresIn },
              });
            })
            .catch((error) => {
              // Make as an error.
              dispatch({ type: 'login.error', payload: { id: service.id, error: error.message } });
            });
        })
        .catch((error) => {
          // Make as an error.
          dispatch({ type: 'login.error', payload: { id: service.id, error: error.message } });
        });
    }

    if (service.profile === 'active') {
      // Just wait for the user interaction.
    }
  };

  const removeService = (service: AuthAccessService2) => {
    // Dispatch the event.
    // @todo However, also are we in the middle of a request?
    //       If so, we need to cancel that.

    dispatch({ type: 'service.remove', payload: service });
  };

  const login = () => {
    const current = state.authItems[state.currentAuth];
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

    dispatch({ type: 'login.start', payload: { id: current.id } });
    makeAccessServiceRequest(current.service).then(() => {
      makeAccessTokenRequest(tokenService)
        .then((token) => {
          const expires = token.expiresIn;
          const expiresTimestamp = Date.now() + expires * 1000;
          dispatch({
            type: 'login.success',
            payload: { id: current.id, token: token.accessToken, expires: expiresTimestamp },
          });
        })
        .catch((error) => {
          dispatch({ type: 'login.error', payload: { id: current.id, error: error.message } });
        });
    });
  };

  const logout = () => {
    const current = state.authItems[state.currentAuth];
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

    const url = `${logoutService.id}?origin=${window.location.origin}`;
    const windowRef = window.open(url);
    dispatch({ type: 'logout', payload: { id: current.id } });
    if (!windowRef) {
      // Silent fail? Still log out anyway.
      // throw new Error('Failed to open window');
    }
  };

  const nextAuth = () => {};
  const previousAuth = () => {};
  const setAuth = (index: number) => {};

  const serviceActions = useMemo(() => {
    return {
      addService,
      removeService,
    };
  }, []);

  const currentActions = useMemo(() => {
    return {
      ...state,
      login,
      logout,
      nextAuth,
      previousAuth,
      setAuth,
    };
  }, [state]);

  return (
    <AuthReactContext.Provider value={currentActions}>
      <AuthReactContextActions.Provider value={serviceActions}>{children}</AuthReactContextActions.Provider>
    </AuthReactContext.Provider>
  );
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

export function useCurrentAuth_old() {
  const ctx = useContext(AuthReactContext);
  if (!ctx) {
    throw new Error('useCurrentAuth must be used within a AuthProvider');
  }

  return ctx;
}

export function useAuthService_old(id: string): AuthState | null {
  const ctx = useContext(AuthReactContext);
  if (!ctx) {
    return null;
  }

  return ctx.authItems.find((item) => item.service.id === id) || null;
}

export function useAuthTokens_old(id?: string): string | null {
  const ctx = useContext(AuthReactContext);
  if (!ctx || !id) {
    return null;
  }

  return ctx.authItems.find((item) => item.id === id)?.session?.token || null;
}

export function useAuthToken_old(id?: string): string | null {
  const ctx = useContext(AuthReactContext);
  if (!id) {
    return null;
  }
  if (!ctx) {
    return null;
  }

  const auth = ctx.authItems.find((item) => item.service.id === id);
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
}

export function useAuthActions_old() {
  return useContext(AuthReactContextActions);
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
    console.log('add service', props.service, props.probeId);
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

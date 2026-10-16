import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest';
import type { AuthAccessService2 } from '@iiif/parser/presentation-3/types';
import {
  authDetailsForResource,
  createAuthStateStore,
  makeAccessTokenRequest,
  getAccessServiceId,
  type AuthContextActions,
  type ProbeStore,
} from '../src/future-helpers/auth';
import {
  Auth,
  AuthProvider,
  useAuthStore,
  useCurrentAuth,
  useAuthService,
  useAuthToken,
  useAuthTokens,
} from '../src/context/AuthContext';
import { useAuthResource } from '../src/hooks/useAuthResource';
import { Authenticate } from '../src/components/future/Authenticate';

function access(profile: AuthAccessService2['profile'], name: string = profile): AuthAccessService2 {
  return {
    ...(profile === 'external' ? {} : { id: `https://example.org/${name}` }),
    type: 'AuthAccessService2',
    profile,
    label: { en: [name] },
    heading: { en: [`${name} heading`] },
    note: { en: [`${name} note`] },
    confirmLabel: { en: [`Sign in with ${name}`] },
    service: [{ id: `https://example.org/${name}/token`, type: 'AuthAccessTokenService2' }],
  } as AuthAccessService2;
}

function resource(services: AuthAccessService2[]) {
  return { id: 'image', service: [{ id: 'https://example.org/probe', type: 'AuthProbeService2', service: services }] };
}

let requests: string[];
let tokens: Record<string, string | null>;
let granted: Set<string>;
let initialStatus: number;
let tokenError: string;

beforeEach(() => {
  requests = [];
  tokens = {};
  granted = new Set();
  initialStatus = 401;
  tokenError = 'missingAspect';
  const append = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
    if (node instanceof HTMLIFrameElement) {
      const url = new URL(node.src);
      node.src = 'about:blank';
      append(node);
      const name = url.pathname.split('/')[1];
      requests.push(`token:${name}`);
      queueMicrotask(() =>
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: url.origin,
            source: node.contentWindow,
            data: {
              messageId: url.searchParams.get('messageId'),
              ...(tokens[name]
                ? { type: 'AuthAccessToken2', accessToken: tokens[name], expiresIn: 60 }
                : { type: 'AuthAccessTokenError2', profile: tokenError }),
            },
          })
        )
      );
      return node;
    }
    return append(node);
  });
  vi.spyOn(window, 'open').mockImplementation((url) => {
    requests.push(`access:${new URL(String(url)).pathname.slice(1)}`);
    return { closed: true } as Window;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, options) => {
      const token = options?.headers?.Authorization?.replace('Bearer ', '');
      requests.push(`probe:${token || 'none'}`);
      return { json: async () => ({ status: token ? (granted.has(token) ? 200 : 401) : initialStatus }) };
    })
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(services: AuthAccessService2[], strict = false) {
  const image = resource(services);
  return renderHook(
    () => ({
      resource: useAuthResource(image),
      store: useAuthStore(),
      state: useCurrentAuth(),
    }),
    {
      wrapper: ({ children }) => <AuthProvider>{strict ? <StrictMode>{children}</StrictMode> : children}</AuthProvider>,
    }
  );
}

describe('Auth 2 service discovery and prompts', () => {
  test('retains the existing action and probe signatures', () => {
    expectTypeOf<ReturnType<AuthContextActions['addService']>>().toEqualTypeOf<void>();
    expectTypeOf<Parameters<ProbeStore['setToken']>>().toEqualTypeOf<[token: string]>();
    expectTypeOf<ReturnType<ReturnType<typeof createAuthStateStore>['getState']>['addService']>().toEqualTypeOf<
      AuthContextActions['addService']
    >();
  });

  test('retains supplied service IDs for existing lookup hooks', async () => {
    const service = { ...access('external'), id: 'https://example.org/existing-external' };
    tokens.external = 'existing-session';
    const view = renderHook(
      () => ({
        store: useAuthStore(),
        service: useAuthService(service.id),
        token: useAuthToken(service.id),
        tokens: useAuthTokens(service.id),
      }),
      { wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> }
    );
    await act(async () => {
      await view.result.current.store.getState().addService(service, 'probe');
    });
    expect(view.result.current.service?.id).toBe(service.id);
    expect(view.result.current.token).toBe('existing-session');
    expect(view.result.current.tokens).toBe('existing-session');
    expect(requests).toEqual(['token:external']);
  });

  test('keeps every service in profile order without changing the source or legacy field', () => {
    const services = [access('active'), access('kiosk'), access('external')];
    const details = authDetailsForResource(resource(services));
    expect(details.services.access).toBe(services[0]);
    expect(details.services.accessServices.map((s) => s.profile)).toEqual(['external', 'kiosk', 'active']);
    expect(services.map((s) => s.profile)).toEqual(['active', 'kiosk', 'external']);
  });

  test('adding, navigating and removing services never selects an automatic or unused service', async () => {
    const store = createAuthStateStore();
    const first = access('active', 'first');
    const external = access('external');
    const kiosk = access('kiosk');
    const second = access('active', 'second');
    await store.getState().addService(first, 'probe');
    await store.getState().addService(external, 'probe');
    await store.getState().addService(kiosk, 'probe');
    await store.getState().addService(second, 'probe');
    expect(store.getState().currentAuth).toBe(0);
    store.getState().setAuth(1);
    expect(store.getState().currentAuth).toBe(0);
    store.getState().nextAuth();
    expect(store.getState().currentAuth).toBe(3);
    store.getState().previousAuth();
    expect(store.getState().currentAuth).toBe(0);
    await store.getState().addService(first, 'other-probe');
    store.getState().removeService(first, 'probe');
    expect(store.getState().currentAuth).toBe(0);
    store.getState().removeService(first, 'other-probe');
    expect(store.getState().currentAuth).toBe(3);
    store.getState().previousAuth();
    expect(store.getState().currentAuth).toBe(3);
    store.getState().removeService(second, 'probe');
    expect(store.getState().currentAuth).toBe(-1);
    store.getState().previousAuth();
    expect(store.getState().currentAuth).toBe(-1);
    await store.getState().addService(first, 'new-probe');
    expect(store.getState().currentAuth).toBe(0);
  });

  test('external services without IDs stay distinct and shared pending requests are reused', async () => {
    const store = createAuthStateStore();
    const first = access('external', 'first');
    const second = access('external', 'second');
    await Promise.all([
      store.getState().addService(first, 'probe'),
      store.getState().addService(first, 'other'),
      store.getState().addService(second, 'probe'),
    ]);
    expect(store.getState().authItems.map((item) => item.id)).toEqual([
      getAccessServiceId(first),
      getAccessServiceId(second),
    ]);
    expect(store.getState().authItems[0].instances).toBe(2);
    expect(requests).toEqual(['token:first', 'token:second']);
    expect(store.getState().currentAuth).toBe(-1);
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });
});

describe('Auth 2 resource flow', () => {
  test.each([false, true])(
    'external failure falls through to sign-in regardless of listing order (reverse=%s)',
    async (reverse) => {
      tokenError = reverse ? 'invalidAspect' : 'missingAspect';
      const services = [access('external'), access('active')];
      const view = mount(reverse ? services.reverse() : services);
      await waitFor(() => expect(view.result.current.state.currentAuth).not.toBe(-1));
      expect(requests).toEqual(['probe:none', 'token:external']);
      expect(view.result.current.state.authItems[view.result.current.state.currentAuth].type).toBe('active');
      tokens.active = 'signed-in';
      granted.add('signed-in');
      act(() => view.result.current.store.getState().login());
      await waitFor(() => expect(view.result.current.resource[1].status).toBe('success'));
      expect(requests).toEqual(['probe:none', 'token:external', 'access:active', 'token:active', 'probe:signed-in']);
      view.unmount();
      expect(view.result.current.store.getState().authItems.every((item) => item.instances === 0)).toBe(true);
      expect(view.result.current.store.getState().currentAuth).toBe(-1);
    }
  );

  test('re-probes each automatic token and stops before active services once access is granted', async () => {
    tokens.external = 'insufficient';
    tokens.kiosk = 'allowed';
    granted.add('allowed');
    const view = mount([access('active'), access('kiosk'), access('external')]);
    await waitFor(() => expect(view.result.current.resource[1].status).toBe('success'));
    expect(requests).toEqual([
      'probe:none',
      'token:external',
      'probe:insufficient',
      'access:kiosk',
      'token:kiosk',
      'probe:allowed',
    ]);
    expect(requests.some((r) => r === 'access:active')).toBe(false);
    expect(view.result.current.resource[1].discovering).toBe(false);
    expect(view.result.current.state.authItems[0].session!.expires).toBeGreaterThan(Date.now());
  });

  test('does not contact any access service after an initial 200', async () => {
    initialStatus = 200;
    const view = mount([access('external'), access('kiosk'), access('active')]);
    await waitFor(() => expect(view.result.current.resource[1].status).toBe('success'));
    expect(requests).toEqual(['probe:none']);
    expect(view.result.current.state.authItems).toEqual([]);
  });

  test('blocked kiosk popup falls through to active without leaving a pending prompt', async () => {
    vi.mocked(window.open).mockReturnValue(null);
    const view = mount([access('kiosk'), access('active')]);
    await waitFor(() => expect(view.result.current.state.currentAuth).not.toBe(-1));
    expect(view.result.current.state.authItems[0]).toMatchObject({ isPending: false, errorProfile: 'blocked' });
    expect(view.result.current.state.authItems[view.result.current.state.currentAuth].type).toBe('active');
  });

  test('offers multiple active services and advances when a valid token still fails the probe', async () => {
    tokens.first = 'insufficient';
    tokens.second = 'allowed';
    granted.add('allowed');
    const view = mount([access('active', 'first'), access('active', 'second')]);
    await waitFor(() => expect(view.result.current.state.authItems).toHaveLength(2));
    act(() => view.result.current.store.getState().login());
    await waitFor(() => expect(view.result.current.state.currentAuth).toBe(1));
    act(() => view.result.current.store.getState().login());
    await waitFor(() => expect(view.result.current.resource[1].status).toBe('success'));
    expect(requests).toEqual([
      'probe:none',
      'access:first',
      'token:first',
      'probe:insufficient',
      'access:second',
      'token:second',
      'probe:allowed',
    ]);
  });

  test('StrictMode cleanup does not register services after the flow was cancelled', async () => {
    const view = mount([access('external'), access('active')], true);
    await waitFor(() => expect(view.result.current.state.currentAuth).not.toBe(-1));
    expect(view.result.current.state.authItems.map((item) => item.instances)).toEqual([1, 1]);
  });

  test('Auth renders the protected content and the prompt displays active wording and choices', async () => {
    tokens.second = 'allowed';
    granted.add('allowed');
    const image = resource([access('external'), access('active', 'first'), access('active', 'second')]);
    const view = render(
      <AuthProvider>
        <Auth resource={image} errorComponent={() => <span>Access required</span>}>
          {() => <span>Protected image</span>}
        </Auth>
        <Authenticate />
      </AuthProvider>
    );
    await waitFor(() => expect(view.getByRole('button', { name: 'Sign in with first' })).toBeTruthy());
    expect(view.getByText('first heading')).toBeTruthy();
    expect(view.getByText('first note')).toBeTruthy();
    expect(view.queryByText('external heading')).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Next sign-in option' }));
    fireEvent.click(view.getByRole('button', { name: 'Sign in with second' }));
    await waitFor(() => expect(view.getByText('Protected image')).toBeTruthy());
  });

  test('logout clears the probe token and rechecks access', async () => {
    tokens.active = 'allowed';
    granted.add('allowed');
    const service = access('active');
    service.service = [
      { id: 'https://example.org/active/token', type: 'AuthAccessTokenService2' },
      { id: 'https://example.org/logout', type: 'AuthLogoutService2', label: { en: ['Sign out'] } },
    ];
    const view = mount([service]);
    await waitFor(() => expect(view.result.current.state.currentAuth).toBe(0));
    act(() => view.result.current.store.getState().login());
    await waitFor(() => expect(view.result.current.resource[1].status).toBe('success'));
    act(() => view.result.current.store.getState().logout());
    await waitFor(() => expect(view.result.current.resource[1].status).toBe('error'));
    expect(view.result.current.resource[1].token).toBeNull();
    expect(requests.at(-1)).toBe('probe:none');
  });

  test('a late probe cannot register services for a replaced resource', async () => {
    let resolveProbe!: (response: any) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve;
        })
    );
    const view = renderHook(({ image }) => ({ resource: useAuthResource(image), state: useCurrentAuth() }), {
      initialProps: { image: resource([access('external'), access('active')]) },
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });
    await waitFor(() => expect(resolveProbe).toBeTypeOf('function'));
    view.rerender({ image: resource([]) });
    await act(async () => resolveProbe({ json: async () => ({ status: 401 }) }));
    expect(view.result.current.state.authItems).toEqual([]);
    expect(requests).toEqual(['probe:none']);
  });

  test('Auth preserves tailored heading and note from a 403 probe response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        status: 403,
        heading: { en: ['Only available on site'] },
        note: { en: ['Visit the Research Centre to view this item.'] },
      }),
    } as Response);
    const image = resource([access('active')]);
    const view = render(
      <AuthProvider>
        <Auth
          resource={image}
          errorComponent={({ error, heading, note }) => (
            <div>
              <span>{error}</span>
              <h2>{heading?.en?.[0]}</h2>
              <p>{note?.en?.[0]}</p>
            </div>
          )}
        >
          {() => <span>Protected image</span>}
        </Auth>
      </AuthProvider>
    );
    await waitFor(() => expect(view.getByText('Only available on site')).toBeTruthy());
    expect(view.getByText('Visit the Research Centre to view this item.')).toBeTruthy();
    expect(view.getByText('Forbidden')).toBeTruthy();
    expect(view.queryByText('Protected image')).toBeNull();
  });
});

describe('Auth 2 appointment and session recovery', () => {
  test('an unresponsive external token request settles and exposes the active route', async () => {
    vi.useFakeTimers();
    const append = vi.mocked(document.body.appendChild).getMockImplementation()!;
    vi.mocked(document.body.appendChild).mockImplementation((node) => node instanceof HTMLIFrameElement ? node : append(node));
    try {
      const view = mount([access('external'), access('active')]);
      await act(async () => { await vi.advanceTimersByTimeAsync(10001); });
      expect(view.result.current.resource[1].discovering).toBe(false);
      expect(view.result.current.state.authItems[0]).toMatchObject({ isPending: false, errorProfile: 'timeout' });
      expect(view.result.current.state.authItems[view.result.current.state.currentAuth].type).toBe('active');
    } finally { vi.useRealTimers(); }
  });

  test('an authenticated route can be revisited to add an appointment', async () => {
    tokens.active = 'insufficient';
    const view = mount([access('active')]);
    await waitFor(() => expect(view.result.current.state.currentAuth).toBe(0));
    act(() => view.result.current.store.getState().login());
    await waitFor(() => expect(view.result.current.state.authItems[0].isLoggedIn).toBe(true));
    tokens.active = 'appointment';
    granted.add('appointment');
    act(() => view.result.current.store.getState().login());
    await waitFor(() => expect(view.result.current.resource[1].status).toBe('success'));
    expect(requests.filter((r) => r === 'access:active')).toHaveLength(2);
  });

  test('expiry removes access and allows another sign-in', async () => {
    vi.useFakeTimers();
    try {
      tokens.active = 'allowed';
      granted.add('allowed');
      const view = mount([access('active')]);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      act(() => view.result.current.store.getState().login());
      await act(async () => { await vi.advanceTimersByTimeAsync(501); });
      expect(view.result.current.resource[1].status).toBe('success');
      await act(async () => { await vi.advanceTimersByTimeAsync(60001); });
      expect(view.result.current.resource[1].status).toBe('error');
      expect(view.result.current.state.authItems[0].session).toBeNull();
      act(() => view.result.current.store.getState().login());
      await act(async () => { await vi.advanceTimersByTimeAsync(501); });
      expect(view.result.current.resource[1].status).toBe('success');
    } finally { vi.useRealTimers(); }
  });

  test('shared routes reuse a token and logout clears them after leaving protected content', async () => {
    const first = access('active', 'first');
    const second = access('active', 'second');
    const unrelated = access('active', 'unrelated');
    first.service.push({ id: 'https://example.org/logout', type: 'AuthLogoutService2', label: { en: ['Sign out'] } });
    second.service = first.service;
    const store = createAuthStateStore();
    try {
      await store.getState().addService(first, 'a');
      tokens.first = 'shared';
      store.getState().login(first.id);
      await waitFor(() => expect(store.getState().authItems[0].isLoggedIn).toBe(true));
      await store.getState().addService(second, 'b');
      await store.getState().addService(unrelated, 'c');
      const session = store.getState().authItems[0].session;
      expect(store.getState().authItems[1].session).toBe(session);
      store.setState({ authItems: store.getState().authItems.map((item) => item.id === unrelated.id ? { ...item, session: { token: 'other', expires: Date.now() + 60000 }, isLoggedIn: true } : item) });
      store.getState().removeService(first, 'a');
      store.getState().removeService(second, 'b');
      store.getState().logout(first.id);
      expect(store.getState().authItems.slice(0, 2).every((item) => item.session === null)).toBe(true);
      expect(store.getState().authItems[2].session?.token).toBe('other');
      await waitFor(() => expect(store.getState().authItems[0].isPending).toBe(false));
      expect(requests).toContain('access:logout');
    } finally { store.getState().dispose(); }
  });

  test('token errors preserve profile and service fallback text', async () => {
    const service = access('external');
    Object.assign(service.service[0], { errorHeading: { en: ['Access unavailable'] }, errorNote: { en: ['Please contact the library'] } });
    const store = createAuthStateStore();
    await store.getState().addService(service, 'a');
    expect(store.getState().authItems[0]).toMatchObject({ errorProfile: 'missingAspect', errorHeading: { en: ['Access unavailable'] }, errorNote: { en: ['Please contact the library'] } });
  });

  test('the provider presentation receives the existing probe and retry action', async () => {
    const image = resource([access('active')]);
    const view = render(<AuthProvider errorComponent={({ probe }) => <button onClick={() => probe.retry()}>Check again: {probe.responseStatus}</button>}>
      <Auth resource={image} errorComponent={() => <span>Default presentation</span>}>{() => <span>Allowed</span>}</Auth>
    </AuthProvider>);
    await waitFor(() => expect(view.getByText('Check again: 401')).toBeTruthy());
    expect(view.queryByText('Default presentation')).toBeNull();
    initialStatus = 200;
    fireEvent.click(view.getByText('Check again: 401'));
    await waitFor(() => expect(view.getByText('Allowed')).toBeTruthy());
  });
});


test('token messages must come from the matching frame and origin', async () => {
  vi.mocked(document.body.appendChild).mockRestore();
  const pending = makeAccessTokenRequest({ id: 'https://example.org/token?tenant=2', type: 'AuthAccessTokenService2' });
  const iframe = document.querySelector('iframe')!;
  const url = new URL(iframe.src);
  expect(url.searchParams.get('tenant')).toBe('2');
  const data = { messageId: url.searchParams.get('messageId'), type: 'AuthAccessToken2', accessToken: 'valid', expiresIn: 60 };
  let settled = false;
  void pending.then(() => { settled = true; });
  window.dispatchEvent(new MessageEvent('message', { origin: 'https://wrong.example', source: iframe.contentWindow, data }));
  window.dispatchEvent(new MessageEvent('message', { origin: url.origin, source: window, data }));
  await Promise.resolve();
  expect(settled).toBe(false);
  window.dispatchEvent(new MessageEvent('message', { origin: url.origin, source: iframe.contentWindow, data }));
  await expect(pending).resolves.toMatchObject({ accessToken: 'valid' });
  expect(document.querySelector('iframe')).toBeNull();
});

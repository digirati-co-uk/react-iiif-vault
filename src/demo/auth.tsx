import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Auth, AuthProvider, useCurrentAuth } from '../context/AuthContext';
import { Authenticate } from '../components/future/Authenticate';
import { LocaleString } from '../utility/i18n-utils';

const prototype = 'http://localhost:5080';
const asset = new URLSearchParams(window.location.search).get('asset') || 'restricted-1';
const imageService = `${prototype}/iiif/image/${encodeURIComponent(asset)}`;

function AuthStatus() {
  const { authItems, currentAuth, logout } = useCurrentAuth();
  return (
    <>
      {authItems[currentAuth]?.isLoggedIn ? <button onClick={() => logout()}>Sign out</button> : null}
      <details>
        <summary>Auth state</summary>
        <pre>
          {JSON.stringify(
            {
              currentAuth,
              services: authItems.map(({ type, isPending, isLoggedIn, error }) => ({
                type,
                isPending,
                isLoggedIn,
                error,
              })),
            },
            null,
            2
          )}
        </pre>
      </details>
    </>
  );
}

function App() {
  const [resource, setResource] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${imageService}/info.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Resource request failed: ${response.status}`);
        return response.json();
      })
      .then(setResource)
      .catch((error) => setError(error.message));
  }, []);

  return (
    <main>
      <h1>Auth 2 test viewer</h1>
      <p>
        Using the live IIIF Auth UX prototype. Set the location and service order in the{' '}
        <a href={prototype} target="_blank" rel="noreferrer">
          prototype control panel
        </a>
        , then reload this page.
      </p>
      <nav aria-label="Test scenarios">
        <a href="/auth.html?asset=restricted-1">External → sign-in</a>
        <a href="/auth.html?asset=asset-a-warning">Multiple active services</a>
        <a href="/auth.html?asset=terminal-1">On-site only / 403</a>
      </nav>
      <p>
        Current asset: <code>{asset}</code>
      </p>
      {error ? <p role="alert">Cannot load the prototype: {error}. Check that it is running on port 5080.</p> : null}
      <AuthProvider>
        {resource ? (
          <Auth
            resource={resource}
            loadingComponent={() => <p>Checking access…</p>}
            errorComponent={({ heading, note }) => (
              <div>
                <h2>
                  <LocaleString>{heading}</LocaleString>
                </h2>
                {note ? (
                  <p>
                    <LocaleString>{note}</LocaleString>
                  </p>
                ) : null}
              </div>
            )}
          >
            {() => (
              <section>
                <h2>Access granted</h2>
                <img src={`${imageService}/full/600,/0/default.jpg`} alt={`Protected asset ${asset}`} />
              </section>
            )}
          </Auth>
        ) : !error ? (
          <p>Loading resource…</p>
        ) : null}
        <Authenticate />
        <AuthStatus />
      </AuthProvider>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

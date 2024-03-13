import { useCurrentAuth } from '../../context/AuthContext';
import { LocaleString } from '../../utility/i18n-utils';

export function Authenticate() {
  const { authItems, currentAuth, login } = useCurrentAuth();

  if (currentAuth === -1) {
    return null;
  }

  const current = authItems[currentAuth];
  if (!current || !current.service || current.isLoggedIn) {
    return null;
  }

  return (
    <div>
      <div>
        <h2>Current Auth</h2>
        <p>{current.id}</p>
        <h3>
          <LocaleString>{current.service.label}</LocaleString>
        </h3>
        <button onClick={() => login()}>Login</button>
      </div>
      <pre>{JSON.stringify(current, null, 2)}</pre>
    </div>
  );
}

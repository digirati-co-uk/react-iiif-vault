import { useCurrentAuth } from '../../context/AuthContext';
import { LocaleString } from '../../utility/i18n-utils';

export function Authenticate() {
  const { authItems, currentAuth, login, nextAuth, previousAuth } = useCurrentAuth();
  const current = authItems[currentAuth];
  if (!current || current.service.profile !== 'active' || current.instances === 0 || current.isLoggedIn) return null;

  const active = authItems.filter((item) => item.type === 'active' && item.instances > 0);
  const index = active.indexOf(current);
  return (
    <div>
      <h3>
        <LocaleString>{current.service.heading || current.service.label}</LocaleString>
      </h3>
      {current.service.note ? (
        <p>
          <LocaleString>{current.service.note}</LocaleString>
        </p>
      ) : null}
      <button disabled={current.isPending} onClick={() => login()}>
        <LocaleString defaultText="Sign in">{current.service.confirmLabel}</LocaleString>
      </button>
      {active.length > 1 ? (
        <div>
          <button disabled={index === 0} onClick={previousAuth}>
            Previous sign-in option
          </button>
          <button disabled={index === active.length - 1} onClick={nextAuth}>
            Next sign-in option
          </button>
        </div>
      ) : null}
    </div>
  );
}

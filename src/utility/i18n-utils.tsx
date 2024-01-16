import { InternationalString } from '@iiif/presentation-3';
import React, { ReactNode, useMemo } from 'react';

const LanguageContext = React.createContext<string>('en');

export function LanguageProvider(props: { language: string; children: ReactNode }) {
  return <LanguageContext.Provider value={props.language}>{props.children}</LanguageContext.Provider>;
}

export function useIIIFLanguage() {
  return React.useContext(LanguageContext);
}

function getLanguagePartFromCode(code: string) {
  return code.indexOf('-') !== -1 ? code.slice(0, code.indexOf('-')) : code;
}

type LanguageStringProps = {
  [key: string]: any;
} & { as?: string | React.FC<any>; language: string; viewingDirection?: 'rtl' | 'rtl' };

export function LanguageString({ as: Component, language, children, viewingDirection, ...props }: LanguageStringProps) {
  const i18nLanguage = useIIIFLanguage();

  const isSame = useMemo(() => {
    return getLanguagePartFromCode(i18nLanguage) === getLanguagePartFromCode(language);
  }, [i18nLanguage, language]);

  if (isSame) {
    if (Component) {
      return <Component {...props}>{children}</Component>;
    }

    return <span {...props}>{children}</span>;
  }

  if (Component) {
    return (
      <Component {...props} lang={language} dir={viewingDirection}>
        {children}
      </Component>
    );
  }

  return (
    <span {...props} lang={language} dir={viewingDirection}>
      {children}
    </span>
  );
}

function getClosestLanguage(i18nLanguage: string, languages: string[], i18nLanguages: string[]) {
  if (languages.length === 0) {
    return undefined;
  }

  // Only one option.
  if (languages.length === 1) {
    return languages[0];
  }

  // Exact match.
  if (languages.indexOf(i18nLanguage) !== -1) {
    return i18nLanguage;
  }

  // Root match (en-us === en)
  const root = i18nLanguage.indexOf('-') !== -1 ? i18nLanguage.slice(0, i18nLanguage.indexOf('-')) : null;
  if (root && languages.indexOf(root) !== -1) {
    return root;
  }

  // All of the fall backs.
  for (const lang of i18nLanguages) {
    if (languages.indexOf(lang) !== -1) {
      return lang;
    }
  }

  if (languages.indexOf('none') !== -1) {
    return 'none';
  }

  if (languages.indexOf('@none') !== -1) {
    return '@none';
  }

  // Finally, fall back to the first.
  return languages[0];
}

export const useClosestLanguage = (getLanguages: () => string[], deps: any[] = []): string | undefined => {
  const i18nLanguage = useIIIFLanguage();

  return useMemo(() => {
    const languages = getLanguages();

    return getClosestLanguage(i18nLanguage, languages, []);
  }, [i18nLanguage, ...deps]);
};

export function useLocaleString(inputText: InternationalString | string | null | undefined, defaultText?: string) {
  const language = useClosestLanguage(() => Object.keys(inputText || {}), [inputText]);
  return [
    useMemo(() => {
      if (!inputText) {
        return defaultText || '';
      }
      if (typeof inputText === 'string') {
        return inputText;
      }

      const candidateText = language ? inputText[language] : undefined;
      if (candidateText) {
        if (typeof candidateText === 'string') {
          return candidateText;
        }
        return candidateText.join('\n');
      }

      return '';
    }, [language, defaultText, inputText]),
    language,
  ] as const;
}

export function useCreateLocaleString() {
  const i18nLanguage = useIIIFLanguage();

  return function createLocaleString(
    inputText: InternationalString | string | null | undefined,
    defaultText?: string,
    separator?: string
  ) {
    const languages = Object.keys(inputText || {});
    const language = getClosestLanguage(i18nLanguage, languages, []);

    if (!inputText) {
      return defaultText || '';
    }
    if (typeof inputText === 'string') {
      return inputText;
    }

    const candidateText = language ? inputText[language] : undefined;
    if (candidateText) {
      if (typeof candidateText === 'string') {
        return candidateText;
      }
      return candidateText.join(typeof separator !== 'undefined' ? separator : '\n');
    }

    return '';
  };
}

export const LocaleString: React.FC<
  {
    as?: string | React.FC<any>;
    defaultText?: string;
    to?: string;
    enableDangerouslySetInnerHTML?: boolean;
    children: InternationalString | string | null | undefined;
    style?: React.CSSProperties;
    extraProps?: any;
  } & Record<string, any>
> = ({ as: Component, defaultText, enableDangerouslySetInnerHTML, children, ...props }) => {
  const [text, language] = useLocaleString(children, defaultText);

  if (language) {
    return (
      <LanguageString
        {...props}
        as={Component}
        language={language}
        title={enableDangerouslySetInnerHTML ? undefined : text}
        dangerouslySetInnerHTML={
          enableDangerouslySetInnerHTML
            ? {
                __html: text,
              }
            : undefined
        }
      >
        {enableDangerouslySetInnerHTML ? undefined : text}
      </LanguageString>
    );
  }

  if (Component) {
    return <Component {...props}>{text}</Component>;
  }

  return (
    <span
      {...props}
      title={enableDangerouslySetInnerHTML ? undefined : text}
      dangerouslySetInnerHTML={
        enableDangerouslySetInnerHTML
          ? {
              __html: text,
            }
          : undefined
      }
    >
      {enableDangerouslySetInnerHTML ? undefined : text}
    </span>
  );
};

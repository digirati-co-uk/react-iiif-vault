import { InternationalString } from '@iiif/presentation-3';
import React, { ReactNode, useMemo } from 'react';

const LanguageContext = React.createContext<string>('en');
const TranslateContext = React.createContext<Record<string, string>>({});
const TransliterationContext = React.createContext<null | ((input: string, targetLang: string) => string)>(null);

export function TranslationProvider(props: { translations: Record<string, string>; children: ReactNode }) {
  return <TranslateContext.Provider value={props.translations}>{props.children}</TranslateContext.Provider>;
}

export function LanguageProvider(props: { language: string; children: ReactNode }) {
  return <LanguageContext.Provider value={props.language}>{props.children}</LanguageContext.Provider>;
}

export function TransliterationProvider(props: { convert: null | ((input: string) => string); children: ReactNode }) {
  return <TransliterationContext.Provider value={props.convert}>{props.children}</TransliterationContext.Provider>;
}

export function useTransliteration() {
  return React.useContext(TransliterationContext);
}

export function useIIIFLanguage() {
  return React.useContext(LanguageContext);
}

export function useTranslations() {
  return React.useContext(TranslateContext);
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

function translate(
  translations: Record<string, string>,
  key?: string,
  transliteration?: null | ((input: string, targetLang: string) => string),
  language?: string
) {
  if (!key) {
    return '';
  }
  if (transliteration) {
    return transliteration(translations[key] || key, language || 'none');
  }
  return translations[key] || key;
}

export function useLocaleString(
  inputText: InternationalString | string | null | undefined,
  defaultText?: string,
  separator = '\n',
  translations: Record<string, string> = {}
) {
  const transliteration = useTransliteration();
  const language = useClosestLanguage(() => Object.keys(inputText || {}), [inputText]);
  return [
    useMemo(() => {
      if (!inputText) {
        return translate(translations, defaultText, transliteration) || '';
      }
      if (typeof inputText === 'string') {
        return translate(translations, inputText, transliteration);
      }

      const candidateText = language ? inputText[language] : undefined;
      if (candidateText) {
        if (typeof candidateText === 'string') {
          return candidateText;
        }
        return candidateText.map((str) => translate(translations, str, transliteration, language)).join(separator);
      }

      return '';
    }, [language, defaultText, inputText]),
    language,
  ] as const;
}

export function useCreateLocaleString() {
  const i18nLanguage = useIIIFLanguage();
  const hookTranslations = useTranslations();
  const transliteration = useTransliteration();

  return function createLocaleString(
    inputText: InternationalString | string | null | undefined,
    defaultText: string = '',
    separator: string = '\n',
    translations: Record<string, string> = hookTranslations
  ) {
    const languages = Object.keys(inputText || {});
    const language = getClosestLanguage(i18nLanguage, languages, []);

    if (!inputText) {
      return translate(translations, defaultText, transliteration) || '';
    }
    if (typeof inputText === 'string') {
      return translate(translations, inputText, transliteration);
    }

    const candidateText = language ? inputText[language] : undefined;
    if (candidateText) {
      if (typeof candidateText === 'string') {
        return translate(translations, candidateText, transliteration, language);
      }
      return candidateText
        .map((text) => translate(translations, text, transliteration, language))
        .join(typeof separator !== 'undefined' ? separator : '\n');
    }

    return '';
  };
}

type LocaleStringProps = {
  as?: string | React.FC<any>;
  defaultText?: string;
  to?: string;
  separator?: string;
  enableDangerouslySetInnerHTML?: boolean;
  children: InternationalString | string | null | undefined;
  style?: React.CSSProperties;
  extraProps?: any;
} & Record<string, any>;

export function LocaleString({
  as: Component,
  defaultText,
  enableDangerouslySetInnerHTML,
  children,
  separator,
  ...props
}: LocaleStringProps) {
  const translations = useTranslations();
  const [text, language] = useLocaleString(children, defaultText, separator, translations);

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
}

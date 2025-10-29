import type { Annotation } from '@iiif/presentation-3';
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';

interface StylesheetStore {
  stylesheets: Record<string, string>;
  loading: string[];
  errors: Array<{ url: string; error: Error }>;

  // Actions.
  loadStylesheet(url: string): Promise<string>;
  setStylesheet(value: string, url?: string): string;
  parseStylesheet(
    stylesheet: Annotation['stylesheet'] | null
  ): Promise<null | { id: string; type: 'CssStylesheet'; value: string }>;
}

export const useStylesheetStore = create<StylesheetStore>()((set, get) => {
  const idMap = new Map<string, string>();

  const randomId = () => Math.random().toString(36).substring(2, 15);
  const getId = (css: string) => {
    const id = idMap.get(css);
    if (id) return id;
    const newId = randomId();
    idMap.set(css, newId);
    return newId;
  };

  return {
    stylesheets: {},
    loading: [],
    errors: [],

    async parseStylesheet(stylesheet) {
      const { loadStylesheet, setStylesheet } = get();

      if (!stylesheet) {
        return null;
      }

      if (typeof stylesheet === 'string') {
        if (stylesheet.startsWith('http')) {
          return {
            id: stylesheet,
            type: 'CssStylesheet',
            value: await loadStylesheet(stylesheet),
          };
        } else {
          const id = setStylesheet(stylesheet);
          return {
            id: id,
            type: 'CssStylesheet',
            value: stylesheet,
          };
        }
      }

      if (stylesheet.type === 'CssStylesheet') {
        const id = (stylesheet as any).id;

        if ('value' in stylesheet) {
          // Inline stylesheet.
          const value = Array.isArray(stylesheet.value) ? stylesheet.value.join('\n') : stylesheet.value;
          if (value) {
            const sheetId = setStylesheet(value, id);
            return {
              id: sheetId,
              type: 'CssStylesheet',
              value: value,
            };
          }
        }

        if ('id' in stylesheet) {
          if (stylesheet.id) {
            const sheet = await loadStylesheet(stylesheet.id);
            return {
              id: stylesheet.id,
              type: 'CssStylesheet',
              value: sheet,
            };
          }
        }
      }
      return null;
    },

    // Actions.
    async loadStylesheet(url: string) {
      const loading = get().loading;
      if (loading.includes(url)) return '';

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load stylesheet from ${url}`);
        const stylesheet = await response.text();
        set((current) => ({ stylesheets: { ...current.stylesheets, [url]: stylesheet } }));
        return stylesheet;
      } catch (error: any) {
        set((current) => ({ errors: [...current.errors, { url, error }] }));
        return '';
      }
    },
    setStylesheet(value: string, url?: string) {
      const id = url ? url : getId(value);
      set((current) => ({ stylesheets: { ...current.stylesheets, [id]: value } }));
      return id;
    },
  };
});

export function useRemoteStylesheet(stylesheet?: Annotation['stylesheet'] | null) {
  const [id, setId] = useState<string>('');
  const { loading, errors, stylesheets, parseStylesheet } = useStylesheetStore();

  useEffect(() => {
    if (!stylesheet) return;

    parseStylesheet(stylesheet).then((resp) => {
      if (resp?.id) {
        setId(resp.id);
      }
    });
  }, [stylesheet, parseStylesheet]);

  const onlySheets = useMemo(() => {
    const sheets: Record<string, string> = {};
    if (id && stylesheets[id]) {
      sheets[id] = stylesheets[id];
    }

    return sheets;
  }, [id, stylesheets]);

  return [onlySheets, { id, stylesheets, loading, errors }] as const;
}

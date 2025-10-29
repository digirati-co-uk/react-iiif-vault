import type { Annotation } from '@iiif/presentation-3';
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';

interface StylesheetStore {
  stylesheets: Record<string, string>;
  loading: string[];
  errors: Array<{ url: string; error: Error }>;

  // Actions.
  loadStylesheet(url: string): Promise<void>;
  setStylesheet(value: string, url?: string): string;
}

const useStylesheetStore = create<StylesheetStore>()((set, get) => {
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

    // Actions.
    async loadStylesheet(url: string) {
      const loading = get().loading;
      if (loading.includes(url)) return;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load stylesheet from ${url}`);
        const stylesheet = await response.text();
        set((current) => ({ stylesheets: { ...current.stylesheets, [url]: stylesheet } }));
      } catch (error: any) {
        set((current) => ({ errors: [...current.errors, { url, error }] }));
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
  const { loading, errors, stylesheets, loadStylesheet, setStylesheet } = useStylesheetStore();

  useEffect(() => {
    if (!stylesheet) return;

    if (typeof stylesheet === 'string') {
      if (stylesheet.startsWith('http')) {
        setId(stylesheet);
        loadStylesheet(stylesheet);
      } else {
        setId(setStylesheet(stylesheet));
      }
      return;
    }

    if (stylesheet.type === 'CssStylesheet') {
      const id = (stylesheet as any).id;

      if ('value' in stylesheet) {
        // Inline stylesheet.
        const value = Array.isArray(stylesheet.value) ? stylesheet.value.join('\n') : stylesheet.value;
        if (value) {
          setId(setStylesheet(value, id));
        }
      }

      if ('id' in stylesheet) {
        if (stylesheet.id) {
          loadStylesheet(stylesheet.id);
        }
        return;
      }
    }
  }, [stylesheet, setStylesheet, loadStylesheet]);

  const onlySheets = useMemo(() => {
    const sheets: Record<string, string> = {};
    if (stylesheets[id]) {
      sheets[id] = stylesheets[id];
    }

    return sheets;
  }, [id, stylesheets]);

  return [onlySheets, { id, stylesheets, loading, errors }] as const;
}

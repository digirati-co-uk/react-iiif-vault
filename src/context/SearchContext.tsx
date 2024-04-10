import { createContext, useContext, useMemo } from 'react';
import { Search1Store, createAutocompleteStore, createSearchStore } from '../future-helpers/search-1';
import { StoreApi, useStore } from 'zustand';
import { useSearchService } from '../hooks/useSearchService';
import { SearchService } from '@iiif/presentation-3';

export const SearchReactContext = createContext<StoreApi<Search1Store> | null>(null);
SearchReactContext.displayName = 'Search';

export function useSearch() {
  const context = useContext(SearchReactContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return useStore(context);
}

export function useAutocomplete() {
  const store = useSearch();
  const autocomplete = useMemo(() => {
    if (!store.service) {
      throw new Error('No search service found. You can use useSearch().hasSearch to check for this.');
    }
    return createAutocompleteStore(store.service);
  }, [store.service]);

  if (!autocomplete) {
    throw new Error('No autocomplete service found. You can use useSearch().hasAutocomplete to check for this.');
  }

  return useStore(autocomplete);
}

export function SearchProvider(props: { store?: StoreApi<Search1Store>; children: React.ReactNode }) {
  const searchService = useSearchService();

  if (props.store) {
    return <SearchReactContext.Provider value={props.store}>{props.children}</SearchReactContext.Provider>;
  }

  return <SearchInnerProvider service={searchService}>{props.children}</SearchInnerProvider>;
}

function SearchInnerProvider({
  service,
  children,
}: {
  service: SearchService | string | undefined;
  children: React.ReactNode;
}) {
  const searchStore = useMemo(() => {
    return createSearchStore(service as any);
  }, [service]);

  return <SearchReactContext.Provider value={searchStore}>{children}</SearchReactContext.Provider>;
}

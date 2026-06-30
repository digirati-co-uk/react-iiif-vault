import { createContext, useContext, useMemo } from 'react';

export const ViewerIdentifierReactContext = createContext('');

export function ViewerIdentifierProvider({ children, identifier }: { children: React.ReactNode; identifier?: string }) {
  const resolvedIdentifier = useMemo(() => {
    return identifier ?? Math.random().toString(36).substring(2, 9);
  }, [identifier]);

  return (
    <ViewerIdentifierReactContext.Provider value={resolvedIdentifier}>{children}</ViewerIdentifierReactContext.Provider>
  );
}

export function useViewerIdentifier() {
  return useContext(ViewerIdentifierReactContext);
}

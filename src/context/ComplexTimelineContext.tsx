import { createContext, useContext } from 'react';
import { StoreApi, useStore } from 'zustand';
import { ComplexTimelineStore } from '../future-helpers/complex-timeline-store';

const ComplexTimelineContext = createContext<StoreApi<ComplexTimelineStore> | null>(null);
ComplexTimelineContext.displayName = 'ComplexTimeline';

export function ComplexTimelineProvider({
  children,
  store,
}: {
  children: React.ReactNode;
  store: StoreApi<ComplexTimelineStore>;
}) {
  return <ComplexTimelineContext.Provider value={store}>{children}</ComplexTimelineContext.Provider>;
}

export function useComplexTimeline<T>(selector: (store: ComplexTimelineStore) => T) {
  const context = useContext(ComplexTimelineContext);
  if (!context) {
    throw new Error('useComplexTimeline must be used within a ComplexTimelineProvider');
  }
  return useStore(context, selector);
}

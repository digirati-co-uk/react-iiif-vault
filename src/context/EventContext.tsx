import React from 'react';
import { createContext, useMemo } from 'react';
import mitt, { Emitter, EventType } from 'mitt';

interface EventContext {
  emitter: Emitter<any>;
}

export const defaultEmitter = mitt();

export const ReactEventContext = createContext({
  emitter: defaultEmitter,
});

ReactEventContext.displayName = 'Events';

export function useEventEmitter<Events extends Record<EventType, unknown>>() {
  return React.useContext(ReactEventContext).emitter as Emitter<Events>;
}

export function EventsProvider({ emitter, children }: EventContext & { children: React.ReactNode }) {
  return (
    <ReactEventContext.Provider value={useMemo(() => ({ emitter }), [emitter])}>{children}</ReactEventContext.Provider>
  );
}

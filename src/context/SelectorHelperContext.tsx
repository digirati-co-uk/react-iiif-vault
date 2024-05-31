import React, { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import mitt, { Handler } from 'mitt';

const SelectorHelperReactContext = createContext(mitt());

SelectorHelperReactContext.displayName = 'SelectorHelper';

export type SelectorHelperEventTypes =
  | 'click'
  | 'hover'
  | 'selector-updated'
  | 'highlight'
  | 'clear-highlight'
  | 'zoom-to'
  | 'event-listener'
  | 'remove-event-listener'
  | 'image-preview-request';

export function SelectorControllerProvider({ children }: { children: ReactNode }) {
  return (
    <SelectorHelperReactContext.Provider value={useMemo(() => mitt(), [])}>
      {children}
    </SelectorHelperReactContext.Provider>
  );
}

export function useSelectorEmitter() {
  return useContext(SelectorHelperReactContext);
}

export function useSelectorEvents(id: string) {
  const controller = useSelectorController();
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    return controller.withSelector(id).on('highlight', () => {
      setIsHighlighted(true);
    });
  }, [controller, id]);

  useEffect(() => {
    return controller.withSelector(id).on('clear-highlight', () => {
      setIsHighlighted(false);
    });
  }, [controller, id]);

  const onClick = useCallback(
    (e?: { x: number; y: number; width: number; height: number }) => {
      controller.emit('click', { selectorId: id, event: e });
    },
    [id, controller]
  );

  const onHover = useCallback(
    (e?: { x: number; y: number; width: number; height: number }) => {
      controller.emit('hover', { selectorId: id, event: e });
    },
    [id, controller]
  );

  return {
    controller,
    onClick,
    onHover,
    isHighlighted,
  };
}

export function useSelectorController() {
  const controller = useContext(SelectorHelperReactContext);

  return useMemo(
    () => ({
      withSelector(selectorId: string) {
        return {
          on<T extends { selectorId: string } = any>(type: SelectorHelperEventTypes, handler: Handler<T>) {
            const handlerWrapper: Handler<T> = (ev) => {
              if (ev && ev.selectorId === selectorId) {
                handler(ev);
              }
            };

            controller.on<any>(type, handlerWrapper as any);
            return () => {
              controller.off<any>(type, handlerWrapper as any);
            };
          },
          emit<T = any>(type: SelectorHelperEventTypes, event: T) {
            controller.emit(type, { ...event, selectorId });
          },
        };
      },
      on<T extends { selectorId: string } = any>(type: SelectorHelperEventTypes, handler: Handler<T>) {
        controller.on<any>(type, handler as any);
        return () => {
          controller.off<any>(type, handler as any);
        };
      },
      emit<T extends { selectorId: string } = any>(type: SelectorHelperEventTypes, event: T) {
        controller.emit(type, event);
      },
    }),
    [controller]
  );
}

export function useSelectorHelper() {
  const controller = useSelectorController();

  return useMemo(
    () => ({
      withSelector(selectorId: string) {
        return {
          highlight() {
            controller.emit('highlight', { selectorId });
          },
          clearHighlight() {
            controller.emit('clear-highlight', { selectorId });
          },
          zoomTo() {
            controller.emit('zoom-to', { selectorId });
          },
          addEventListener(name: string, callback: () => void) {
            controller.emit('event-listener', { selectorId, name, callback });
            return () => {
              controller.emit('remove-event-listener', { selectorId, name, callback });
            };
          },
          getImagePreview(): Promise<any> {
            return new Promise((resolve, reject) => {
              controller.emit('image-preview-request', { selectorId, resolve, reject });
            });
          },
          on<T extends { selectorId: string } = any>(type: SelectorHelperEventTypes, handler: Handler<T>) {
            return controller.withSelector(selectorId).on(type, handler);
          },
        };
      },
      highlight(selectorId: string) {
        controller.emit('highlight', { selectorId });
      },
      clearHighlight(selectorId: string) {
        controller.emit('clear-highlight', { selectorId });
      },
      zoomTo(selectorId: string) {
        controller.emit('zoom-to', { selectorId });
      },
      addEventListener(selectorId: string, name: string, callback: () => void) {
        controller.emit('event-listener', { selectorId, name, callback });
        return () => {
          controller.emit('remove-event-listener', { selectorId, name, callback });
        };
      },
      getImagePreview(selectorId: string): Promise<any> {
        return new Promise((resolve, reject) => {
          controller.emit('image-preview-request', { selectorId, resolve, reject });
        });
      },
      on<T extends { selectorId: string } = any>(type: SelectorHelperEventTypes, handler: Handler<T>) {
        return controller.on(type, handler);
      },
    }),
    [controller]
  );
}

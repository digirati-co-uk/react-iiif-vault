import { createContext, useContext, useEffect } from 'react';

export const SetOverlaysReactContext = createContext<(key: string, element: any | null, props?: any) => void>(
  () => void 0
);
export const SetPortalReactContext = createContext<(key: string, element: any | null, props?: any) => void>(
  () => void 0
);

export function useOverlay(
  type: 'portal' | 'overlay' | 'none',
  key: string,
  element: any,
  props: any,
  deps: any[] = []
) {
  const setOverlay = useContext(type === 'portal' ? SetPortalReactContext : SetOverlaysReactContext);

  useEffect(() => {
    if (type !== 'none') {
      setOverlay(key, element, props);

      return () => {
        setOverlay(key, null);
      };
    }
    return () => void 0;
  }, [key, type, setOverlay, ...deps]);
}

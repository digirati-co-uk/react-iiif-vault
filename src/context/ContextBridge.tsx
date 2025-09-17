import React, { type Context, type ReactNode, useContext, useMemo } from 'react';
import { AtlasStoreReactContext } from '../canvas-panel/context/atlas-store-provider';
import { SimpleViewerReactContext } from '../viewers/SimpleViewerContext';
import { AuthRContext } from './AuthContext';
import { ReactEventContext } from './EventContext';
import { ResourceReactContext } from './ResourceContext';
import { SearchReactContext } from './SearchContext';
import { StrategyReactContext } from './StrategyContext';
import { ReactVaultContext, VaultProvider } from './VaultContext';
import { VisibleCanvasReactContext } from './VisibleCanvasContext';

const ContextBridgeReactContext = React.createContext<Record<string, Context<any>>>({});

export function useCustomContextBridge() {
  const custom = useContext(ContextBridgeReactContext);
  const keys = Object.keys(custom);
  const bridge: Record<string, { value: any; Provider: React.Provider<any> }> = {};

  for (const key of keys) {
    if (custom[key].Provider as any) {
      bridge[key] = {
        value: useContext(custom[key]),
        Provider: custom[key].Provider,
      };
    }
  }

  return bridge;
}

export function CustomContextBridge(
  props: Record<string, { value: any; Provider: React.Provider<any> }> & { children: React.ReactNode },
) {
  const keys = Object.keys(props);
  let toReturn = props.children;

  for (const key of keys) {
    if (key === 'children') continue;
    const { value, Provider } = props[key];
    toReturn = <Provider value={value}>{toReturn}</Provider>;
  }

  return toReturn;
}

export function CustomContextBridgeProvider(props: {
  providers: Record<string, Context<any>>;
  children: React.ReactNode;
}) {
  const existing = useContext(ContextBridgeReactContext);
  const newValue = useMemo(() => {
    return {
      ...existing,
      ...props.providers,
    };
  }, [props.providers]);

  return <ContextBridgeReactContext.Provider value={newValue}>{props.children}</ContextBridgeReactContext.Provider>;
}

export function useContextBridge() {
  return {
    VaultContext: useContext(ReactVaultContext),
    ResourceContext: useContext(ResourceReactContext),
    SimpleViewerReactContext: useContext(SimpleViewerReactContext),
    VisibleCanvasReactContext: useContext(VisibleCanvasReactContext),
    AuthRContext: useContext(AuthRContext),
    SearchReactContext: useContext(SearchReactContext),
    ReactEventContext: useContext(ReactEventContext),
    ContextBridgeReactContext: useContext(ContextBridgeReactContext),
    StrategyReactContext: useContext(StrategyReactContext),
    AtlasStoreReactContext: useContext(AtlasStoreReactContext),
  };
}

export function ContextBridge(props: {
  bridge: ReturnType<typeof useContextBridge>;
  custom?: ReturnType<typeof useCustomContextBridge>;
  children: ReactNode;
}) {
  return (
    <VaultProvider vault={props.bridge.VaultContext.vault || undefined} resources={props.bridge.ResourceContext}>
      <VisibleCanvasReactContext.Provider value={props.bridge.VisibleCanvasReactContext}>
        <SimpleViewerReactContext.Provider value={props.bridge.SimpleViewerReactContext}>
          <ReactEventContext.Provider value={props.bridge.ReactEventContext}>
            <AtlasStoreReactContext.Provider value={props.bridge.AtlasStoreReactContext}>
              <AuthRContext.Provider value={props.bridge.AuthRContext}>
                <SearchReactContext.Provider value={props.bridge.SearchReactContext}>
                  <ContextBridgeReactContext.Provider value={props.bridge.ContextBridgeReactContext}>
                    <StrategyReactContext.Provider value={props.bridge.StrategyReactContext}>
                      {props.custom ? (
                        <CustomContextBridge {...props.custom}>{props.children as any}</CustomContextBridge>
                      ) : (
                        props.children
                      )}
                    </StrategyReactContext.Provider>
                  </ContextBridgeReactContext.Provider>
                </SearchReactContext.Provider>
              </AuthRContext.Provider>
            </AtlasStoreReactContext.Provider>
          </ReactEventContext.Provider>
        </SimpleViewerReactContext.Provider>
      </VisibleCanvasReactContext.Provider>
    </VaultProvider>
  );
}

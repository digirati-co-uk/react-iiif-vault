import { ReactNode, useContext } from 'react';
import { ResourceReactContext } from './ResourceContext';
import { ReactVaultContext, VaultProvider } from './VaultContext';
import { SimpleViewerReactContext } from '../viewers/SimpleViewerContext';
import { VisibleCanvasReactContext } from './VisibleCanvasContext';
import { AuthRContext } from './AuthContext';
import { SearchReactContext } from './SearchContext';

export function useContextBridge() {
  return {
    VaultContext: useContext(ReactVaultContext),
    ResourceContext: useContext(ResourceReactContext),
    SimpleViewerReactContext: useContext(SimpleViewerReactContext),
    VisibleCanvasReactContext: useContext(VisibleCanvasReactContext),
    AuthRContext: useContext(AuthRContext),
    SearchReactContext: useContext(SearchReactContext),
  };
}

export function ContextBridge(props: { bridge: ReturnType<typeof useContextBridge>; children: ReactNode }) {
  return (
    <VaultProvider vault={props.bridge.VaultContext.vault || undefined} resources={props.bridge.ResourceContext}>
      <VisibleCanvasReactContext.Provider value={props.bridge.VisibleCanvasReactContext}>
        <SimpleViewerReactContext.Provider value={props.bridge.SimpleViewerReactContext}>
          <AuthRContext.Provider value={props.bridge.AuthRContext}>
            <SearchReactContext.Provider value={props.bridge.SearchReactContext}>
              {props.children}
            </SearchReactContext.Provider>
          </AuthRContext.Provider>
        </SimpleViewerReactContext.Provider>
      </VisibleCanvasReactContext.Provider>
    </VaultProvider>
  );
}

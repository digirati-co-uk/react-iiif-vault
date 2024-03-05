import React, { ReactNode, useContext } from 'react';
import { ResourceReactContext } from './ResourceContext';
import { ReactVaultContext, VaultProvider } from './VaultContext';
import { SimpleViewerReactContext } from '../viewers/SimpleViewerContext';
import { VisibleCanvasReactContext } from './VisibleCanvasContext';
import { AuthReactContext, AuthReactContextActions, AuthRContext } from './AuthContext';

export function useContextBridge() {
  return {
    VaultContext: useContext(ReactVaultContext),
    ResourceContext: useContext(ResourceReactContext),
    SimpleViewerReactContext: useContext(SimpleViewerReactContext),
    VisibleCanvasReactContext: useContext(VisibleCanvasReactContext),

    // Auth
    AuthReactContext: useContext(AuthReactContext),
    AuthReactContextActions: useContext(AuthReactContextActions),
    AuthRContext: useContext(AuthRContext),
  };
}

export function ContextBridge(props: { bridge: ReturnType<typeof useContextBridge>; children: ReactNode }) {
  return (
    <VaultProvider vault={props.bridge.VaultContext.vault || undefined} resources={props.bridge.ResourceContext}>
      <VisibleCanvasReactContext.Provider value={props.bridge.VisibleCanvasReactContext}>
        <SimpleViewerReactContext.Provider value={props.bridge.SimpleViewerReactContext}>
          <AuthReactContext.Provider value={props.bridge.AuthReactContext}>
            <AuthReactContextActions.Provider value={props.bridge.AuthReactContextActions}>
              <AuthRContext.Provider value={props.bridge.AuthRContext}>{props.children}</AuthRContext.Provider>
            </AuthReactContextActions.Provider>
          </AuthReactContext.Provider>
        </SimpleViewerReactContext.Provider>
      </VisibleCanvasReactContext.Provider>
    </VaultProvider>
  );
}
